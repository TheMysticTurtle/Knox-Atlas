// Search over the map: towns & areas, streets, store/room types, loot categories and their
// sub-groups, and specific loot items. A hit can be resolved to the room POIs it matches (for
// highlighting) or to a place to fly to. Pure and self-contained (type-only imports) so it runs
// under the Node test runner; labels that live in the UI layer are passed in.

import type { Bounds, Category, MapPoi, Point, RoomLoot, Street } from "./types";

export type SearchKind = "town" | "street" | "store" | "category" | "group" | "item";

/**
 * What a search result points at. Store/category/group/item hits highlight POIs; towns and streets
 * fly. `count` (places it highlights) breaks ranking ties.
 */
type HitBase = { key: string; label: string; detail: string; count: number };
export type SearchHit =
  | (HitBase & { kind: "town"; point: Point })
  | (HitBase & { kind: "street"; bounds: Bounds })
  | (HitBase & { kind: "store"; rawNames: string[]; category: Category })
  | (HitBase & { kind: "category"; category: Category })
  | (HitBase & { kind: "group"; subId: string })
  | (HitBase & {
      kind: "item";
      /** Room types where the item is one of the room's top finds ("likely"). */
      roomTypes: string[];
      /** Room types where it can turn up, but deep in the list ("possible"). */
      possibleRoomTypes: string[];
      /**
       * True when the item is in the game's generic "all" table — containers that can appear in any
       * room — so every place on the map is at least "possible".
       */
      anywhere: boolean;
      /** Places (map dots) that are only "possible". */
      possibleCount: number;
      /** The category of the places it's mostly found in (ammo → weapons), for its colour dot. */
      category: Category | null;
    });

/** The game's loot table for generic containers that can appear in any room. */
const ANYWHERE_ROOM = "all";

/**
 * An item is a "likely" find in a room type when it is among that room's top LIKELY_RANK items by
 * spawn weight (ties at the boundary included). Deeper than that it is merely "possible" — e.g. a
 * hammer is #2 in a carpentry workshop but #304 of 752 in a kitchen.
 */
export const LIKELY_RANK = 50;

export type SearchIndex = { entries: SearchHit[] };

export type SearchSources = {
  labels: { text: string; kind: string; x: number; y: number }[];
  streets: Street[];
  pois: MapPoi[];
  loot: RoomLoot;
  /** Category → display label (e.g. weapons → "Weapons & ammo"). */
  categoryLabels: Record<Category, string>;
  /** Every sub-group: id (`category:sub`) + label. */
  subGroups: { id: string; label: string }[];
  /** A POI's sub-group ids (from the filter definitions). */
  poiSubIds: (poi: MapPoi) => string[];
};

/** Results per kind, in display order. */
export const KIND_ORDER: SearchKind[] = ["town", "street", "store", "category", "group", "item"];
const PER_KIND = 5;

