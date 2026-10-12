import { create } from "zustand";

import type { SearchHit } from "./engine/search";
import { countBends, countNumbered, insertBend, moveNumbered, removeAt } from "./engine/stops";
import type { Bounds, NavStop, Point, SavedPath, Selection } from "./engine/types";
import { LIMITS } from "./savedStorage";

/** A request for the map to frame these bounds; `nonce` makes repeat requests fire again. */
export type FocusRequest = { bounds: Bounds; nonce: number };

/**
 * The search currently shown in the search box (not yet saved as a filter). `all` includes
 * "possible" places for loot (otherwise only "likely" ones).
 */
export type CurrentSearch = { hit: SearchHit; all: boolean };

/** Most numbered stops / dragged bends a trip can have — the same limits a saved route stores. */
export const MAX_STOPS = LIMITS.routeStops;
export const MAX_BENDS = LIMITS.routeBends;

/**
 * Transient map interaction state shared by the map and the panels. React decides what a map click
 * means here (add a Navigate stop, add a measure point, or select); the engine only reports clicks
 * and draws.
 */
type MapUiState = {
  selection: Selection | null;
  /** True while map clicks add measure points instead of selecting. */
  measuring: boolean;
  measurement: Point[];
  focus: FocusRequest | null;

  /**
   * Navigate: panel open; stops in trip order (first numbered = Start, last = End), with dragged
   * bends (`via`) between the stops of the leg they shape.
   */
  navOpen: boolean;
  navStops: NavStop[];
  /** True while map clicks append Navigate stops. */
  addingStops: boolean;
  /** The stop whose next map click moves it (🎯), if any. */
  movingStop: number | null;
  /** The saved route currently open in Navigate (re-saving updates it), if any. */
  openRouteId: string | null;

  /** 🔍 Search: the current (unsaved) search, highlighted alongside any shown saved filters. */
  currentSearch: CurrentSearch | null;

  select: (selection: Selection | null) => void;
  /** Start measuring, optionally from a first point. Clears the selection. */
  startMeasure: (from?: Point) => void;
  addMeasurePoint: (point: Point) => void;
  undoMeasurePoint: () => void;
  /** Stop adding points; the line stays visible until cleared or saved. */
  finishMeasure: () => void;
  clearMeasure: () => void;
  /** Frame a point (zooms in to street level) or a whole path's bounds. */
  focusOn: (bounds: Bounds) => void;

  toggleNav: () => void;
  setAddingStops: (adding: boolean) => void;
  /** Add a stop at the end of the trip (the new End). */
  appendStop: (stop: NavStop) => void;
  updateStop: (index: number, stop: NavStop) => void;
  /** Remove a stop or a bend (indices are into the full list, bends included). */
  removeStop: (index: number) => void;
  /** Swap a numbered stop with the previous (-1) or next (+1) numbered stop. */
  moveStop: (index: number, direction: -1 | 1) => void;
  /** Dragging the route line: add a bend at `index`. Returns false at the bend limit. */
  addBend: (index: number, point: Point) => boolean;
  /** Dragging a stop or bend: move it (a dragged stop is renamed to its new coordinates). */
  dragStop: (index: number, point: Point) => void;
  /** 🎯: the next map click relocates this stop (null cancels). */
  startMovingStop: (index: number | null) => void;
  /** Relocate the stop being moved to where the map was clicked. */
  placeMovingStop: (stop: NavStop) => void;
  clearStops: () => void;
  /** Open a saved route in Navigate (its stops become editable). */
  openRoute: (route: SavedPath) => void;
  /** The open route was saved as / became this saved path (or was deleted: null). */
  setOpenRoute: (id: string | null) => void;

  /** Show a search result (null clears the current search). */
  setCurrentSearch: (hit: SearchHit | null) => void;
  /** Include "possible" places for the current loot search, or only "likely" ones. */
  toggleCurrentAll: () => void;
};

export const useMapUi = create<MapUiState>((set, get) => ({
  selection: null,
  measuring: false,
  measurement: [],
  focus: null,
  navOpen: false,
  navStops: [],
  addingStops: false,
  movingStop: null,
  openRouteId: null,
  currentSearch: null,

  select: (selection) => set({ selection }),

  startMeasure: (from) =>
    set({
      measuring: true,
      measurement: from ? [from] : [],
      selection: null,
      addingStops: false,
      movingStop: null,
    }),

  addMeasurePoint: (point) => {
    const { measurement } = get();
    if (measurement.length >= LIMITS.pathPoints) return;
    set({ measurement: [...measurement, point] });
  },

  undoMeasurePoint: () => set({ measurement: get().measurement.slice(0, -1) }),

  finishMeasure: () => set({ measuring: false }),

  clearMeasure: () => set({ measuring: false, measurement: [] }),

  focusOn: (bounds) => set({ focus: { bounds, nonce: (get().focus?.nonce ?? 0) + 1 } }),

  toggleNav: () => set({ navOpen: !get().navOpen, addingStops: false, movingStop: null }),

  setAddingStops: (adding) =>
    set(
      adding
        ? { addingStops: true, movingStop: null, measuring: false, selection: null }
        : { addingStops: false },
    ),

  appendStop: (stop) => {
    const { navStops } = get();
    if (countNumbered(navStops) >= MAX_STOPS) return;
    const next = [...navStops, stop];
    set({ navStops: next, addingStops: countNumbered(next) < MAX_STOPS });
  },

  updateStop: (index, stop) => set({ navStops: get().navStops.map((item, i) => (i === index ? stop : item)) }),

  removeStop: (index) => set({ navStops: removeAt(get().navStops, index), movingStop: null }),

  moveStop: (index, direction) =>
    set({ navStops: moveNumbered(get().navStops, index, direction), movingStop: null }),

  addBend: (index, point) => {
    const { navStops } = get();
    if (countBends(navStops) >= MAX_BENDS) return false;
    set({ navStops: insertBend(navStops, index, point), movingStop: null, addingStops: false });
    return true;
  },

  dragStop: (index, point) =>
    set({
      navStops: get().navStops.map((stop, i) =>
        i !== index
          ? stop
          : stop.via
            ? { ...stop, point }
            : { point, label: `${Math.round(point.x)}, ${Math.round(point.y)}` },
      ),
    }),

  startMovingStop: (index) =>
    set(
      index === null
        ? { movingStop: null }
        : { movingStop: index, addingStops: false, measuring: false, selection: null },
    ),

  placeMovingStop: (stop) => {
    const { movingStop, navStops } = get();
    if (movingStop === null) return;
    set({ navStops: navStops.map((item, i) => (i === movingStop ? stop : item)), movingStop: null });
  },

  clearStops: () => set({ navStops: [], addingStops: false, movingStop: null, openRouteId: null }),

  openRoute: (route) =>
    set({
      navOpen: true,
      navStops: (route.stops ?? []).map((stop) => ({ ...stop, point: { ...stop.point } })),
      openRouteId: route.id,
      addingStops: false,
      movingStop: null,
      measuring: false,
      selection: null,
    }),

  setOpenRoute: (id) => set({ openRouteId: id }),

  setCurrentSearch: (hit) => set({ currentSearch: hit ? { hit, all: false } : null }),

  toggleCurrentAll: () => {
    const { currentSearch } = get();
    if (currentSearch) set({ currentSearch: { ...currentSearch, all: !currentSearch.all } });
  },
}));

/** Bounds for a single point (the engine zooms to street level for these). */
export function pointFocus(point: Point): Bounds {
  return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
}
