import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  LIKELY_RANK,
  buildSearchIndex,
  hitCategory,
  matchTiers,
  matchingPois,
  prettyItem,
  searchIndex,
} from "../src/engine/search.ts";
import { allSubIds, poiSubIds, subBucketsFor } from "../src/engine/subcategories.ts";
import type { Category, GameSnapshot, MapPoi, RoomLoot } from "../src/engine/types.ts";

const CATEGORY_LABELS: Record<Category, string> = {
  food: "Food & water",
  alcohol: "Alcohol",
  weapons: "Weapons & ammo",
  medical: "Medical",
  tools: "Tools & materials",
  knowledge: "Skills & knowledge",
  fishing: "Fishing & outdoors",
  electronics: "Electronics",
  clothing: "Clothing",
  fuel: "Fuel & gas",
  homes: "Homes",
};

const subGroups = (Object.keys(CATEGORY_LABELS) as Category[]).flatMap((category) => subBucketsFor(category));

function index(pois: MapPoi[], loot: RoomLoot) {
  return buildSearchIndex({
    labels: [
      { text: "WEST POINT", kind: "town", x: 100, y: 100 },
      { text: "Scenic Grove Trailer Park", kind: "area", x: 5, y: 5 },
    ],
    streets: [
      { name: "Main St", width: 8, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] },
      { name: "Main St", width: 8, points: [{ x: 10, y: 0 }, { x: 10, y: 20 }] },
    ],
    pois,
    loot,
    categoryLabels: CATEGORY_LABELS,
    subGroups,
    poiSubIds,
  });
}

const gunStore: MapPoi = { name: "Gun Store", rawName: "gunstore", categories: ["weapons"], x: 1, y: 1, floor: 0 };
const tools: MapPoi = { name: "Tool Store", rawName: "toolstore", categories: ["tools"], x: 2, y: 2, floor: 0 };
const loot: RoomLoot = {
  gunstore: [{ item: "Base.Shotgun", weight: 10 }],
  toolstore: [{ item: "Base.WoodChisel", weight: 4 }, { item: "Base.Hammer", weight: 9 }],
  kitchen: [{ item: "Base.Hammer", weight: 1 }], // a house room: no map dots
};

test("finds towns (title-cased), streets (merged), stores, categories, groups and items", () => {
  const idx = index([gunStore, tools], loot);
  const kinds = (query: string) => searchIndex(idx, query).map((group) => group.kind);
  const first = (query: string) => searchIndex(idx, query)[0].hits[0];

  assert.equal(first("west").label, "West Point");
  assert.deepEqual(first("main st"), {
    kind: "street",
    key: "street:main st",
    label: "Main St",
    detail: "Street",
    count: 0,
    bounds: { minX: 0, minY: 0, maxX: 10, maxY: 20 },
  });
  assert.deepEqual(kinds("gun"), ["store", "group", "item"]); // Gun Store, Gun stores, Shotgun
  assert.equal(first("weapons").kind, "category");
  assert.equal(first("chisel").label, "Wood Chisel");
  assert.deepEqual(searchIndex(idx, "x"), [], "one letter is too short");
});

test("ranking: exact, then starts-with, then word-start, then contains", () => {
  const idx = index([gunStore, tools], loot);
  const items = searchIndex(idx, "hammer").find((group) => group.kind === "item");
  assert.equal(items?.hits[0].label, "Hammer");
});

test("a hit resolves to the places it highlights", () => {
  const pois = [gunStore, tools];
  const idx = index(pois, loot);
  const hammer = searchIndex(idx, "hammer").find((group) => group.kind === "item")!.hits[0];
  assert.deepEqual(matchingPois(hammer, pois, poiSubIds), [tools]);
  assert.equal(hammer.detail, "likely in 1 place");
  const store = searchIndex(idx, "gun store")[0].hits[0];
  assert.deepEqual(matchingPois(store, pois, poiSubIds), [gunStore]);
  assert.deepEqual(matchingPois(searchIndex(idx, "west")[0].hits[0], pois, poiSubIds), [], "towns fly");
});

test("an item deep in a long loot list is only 'possible' there", () => {
  // A big generic room (a kitchen) lists 80 items; a hammer is #70 — possible, not likely. In the
  // tool store it is a top find — likely.
  const kitchen: MapPoi = { name: "Kitchen", rawName: "kitchen", categories: ["food"], x: 3, y: 3, floor: 0 };
  const filler = Array.from({ length: 80 }, (_, i) => ({ item: `Base.Thing${i}`, weight: 100 - i }));
  filler[69] = { item: "Base.Hammer", weight: 31 };
  const pois = [tools, kitchen];
  const idx = index(pois, { toolstore: [{ item: "Base.Hammer", weight: 9 }], kitchen: filler });
  const hammer = searchIndex(idx, "hammer").find((group) => group.kind === "item")!.hits[0];
  assert.ok(hammer.kind === "item");
  assert.deepEqual(hammer.roomTypes, ["toolstore"]);
  assert.deepEqual(hammer.possibleRoomTypes, ["kitchen"]);
  assert.equal(hammer.possibleCount, 1);
  assert.deepEqual(matchingPois(hammer, pois, poiSubIds), [tools]);
  assert.deepEqual(matchingPois(hammer, pois, poiSubIds, true), [tools, kitchen], "show possible too");
  assert.equal(LIKELY_RANK, 50);
});

