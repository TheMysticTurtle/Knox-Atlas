import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import { pathLength, simplifyPath } from "../src/engine/geometry.ts";
import {
  SNAP_DISTANCE,
  buildRoadGraph,
  findRoute,
  planTrip,
  stopTag,
  tripPolyline,
} from "../src/engine/roadGraph.ts";
import type { GameSnapshot, Street } from "../src/engine/types.ts";

const street = (name: string, ...coords: [number, number][]): Street => ({
  name,
  width: 8,
  points: coords.map(([x, y]) => ({ x, y })),
});

function route(streets: Street[], from: [number, number], to: [number, number]) {
  return findRoute(buildRoadGraph(streets), { x: from[0], y: from[1] }, { x: to[0], y: to[1] });
}

test("streets that cross mid-segment are joined at the crossing", () => {
  // A plus sign: Main St runs west-east, Oak St north-south; they share no vertex.
  const result = route(
    [street("Main St", [0, 100], [200, 100]), street("Oak St", [100, 0], [100, 200])],
    [0, 100],
    [100, 0],
  );
  assert.ok(result.ok);
  assert.equal(Math.round(result.route.roadLength), 200); // 100 east + 100 north
  assert.deepEqual(result.route.streets, ["Main St", "Oak St"]);
  assert.equal(result.route.offRoadLength, 0);
});

test("a street ending within the snap distance of another is joined (T-junction)", () => {
  const gap = SNAP_DISTANCE - 4;
  const result = route(
    [street("Main St", [0, 0], [200, 0]), street("Side St", [100, gap], [100, 150])],
    [0, 0],
    [100, 150],
  );
  assert.ok(result.ok);
  assert.equal(Math.round(result.route.roadLength), 100 + gap + 150 - gap);
  assert.deepEqual(result.route.streets, ["Main St", "Side St"]);
});

test("a street ending beyond the snap distance stays disconnected", () => {
  const result = route(
    [street("Main St", [0, 0], [200, 0]), street("Far St", [100, SNAP_DISTANCE + 20], [100, 150])],
    [0, 0],
    [100, 150],
  );
  assert.deepEqual(result, { ok: false, reason: "unreachable" });
});

test("a street that loops back near itself is joined to itself (Scenic Grove Road case)", () => {
  // One street: from the highway west along the bottom, up, back east, then down — ending 3 tiles
  // above its own bottom stretch. Driving from the end to the highway must take that 3-tile gap.
  const loop = street("Loop Rd", [200, 100], [0, 100], [0, 0], [100, 0], [100, 97]);
  const result = route([loop], [100, 90], [200, 100]);
  assert.ok(result.ok);
  assert.ok(result.route.roadLength < 120, `took the short way (${Math.round(result.route.roadLength)} tiles)`);
});

test("off-road ends walk straight to the nearest street", () => {
  const result = route([street("Main St", [0, 0], [200, 0])], [20, 30], [180, -40]);
  assert.ok(result.ok);
  assert.equal(result.route.offRoadLength, 70);
  assert.equal(Math.round(result.route.roadLength), 160);
  assert.deepEqual(result.route.startLeg, [{ x: 20, y: 30 }, { x: 20, y: 0 }]);
});

test("picks the shorter of two ways around", () => {
  // A rectangle block: going right-then-down (300) beats down-then-right via the long side (700).
  const result = route(
    [
      street("Top", [0, 0], [200, 0]),
      street("Right", [200, 0], [200, 100]),
      street("Left", [0, 0], [0, 300]),
      street("Bottom", [0, 300], [400, 300], [400, 100], [200, 100]),
    ],
    [0, 0],
    [200, 100],
  );
  assert.ok(result.ok);
  assert.equal(Math.round(result.route.roadLength), 300);
  assert.deepEqual(result.route.streets, ["Top", "Right"]);
});

test("start and end on the same street segment", () => {
  const result = route([street("Main St", [0, 0], [500, 0])], [100, 0], [300, 0]);
  assert.ok(result.ok);
  assert.equal(Math.round(result.route.roadLength), 200);
});

