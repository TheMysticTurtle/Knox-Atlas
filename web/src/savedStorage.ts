// Persistence for user-saved places, paths and the saved map view.
//
// This is the RELEASED 0.1.x STORAGE CONTRACT: the same localStorage keys, record shapes, limits and
// validation rules as `legacy/src/main.ts`, so existing users' saved items appear after the update.
// (Same Tauri v2 runtime + same identifier `com.pzcompanion.map` → same WebView storage origin.)
// Change a shape only with a versioned key and a migration — never in place.
//
// Self-contained on purpose (type-only imports): the parse functions run under the Node test runner.

import type {
  MarkerColor,
  NavStop,
  Point,
  SavedFilter,
  SavedGroup,
  SavedLayout,
  SavedMarker,
  SavedPath,
  SavedSection,
  SavedView,
} from "./engine/types";

export const STORAGE_KEYS = {
  markers: "knox-atlas.custom-markers.v1",
  paths: "knox-atlas.saved-paths.v1",
  view: "knox-atlas.saved-map-view.v1",
  /** Newer (not in 0.1.x): Your-map groups and collapsed sections. */
  layout: "knox-atlas.your-map.v1",
  /** Newer (not in 0.1.x): saved search filters. */
  filters: "knox-atlas.saved-filters.v1",
} as const;

/**
 * Released limits, plus the newer optional route fields: `routeStops` numbered stops and
 * `routeBends` dragged bends stored with a saved route.
 */
export const LIMITS = {
  markers: 100,
  paths: 50,
  pathPoints: 250,
  label: 40,
  routeStops: 25,
  routeBends: 35,
  groups: 60,
  filters: 30,
} as const;

export const SECTIONS: readonly SavedSection[] = ["places", "routes", "paths"];

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
      return name ? [{ id, label: name, color: toColor(value.color), x, y, ...organised(value) }] : [];
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
      const path: SavedPath = {
        id,
        label: name,
        color: toColor(value.color),
        points: valid,
        ...organised(value),
      };
      const stops = parseStops(value.stops);
      if (stops) path.stops = stops;
      return [path];
    })
    .slice(0, LIMITS.paths);
}

/**
 * A route's stops: each `{ point: {x, y}, label, via? }`. Invalid entries are dropped, numbered stops
 * and bends are capped separately, and null is returned unless at least two numbered stops remain.
 */
function parseStops(value: unknown): NavStop[] | null {
  if (!Array.isArray(value)) return null;
  let numbered = 0;
  let bends = 0;
  const stops = value.flatMap((stop): NavStop[] => {
    if (!isRecord(stop) || typeof stop.label !== "string") return [];
    const [point] = toPoint(stop.point);
    if (!point) return [];
    if (stop.via === true) {
      return ++bends <= LIMITS.routeBends ? [{ point, label: "", via: true }] : [];
    }
    if (++numbered > LIMITS.routeStops) return [];
    return [{ point, label: stop.label.trim().slice(0, LIMITS.label) || `${point.x}, ${point.y}` }];
  });
  return Math.min(numbered, LIMITS.routeStops) >= 2 ? stops : null;
}

function toPoint(value: unknown): Point[] {
  return isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y)
    ? [{ x: value.x, y: value.y }]
    : [];
}

/** Your-map layout: valid, uniquely-identified groups and collapsed sections. */
export function parseLayout(raw: string | null): SavedLayout {
  let value: unknown;
  try {
    value = JSON.parse(raw ?? "null");
  } catch {
    value = null;
  }
  if (!isRecord(value)) return { groups: [], collapsed: [] };
  const seen = new Set<string>();
  const groups = (Array.isArray(value.groups) ? value.groups : [])
    .flatMap((group): SavedGroup[] => {
      if (!isRecord(group) || typeof group.id !== "string" || typeof group.name !== "string") return [];
      const name = cleanLabel(group.name);
      const section = SECTIONS.find((item) => item === group.section);
      if (!name || !section || seen.has(group.id)) return [];
      seen.add(group.id);
      return [{ id: group.id, name, section, ...(group.collapsed === true ? { collapsed: true } : {}) }];
    })
    .slice(0, LIMITS.groups);
  const collapsed = SECTIONS.filter(
    (section) => Array.isArray(value.collapsed) && value.collapsed.includes(section),
  );
  return { groups, collapsed };
}

/** Saved search filters: valid, unique by search key, capped. */
export function parseFilters(raw: string | null): SavedFilter[] {
  const seen = new Set<string>();
  return parseArray(raw)
    .flatMap((value): SavedFilter[] => {
      if (!isRecord(value)) return [];
      const { id, key, label } = value;
      if (typeof id !== "string" || typeof key !== "string" || typeof label !== "string") return [];
      const name = cleanLabel(label);
      if (!key || !name || seen.has(key)) return [];
      seen.add(key);
      return [
        {
          id,
          key,
          label: name,
          ...(value.all === true ? { all: true } : {}),
          ...(value.hidden === true ? { hidden: true } : {}),
        },
      ];
    })
    .slice(0, LIMITS.filters);
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

export function loadSaved(): {
  markers: SavedMarker[];
  paths: SavedPath[];
  view?: SavedView;
  layout: SavedLayout;
  filters: SavedFilter[];
} {
  return {
    markers: parseMarkers(read(STORAGE_KEYS.markers)),
    paths: parsePaths(read(STORAGE_KEYS.paths)),
    view: parseView(read(STORAGE_KEYS.view)),
    layout: parseLayout(read(STORAGE_KEYS.layout)),
    filters: parseFilters(read(STORAGE_KEYS.filters)),
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

/** The optional group/hidden fields, only when present and valid (records stay minimal). */
function organised(value: Record<string, unknown>): { group?: string; hidden?: boolean } {
  return {
    ...(typeof value.group === "string" && value.group ? { group: value.group.slice(0, 64) } : {}),
    ...(value.hidden === true ? { hidden: true } : {}),
  };
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
