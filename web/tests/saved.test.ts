import assert from "node:assert/strict";
import { test } from "node:test";

import { markerColors } from "../src/engine/colors.ts";
import { pathLength, pointBounds } from "../src/engine/geometry.ts";
import {
  LIMITS,
  MARKER_COLORS,
  STORAGE_KEYS,
  cleanLabel,
  newId,
  parseMarkers,
  parsePaths,
  parseView,
} from "../src/savedStorage.ts";

test("storage keys are the released 0.1.x keys (existing users' data must load)", () => {
  assert.deepEqual(STORAGE_KEYS, {
    markers: "knox-atlas.custom-markers.v1",
    paths: "knox-atlas.saved-paths.v1",
    view: "knox-atlas.saved-map-view.v1",
  });
  assert.deepEqual(LIMITS, { markers: 100, paths: 50, pathPoints: 250, label: 40 });
});

test("colour names match the palette exactly", () => {
  assert.deepEqual([...MARKER_COLORS].sort(), Object.keys(markerColors).sort());
});

test("reads markers written by the released app", () => {
  // Exactly what 0.1.1 wrote: JSON array of { id, label, color, x, y }.
  const legacy = JSON.stringify([
    { id: "lz3k9a-x1y2z3", label: "Safehouse", color: "teal", x: 10820.4, y: 9650 },
    { id: "lz3k9b-a1b2c3", label: "Gun store run", color: "red", x: 12004, y: 6801 },
  ]);
  assert.deepEqual(parseMarkers(legacy), [
    { id: "lz3k9a-x1y2z3", label: "Safehouse", color: "teal", x: 10820.4, y: 9650 },
    { id: "lz3k9b-a1b2c3", label: "Gun store run", color: "red", x: 12004, y: 6801 },
  ]);
});

test("drops invalid markers, trims names, defaults unknown colours to amber", () => {
  const raw = JSON.stringify([
    { id: "a", label: "  Base  ", color: "pink", x: 1, y: 2 },
    { id: "b", label: "   ", color: "teal", x: 1, y: 2 }, // empty name
    { id: "c", label: "No coords", color: "teal" },
    { id: "d", label: "NaN", color: "teal", x: "1", y: 2 }, // string coordinate
    { label: "No id", color: "teal", x: 1, y: 2 },
    null,
    "junk",
    { id: "e", label: "x".repeat(60), x: 5, y: 6 },
  ]);
  const markers = parseMarkers(raw);
  assert.equal(markers.length, 2);
  assert.deepEqual(markers[0], { id: "a", label: "Base", color: "amber", x: 1, y: 2 });
  assert.equal(markers[1].label.length, LIMITS.label);
});

test("marker parsing survives missing, corrupt and non-array storage", () => {
  assert.deepEqual(parseMarkers(null), []);
  assert.deepEqual(parseMarkers("{not json"), []);
  assert.deepEqual(parseMarkers(JSON.stringify({ id: "a" })), []);
});

test("caps markers at the released limit", () => {
  const many = Array.from({ length: 130 }, (_, i) => ({ id: `${i}`, label: `P${i}`, color: "blue", x: i, y: i }));
  assert.equal(parseMarkers(JSON.stringify(many)).length, LIMITS.markers);
});

test("reads paths written by the released app; needs a name and two valid points", () => {
  const raw = JSON.stringify([
    { id: "p1", label: "Supply run", color: "green", points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
    { id: "p2", label: "One point", color: "green", points: [{ x: 0, y: 0 }] },
    { id: "p3", label: "Bad points", color: "green", points: [{ x: 0, y: 0 }, { x: "1", y: 1 }] },
    { id: "p4", label: "", color: "green", points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] },
  ]);
  assert.deepEqual(parsePaths(raw), [
    { id: "p1", label: "Supply run", color: "green", points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] },
  ]);
});

test("caps path points at the released limit", () => {
  const points = Array.from({ length: 300 }, (_, i) => ({ x: i, y: 0 }));
  const [path] = parsePaths(JSON.stringify([{ id: "p", label: "Long", color: "blue", points }]));
  assert.equal(path.points.length, LIMITS.pathPoints);
});

test("reads a saved view only within the camera's zoom range", () => {
  assert.deepEqual(parseView(JSON.stringify({ x: 100, y: 200, scale: 0.5 })), { x: 100, y: 200, scale: 0.5 });
  assert.equal(parseView(JSON.stringify({ x: 100, y: 200, scale: 9 })), undefined);
  assert.equal(parseView(JSON.stringify({ x: 100, y: 200 })), undefined);
  assert.equal(parseView(null), undefined);
  assert.equal(parseView("garbage"), undefined);
});

test("labels and ids follow the released format", () => {
  assert.equal(cleanLabel("  hi  "), "hi");
  assert.match(newId(), /^[a-z0-9]+-[a-z0-9]{1,6}$/);
});

test("path length and bounds", () => {
  assert.equal(pathLength([{ x: 0, y: 0 }, { x: 3, y: 4 }, { x: 3, y: 10 }]), 11);
  assert.equal(pathLength([{ x: 5, y: 5 }]), 0);
  assert.deepEqual(pointBounds([{ x: 3, y: -1 }, { x: -2, y: 7 }]), { minX: -2, minY: -1, maxX: 3, maxY: 7 });
});