export function buildSearchIndex(sources: SearchSources): SearchIndex {
  const { labels, streets, pois, loot, categoryLabels, subGroups, poiSubIds } = sources;
  const entries: SearchHit[] = [];
  const plural = (count: number, one: string, many: string) =>
    `${count.toLocaleString()} ${count === 1 ? one : many}`;

  // Towns and named areas (water too: "Lake …").
  const seenTowns = new Set<string>();
  for (const label of labels) {
    if (!["town", "area", "water"].includes(label.kind)) continue;
    const key = `town:${label.text.toLowerCase()}`;
    if (seenTowns.has(key)) continue;
    seenTowns.add(key);
    entries.push({
      kind: "town",
      key,
      label: titleCase(label.text),
      detail: label.kind === "town" ? "Town" : label.kind === "water" ? "Water" : "Area",
      count: 0,
      point: { x: label.x, y: label.y },
    });
  }

  // Streets: one entry per name, framing every stretch with that name.
  const streetBounds = new Map<string, Bounds>();
  for (const street of streets) {
    if (!street.name.trim() || street.points.length === 0) continue;
    const previous = streetBounds.get(street.name);
    let bounds = previous ?? { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const point of street.points) {
      bounds = {
        minX: Math.min(bounds.minX, point.x),
        minY: Math.min(bounds.minY, point.y),
        maxX: Math.max(bounds.maxX, point.x),
        maxY: Math.max(bounds.maxY, point.y),
      };
    }
    streetBounds.set(street.name, bounds);
  }
  for (const [name, bounds] of streetBounds) {
    entries.push({
      kind: "street",
      key: `street:${name.toLowerCase()}`,
      label: name,
      detail: "Street",
      count: 0,
      bounds,
    });
  }

  // Store / room types, by display name (several raw room types can share one).
  const stores = new Map<string, { rawNames: Set<string>; count: number; category: Category }>();
  for (const poi of pois) {
    const store = stores.get(poi.name) ?? {
      rawNames: new Set<string>(),
      count: 0,
      category: poi.categories[0],
    };
    store.rawNames.add(poi.rawName.toLowerCase());
    store.count += 1;
    stores.set(poi.name, store);
  }
  for (const [name, store] of stores) {
    entries.push({
      kind: "store",
      key: `store:${name.toLowerCase()}`,
      label: name,
      detail: plural(store.count, "place", "places"),
      count: store.count,
      rawNames: [...store.rawNames],
      category: store.category,
    });
  }

  // Loot categories and their sub-groups.
  for (const category of Object.keys(categoryLabels) as Category[]) {
    const count = pois.filter((poi) => poi.categories.includes(category)).length;
    if (count === 0) continue;
    entries.push({
      kind: "category",
      key: `category:${category}`,
      label: categoryLabels[category],
      detail: plural(count, "place", "places"),
      count,
      category,
    });
  }
  const subCounts = new Map<string, number>();
  for (const poi of pois) {
    for (const id of poiSubIds(poi)) subCounts.set(id, (subCounts.get(id) ?? 0) + 1);
  }
  for (const group of subGroups) {
    const count = subCounts.get(group.id) ?? 0;
    if (count === 0 || group.id.endsWith(":other")) continue;
    entries.push({
      kind: "group",
      key: `group:${group.id}`,
      label: group.label,
      detail: plural(count, "place", "places"),
      count,
      subId: group.id,
    });
  }

  // Specific loot: the room types whose loot tables list the item, split into "likely" (a top find
  // there) and "possible" (deep in the list). Several item ids sharing a display name are merged.
  const poiRoomTypes = new Map<string, number>();
  for (const poi of pois) {
    const raw = poi.rawName.toLowerCase();
    poiRoomTypes.set(raw, (poiRoomTypes.get(raw) ?? 0) + 1);
  }
  const items = new Map<string, { likely: Set<string>; possible: Set<string> }>();
  for (const [roomType, list] of Object.entries(loot)) {
    // Lists are sorted most-likely first; the LIKELY_RANK-th weight is this room's cut-off.
    const cutoff = list.length > LIKELY_RANK ? list[LIKELY_RANK - 1].weight : -Infinity;
    for (const { item, weight } of list) {
      const name = prettyItem(item);
      const entry = items.get(name) ?? { likely: new Set<string>(), possible: new Set<string>() };
      (weight >= cutoff ? entry.likely : entry.possible).add(roomType);
      items.set(name, entry);
    }
  }
  const placesIn = (rooms: Iterable<string>) =>
    [...rooms].reduce((total, room) => total + (poiRoomTypes.get(room) ?? 0), 0);
  // Each room type's main category (from its map dots), to colour items by where they're found.
  const roomCategory = new Map<string, Category>();
  for (const poi of pois) {
    const raw = poi.rawName.toLowerCase();
    if (!roomCategory.has(raw)) roomCategory.set(raw, poi.categories[0]);
  }
  /** The category with the most places among these room types (null if none have dots). */
  const mainCategory = (rooms: Iterable<string>): Category | null => {
    const tally = new Map<Category, number>();
    for (const room of rooms) {
      const category = roomCategory.get(room);
      if (category) tally.set(category, (tally.get(category) ?? 0) + (poiRoomTypes.get(room) ?? 0));
    }
    let best: Category | null = null;
    for (const [category, count] of tally) {
      if (best === null || count > (tally.get(best) ?? 0)) best = category;
    }
    return best;
  };
  for (const [name, { likely, possible }] of items) {
    likely.forEach((room) => possible.delete(room)); // likely somewhere wins over possible there
    const anywhere = likely.has(ANYWHERE_ROOM) || possible.has(ANYWHERE_ROOM);
    const likelyPlaces = placesIn(likely);
    // "Anywhere" items are possible in every place that isn't already likely.
    const possiblePlaces = anywhere ? pois.length - likelyPlaces : placesIn(possible);
    if (likelyPlaces + possiblePlaces === 0) continue; // only in rooms with no map dots
    entries.push({
      kind: "item",
      key: `item:${name.toLowerCase()}`,
      label: name,
      detail:
        likelyPlaces > 0
          ? `likely in ${plural(likelyPlaces, "place", "places")}`
          : `possible in ${plural(possiblePlaces, "place", "places")}`,
      count: likelyPlaces,
      roomTypes: [...likely],
      possibleRoomTypes: [...possible],
      anywhere,
      possibleCount: possiblePlaces,
      category: mainCategory(likely) ?? mainCategory(possible),
    });
  }

  return { entries };
}