test("a trip goes through every stop in order", () => {
  const graph = buildRoadGraph([street("Main St", [0, 0], [300, 0]), street("Oak St", [150, 0], [150, 200])]);
  const result = planTrip(graph, [
    { x: 0, y: 0 },
    { x: 150, y: 200 }, // detour up Oak St…
    { x: 300, y: 0 }, // …then back down and on to the end of Main St
  ]);
  assert.ok(result.ok);
  assert.equal(result.trip.legs.length, 2);
  assert.equal(Math.round(result.trip.roadLength), 150 + 200 + 200 + 150);
  assert.deepEqual(result.trip.streets, ["Main St", "Oak St", "Main St"]);
  const line = tripPolyline(result.trip);
  assert.deepEqual(line[0], { x: 0, y: 0 });
  assert.deepEqual(line.at(-1), { x: 300, y: 0 });
});

test("a trip reports which leg can't be reached", () => {
  const graph = buildRoadGraph([street("Main St", [0, 0], [100, 0]), street("Island Rd", [0, 500], [100, 500])]);
  const result = planTrip(graph, [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 500 },
  ]);
  assert.deepEqual(result, { ok: false, reason: "unreachable", leg: 1 });
});

test("stops are labelled Start, 1, 2…, End in the order they were added", () => {
  assert.deepEqual([0].map((i) => stopTag(i, 1)), ["Start"]);
  assert.deepEqual([0, 1].map((i) => stopTag(i, 2)), ["Start", "End"]);
  assert.deepEqual([0, 1, 2, 3].map((i) => stopTag(i, 4)), ["Start", "1", "2", "End"]);
});

test("no streets at all is reported, not thrown", () => {
  assert.deepEqual(route([], [0, 0], [10, 10]), { ok: false, reason: "no-roads" });
});

test("simplifying keeps the ends and respects the point limit", () => {
  const wiggly = Array.from({ length: 1000 }, (_, i) => ({ x: i, y: (i % 2) * 0.1 + i * 0.5 }));
  const simplified = simplifyPath(wiggly, 250);
  assert.ok(simplified.length <= 250);
  assert.deepEqual(simplified[0], wiggly[0]);
  assert.deepEqual(simplified.at(-1), wiggly.at(-1));
  assert.ok(Math.abs(pathLength(simplified) - pathLength(wiggly)) / pathLength(wiggly) < 0.01);
});

const snapshotPath = new URL("../public/snapshot.json", import.meta.url);

test("routes between real towns on the installed map", { skip: !existsSync(snapshotPath) }, () => {
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as GameSnapshot;
  const started = performance.now();
  const graph = buildRoadGraph(snapshot.streets);
  const buildMs = performance.now() - started;
  const town = (name: string) => {
    const label = snapshot.labels.find((item) => item.kind === "town" && item.text.toLowerCase() === name);
    assert.ok(label, `town label "${name}" present`);
    return { x: label.x, y: label.y };
  };
  const from = town("muldraugh");
  const to = town("west point");
  const routeStarted = performance.now();
  const result = findRoute(graph, from, to);
  const routeMs = performance.now() - routeStarted;
  assert.ok(result.ok, "Muldraugh → West Point is reachable by road");
  const straight = Math.hypot(to.x - from.x, to.y - from.y);
  assert.ok(result.route.roadLength >= straight * 0.9, "road distance is not shorter than straight-line");
  assert.ok(result.route.roadLength < straight * 2.5, "road distance is plausible");
  assert.ok(result.route.streets.length > 0);
  console.log(
    `  graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges in ${buildMs.toFixed(0)} ms; ` +
      `Muldraugh→West Point ${Math.round(result.route.roadLength)} tiles by road ` +
      `(${Math.round(straight)} straight) in ${routeMs.toFixed(1)} ms via ${result.route.streets.join(" → ")}`,
  );
});
