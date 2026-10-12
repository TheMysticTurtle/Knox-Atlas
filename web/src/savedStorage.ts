// Persistence for user-saved places, paths and the saved map view.
//
// This is the RELEASED 0.1.x STORAGE CONTRACT: the same localStorage keys, record shapes, limits and
// validation rules as `legacy/src/main.ts`, so existing users' saved items appear after the update.
// (Same Tauri v2 runtime + same identifier `com.pzcompanion.map` → same WebView storage origin.)
// Change a shape only with a versioned key and a migration — never in place.
//
// Self-contained on purpose (type-only imports): the parse functions run under the Node test runner.

import type { MarkerColor, NavStop, Point, SavedMarker, SavedPath, SavedView } from "./engine/types";

export const STORAGE_KEYS = {
  markers: "knox-atlas.custom-markers.v1",
  paths: "knox-atlas.saved-paths.v1",
  view: "knox-atlas.saved-map-view.v1",
} as const;

/** Released limits, plus `routeStops` for the (newer, optional) stops stored with a saved route. */
export const LIMITS = { markers: 100, paths: 50, pathPoints: 250, label: 40, routeStops: 25 } as const;

/** Allowed colour names, in picker order. Must match `markerColors` (checked by a unit test). */
export const MARKER_COLORS: readonly MarkerColor[] = [
  "amber",
  "teal",
  "red",
  "blue",
  "violet",
  "green",
  "white",
];

/** The released format accepted saved zoom only within the camera's range. */
const VIEW_SCALE_RANGE = { min: 0.022, max: 3.2 } as const;

// --- parsing (pure) -----------------------------------------------------------

/** Parse stored markers; invalid entries are dropped, never thrown. */
export function parseMarkers(raw: string | null): SavedMarker[] {
  return parseArray(raw)
    .flatMap((value): SavedMarker[] => {
      if (!isRecord(value)) return [];
      const { id, label, x, y } = value;
      if (typeof id !== "string" || typeof label !== "string") return [];
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) return [];
      const name = cleanLabel(label);
      return name ? [{ id, label: name, color: toColor(value.color), x, y }] : [];
    })
    .slice(0, LIMITS.markers);
}

/**
 * Parse stored paths; a path needs a name and at least two valid points. Optional `stops` (a saved
 * route) are kept when at least two are valid; otherwise the path loads as a plain line.
 */
export function parsePaths(raw: string | null): SavedPath[] {
  return parseArray(raw)
    .flatMap((value): SavedPath[] => {
      if (!isRecord(value)) return [];
      const { id, label, points } = value;
      if (typeof id !== "string" || typeof label !== "string" || !Array.isArray(points)) return [];
      const name = cleanLabel(label);
      const valid = points.flatMap(toPoint).slice(0, LIMITS.pathPoints);
      if (!name || valid.length < 2) return [];
      const path: SavedPath = { id, label: name, color: toColor(value.color), points: valid };
      const stops = parseStops(value.stops);
      if (stops) path.stops = stops;
      return [path];
    })
    .slice(0, LIMITS.paths);
}

/** A route's stops: each `{ point: {x, y}, label }`; invalid ones dropped; null if < 2 remain. */
function parseStops(value: unknown): NavStop[] | null {
  if (!Array.isArray(value)) return null;
  const stops = value
    .flatMap((stop): NavStop[] => {
      if (!isRecord(stop) || typeof stop.label !== "string") return [];
      const [point] = toPoint(stop.point);
      return point ? [{ point, label: stop.label.trim().slice(0, LIMITS.label) || `${point.x}, ${point.y}` }] : [];
    })
    .slice(0, LIMITS.routeStops);
  return stops.length >= 2 ? stops : null;
}

function toPoint(value: unknown): Point[] {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    ? [{ x: value.x, y: value.y }]
    : [];
}

export function parseView(raw: string | null): SavedView | undefined {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!isRecord(value)) return undefined;
    const { x, y, scale } = value;
    if (!isFiniteNumber(x) || !isFiniteNumber(y) || !isFiniteNumber(scale)) return undefined;
    if (scale < VIEW_SCALE_RANGE.min || scale > VIEW_SCALE_RANGE.max) return undefined;
    return { x, y, scale };
  } catch {
    return undefined;
  }
}

/** Trim and cap a user-entered name the same way stored names are read back. */
export function cleanLabel(label: string): string {
  return label.trim().slice(0, LIMITS.label);
}

/** A new record id, in the released format (`<time36>-<random6>`). */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// --- storage I/O (the map stays usable when WebView storage is unavailable) ----

export function loadSaved(): { markers: SavedMarker[]; paths: SavedPath[]; view?: SavedView } {
  return {
    markers: parseMarkers(read(STORAGE_KEYS.markers)),
    paths: parsePaths(read(STORAGE_KEYS.paths)),
    view: parseView(read(STORAGE_KEYS.view)),
  };
}

export function persist(key: keyof typeof STORAGE_KEYS, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
  } catch {
    // Storage full or blocked: keep working for this session.
  }
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

// --- helpers ------------------------------------------------------------------

function parseArray(raw: string | null): unknown[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Unknown or missing colours fall back to amber, as the released app did. */
function toColor(value: unknown): MarkerColor {
  return MARKER_COLORS.find((color) => color === value) ?? "amber";
}