/** Best matches for `query`, grouped by kind (at most PER_KIND each), in KIND_ORDER. */
export function searchIndex(index: SearchIndex, query: string): { kind: SearchKind; hits: SearchHit[] }[] {
  const needle = normalise(query);
  if (needle.length < 2) return [];
  const scored = new Map<SearchKind, { hit: SearchHit; score: number }[]>();
  for (const hit of index.entries) {
    const score = matchScore(normalise(hit.label), needle);
    if (score === null) continue;
    const list = scored.get(hit.kind) ?? [];
    list.push({ hit, score });
    scored.set(hit.kind, list);
  }
  return KIND_ORDER.flatMap((kind) => {
    const list = scored.get(kind);
    if (!list) return [];
    // Best match first; among equals, the one found in more places, then the shorter name.
    list.sort(
      (a, b) =>
        a.score - b.score ||
        b.hit.count - a.hit.count ||
        a.hit.label.length - b.hit.label.length ||
        a.hit.label.localeCompare(b.hit.label),
    );
    return [{ kind, hits: list.slice(0, PER_KIND).map((entry) => entry.hit) }];
  });
}

/**
 * The places a hit highlights, in two tiers: `likely` (ringed on the map) and, for loot, `possible`
 * (plain dots, shown when "All" is on). Towns and streets match nothing (they fly instead).
 */
export function matchTiers(
  hit: SearchHit,
  pois: MapPoi[],
  poiSubIds: (poi: MapPoi) => string[],
): { likely: MapPoi[]; possible: MapPoi[] } {
  if (hit.kind !== "item") return { likely: matchingPois(hit, pois, poiSubIds), possible: [] };
  const likelyRooms = new Set(hit.roomTypes);
  const possibleRooms = new Set(hit.possibleRoomTypes);
  const likely: MapPoi[] = [];
  const possible: MapPoi[] = [];
  for (const poi of pois) {
    const room = poi.rawName.toLowerCase();
    if (likelyRooms.has(room)) likely.push(poi);
    else if (hit.anywhere || possibleRooms.has(room)) possible.push(poi);
  }
  return { likely, possible };
}

/**
 * The room POIs a hit highlights (empty for towns and streets, which fly instead). For items, only
 * the "likely" places unless `includePossible`.
 */
export function matchingPois(
  hit: SearchHit,
  pois: MapPoi[],
  poiSubIds: (poi: MapPoi) => string[],
  includePossible = false,
): MapPoi[] {
  if (hit.kind === "item") {
    const { likely, possible } = matchTiers(hit, pois, poiSubIds);
    return includePossible ? [...likely, ...possible] : likely;
  }
  switch (hit.kind) {
    case "store": {
      const raw = new Set(hit.rawNames);
      return pois.filter((poi) => raw.has(poi.rawName.toLowerCase()));
    }
    case "category":
      return pois.filter((poi) => poi.categories.includes(hit.category));
    case "group":
      return pois.filter((poi) => poiSubIds(poi).includes(hit.subId));
    default:
      return [];
  }
}

/**
 * The left-panel category a hit belongs to (its colour is used for the hit's dot): loot items take
 * the category of the places they're mostly found in. Null for towns and streets.
 */
export function hitCategory(hit: SearchHit): Category | null {
  if (hit.kind === "category" || hit.kind === "store" || hit.kind === "item") return hit.category;
  if (hit.kind === "group") return hit.subId.slice(0, hit.subId.indexOf(":")) as Category;
  return null;
}

/** `Base.CannedBeans` → `Canned Beans`. */
export function prettyItem(id: string): string {
  const bare = id.includes(".") ? id.slice(id.indexOf(".") + 1) : id;
  return bare
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
}

/**
 * Lower is better: 0 exact, 1 starts with, 2 a word starts with, 3 contains; null = no match.
 * Every word of a multi-word query must appear.
 */
function matchScore(text: string, needle: string): number | null {
  if (text === needle) return 0;
  if (text.startsWith(needle)) return 1;
  const words = needle.split(" ");
  if (!words.every((word) => text.includes(word))) return null;
  if (` ${text}`.includes(` ${needle}`)) return 2;
  return 3;
}

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** "WEST POINT" → "West Point" (town labels are stored upper-case). */
function titleCase(text: string): string {
  return text === text.toUpperCase()
    ? text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    : text;
}