test("each search's dot uses a left-panel category colour (loot: where it's mostly found)", () => {
  const idx = index([gunStore, tools], loot);
  const first = (query: string, kind: string) =>
    searchIndex(idx, query).find((group) => group.kind === kind)!.hits[0];
  assert.equal(hitCategory(first("gun store", "store")), "weapons");
  assert.equal(hitCategory(first("gun stores", "group")), "weapons");
  assert.equal(hitCategory(first("tools", "category")), "tools");
  assert.equal(hitCategory(first("shotgun", "item")), "weapons", "shotguns: gun stores");
  assert.equal(hitCategory(first("chisel", "item")), "tools", "chisels: tool stores");
  assert.equal(hitCategory(first("west", "town")), null);
});

test("an item in the game's generic 'all' containers is possible anywhere", () => {
  // Like the 9mm Clip: a top find in gun stores, otherwise only in containers that appear anywhere.
  const pois = [gunStore, tools];
  const idx = index(pois, {
    gunstore: [{ item: "Base.9mmClip", weight: 10 }],
    all: Array.from({ length: 60 }, (_, i) => ({ item: i === 55 ? "Base.9mmClip" : `Base.Junk${i}`, weight: 60 - i })),
  });
  const clip = searchIndex(idx, "9mm clip").find((group) => group.kind === "item")!.hits[0];
  assert.ok(clip.kind === "item");
  assert.equal(clip.anywhere, true);
  assert.equal(clip.possibleCount, 1, "every other place is possible");
  assert.deepEqual(matchTiers(clip, pois, poiSubIds), { likely: [gunStore], possible: [tools] });
});

test("non-loot searches have one tier", () => {
  const pois = [gunStore, tools];
  const store = searchIndex(index(pois, loot), "gun store")[0].hits[0];
  assert.deepEqual(matchTiers(store, pois, poiSubIds), { likely: [gunStore], possible: [] });
});

test("item names read naturally", () => {
  assert.equal(prettyItem("Base.CannedBeans"), "Canned Beans");
  assert.equal(prettyItem("Base.Bullets9mm"), "Bullets9mm");
  assert.equal(prettyItem("WoodChisel"), "Wood Chisel");
  assert.ok(allSubIds().length > 0);
});

const publicDir = new URL("../public/", import.meta.url);
const hasData = ["snapshot.json", "pois.json", "loot.json"].every((file) => existsSync(new URL(file, publicDir)));

test("real map data: chisels, gun stores, a town, a street, a category", { skip: !hasData }, () => {
  const read = <T,>(file: string) => JSON.parse(readFileSync(new URL(file, publicDir), "utf8")) as T;
  const snapshot = read<GameSnapshot>("snapshot.json");
  const pois = read<MapPoi[]>("pois.json");
  const realLoot = read<RoomLoot>("loot.json");
  const started = performance.now();
  const idx = buildSearchIndex({
    labels: snapshot.labels,
    streets: snapshot.streets,
    pois,
    loot: realLoot,
    categoryLabels: CATEGORY_LABELS,
    subGroups,
    poiSubIds,
  });
  const buildMs = performance.now() - started;
  const find = (query: string, kind: string) =>
    searchIndex(idx, query).find((group) => group.kind === kind)?.hits[0];

  const chisel = find("chisel", "item");
  assert.ok(chisel, "an item matching 'chisel'");
  const chiselPlaces = matchingPois(chisel, pois, poiSubIds).length;
  assert.ok(chiselPlaces > 10, `the top chisel is a common one (${chisel.label}: ${chiselPlaces})`);
  // "Hammer" must not flood the map: kitchens and garages only list it deep down.
  const hammer = find("hammer", "item");
  assert.ok(hammer && hammer.kind === "item");
  const hammerLikely = matchingPois(hammer, pois, poiSubIds).length;
  assert.ok(hammerLikely < 2000, `hammer likely in ${hammerLikely} places (was 10,237 unfiltered)`);
  assert.ok(hammer.possibleCount > hammerLikely, "the rest are offered as 'possible'");
  assert.ok(find("gun store", "store"), "gun stores");
  assert.equal(find("west point", "town")?.label, "West Point");
  assert.ok(find("main st", "street"), "a Main St");
  assert.ok(find("weapons", "category"), "weapons category");

  const queryStarted = performance.now();
  searchIndex(idx, "ham");
  const queryMs = performance.now() - queryStarted;
  console.log(
    `  index: ${idx.entries.length} entries in ${buildMs.toFixed(0)} ms; a query in ${queryMs.toFixed(1)} ms; ` +
      `"${chisel.label}" → ${chiselPlaces} places; "Hammer" likely ${hammerLikely} + possible ${hammer.possibleCount}`,
  );
});
