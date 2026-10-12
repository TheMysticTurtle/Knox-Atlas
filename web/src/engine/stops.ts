// Rules for a Navigate stop list that mixes numbered stops and dragged bends (`via` stops).
// Bends live in the list between the numbered stops whose leg they shape; they are routed through
// but never numbered or listed. Pure and self-contained (type-only imports) for the Node test runner.

import type { NavStop, Point } from "./types";

/** Label for a numbered stop: "Start", 1, 2…, "End" (once there are two). */
export function stopTag(position: number, count: number): string {
  if (position === 0) return "Start";
  if (position === count - 1) return "End";
  return String(position);
}

/** Indices (in the full list) of the numbered stops, in order. */
export function numberedIndices(stops: NavStop[]): number[] {
  return stops.flatMap((stop, index) => (stop.via ? [] : [index]));
}

/** The label of the stop at `index` in the full list ("" for a bend). */
export function tagAt(stops: NavStop[], index: number): string {
  if (stops[index]?.via) return "";
  const numbered = numberedIndices(stops);
  return stopTag(numbered.indexOf(index), numbered.length);
}

/**
 * The numbered stops a routing leg runs between: leg `leg` joins full-list stops `leg` and `leg + 1`,
 * which may be bends — so name the nearest numbered stop on each side (for messages).
 */
export function legTags(stops: NavStop[], leg: number): [string, string] {
  const numbered = numberedIndices(stops);
  const before = [...numbered].reverse().find((index) => index <= leg) ?? numbered[0];
  const after = numbered.find((index) => index >= leg + 1) ?? numbered[numbered.length - 1];
  return [tagAt(stops, before), tagAt(stops, after)];
}

/** Insert a bend at `index` (between the stops of the leg being dragged). */
export function insertBend(stops: NavStop[], index: number, point: Point): NavStop[] {
  const next = [...stops];
  next.splice(index, 0, { point, label: "", via: true });
  return next;
}

/**
 * Swap a numbered stop with the neighbouring numbered stop (direction -1 = earlier, +1 = later).
 * Bends between the two are dropped: they shaped a leg that no longer exists.
 */
export function moveNumbered(stops: NavStop[], index: number, direction: -1 | 1): NavStop[] {
  const numbered = numberedIndices(stops);
  const position = numbered.indexOf(index);
  const other = numbered[position + direction];
  if (position === -1 || other === undefined) return stops;
  const [low, high] = index < other ? [index, other] : [other, index];
  const next = [...stops];
  [next[low], next[high]] = [next[high], next[low]];
  return next.filter((stop, i) => !(stop.via && i > low && i < high));
}

/**
 * Remove the stop at `index`. Removing a numbered stop also drops bends that would be left dangling
 * before the first or after the last numbered stop (they would route nowhere).
 */
export function removeAt(stops: NavStop[], index: number): NavStop[] {
  const next = stops.filter((_, i) => i !== index);
  const numbered = numberedIndices(next);
  if (numbered.length === 0) return [];
  const first = numbered[0];
  const last = numbered[numbered.length - 1];
  return next.filter((stop, i) => !stop.via || (i > first && i < last));
}

export function countNumbered(stops: NavStop[]): number {
  return stops.reduce((count, stop) => count + (stop.via ? 0 : 1), 0);
}

export function countBends(stops: NavStop[]): number {
  return stops.length - countNumbered(stops);
}
