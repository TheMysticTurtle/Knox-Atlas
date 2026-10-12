import assert from "node:assert/strict";
import { test } from "node:test";

import {
  countBends,
  countNumbered,
  insertBend,
  legTags,
  moveNumbered,
  numberedIndices,
  removeAt,
  rerouteCount,
  stopTag,
  tagAt,
} from "../src/engine/stops.ts";
import type { NavStop } from "../src/engine/types.ts";

const stop = (label: string): NavStop => ({ point: { x: label.charCodeAt(0), y: 0 }, label });
const bend = (x: number): NavStop => ({ point: { x, y: 9 }, label: "", via: true });
const labels = (stops: NavStop[]) => stops.map((item) => (item.via ? `~${item.point.x}` : item.label));

test("numbered labels skip bends", () => {
  const stops = [stop("a"), bend(1), stop("b"), bend(2), bend(3), stop("c")];
  assert.deepEqual(numberedIndices(stops), [0, 2, 5]);
  assert.deepEqual(stops.map((_, i) => tagAt(stops, i)), ["Start", "", "1", "", "", "End"]);
  assert.equal(stopTag(0, 1), "Start");
  assert.equal(countNumbered(stops), 3);
  assert.equal(countBends(stops), 3);
});

test("a leg through bends is named by the numbered stops around it", () => {
  const stops = [stop("a"), bend(1), stop("b"), stop("c")];
  assert.deepEqual(legTags(stops, 0), ["Start", "1"]); // a → bend
  assert.deepEqual(legTags(stops, 1), ["Start", "1"]); // bend → b
  assert.deepEqual(legTags(stops, 2), ["1", "End"]);
});

test("dragging the line inserts a bend into that leg", () => {
  const stops = insertBend([stop("a"), stop("b")], 1, { x: 50, y: 50 });
  assert.deepEqual(labels(stops), ["a", "~50", "b"]);
  assert.equal(stops[1].via, true);
});

test("reordering swaps numbered stops and drops the bends between them", () => {
  const stops = [stop("a"), bend(1), stop("b"), bend(2), stop("c")];
  assert.deepEqual(labels(moveNumbered(stops, 2, 1)), ["a", "~1", "c", "b"]);
  assert.deepEqual(labels(moveNumbered(stops, 2, -1)), ["b", "a", "~2", "c"]);
  assert.deepEqual(labels(moveNumbered(stops, 0, -1)), labels(stops), "first can't move earlier");
});

test("removing a stop keeps bends that still sit between numbered stops", () => {
  const stops = [stop("a"), bend(1), stop("b"), bend(2), stop("c")];
  assert.deepEqual(labels(removeAt(stops, 2)), ["a", "~1", "~2", "c"]);
  assert.deepEqual(labels(removeAt(stops, 4)), ["a", "~1", "b"], "dangling bend after the end dropped");
  assert.deepEqual(labels(removeAt(stops, 1)), ["a", "b", "~2", "c"], "removing a bend");
  assert.deepEqual(removeAt([stop("a")], 0), []);
});

test("bends read as re-routes on screen", () => {
  assert.equal(rerouteCount(1), "1 re-route");
  assert.equal(rerouteCount(3), "3 re-routes");
});
