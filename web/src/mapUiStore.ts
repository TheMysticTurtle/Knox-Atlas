import { create } from "zustand";

import type { Bounds, NavStop, Point, SavedPath, Selection } from "./engine/types";
import { LIMITS } from "./savedStorage";

/** A request for the map to frame these bounds; `nonce` makes repeat requests fire again. */
export type FocusRequest = { bounds: Bounds; nonce: number };

/** Most stops a trip can have — the same limit a saved route can store. */
export const MAX_STOPS = LIMITS.routeStops;

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

  /** Navigate: panel open; stops in the order the user made them (first = Start, last = End). */
  navOpen: boolean;
  navStops: NavStop[];
  /** True while map clicks append Navigate stops. */
  addingStops: boolean;
  /** The stop whose next map click moves it (🎯), if any. */
  movingStop: number | null;
  /** The saved route currently open in Navigate (re-saving updates it), if any. */
  openRouteId: string | null;

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
  removeStop: (index: number) => void;
  /** Move a stop one place earlier (-1) or later (+1) in the trip order. */
  moveStop: (index: number, direction: -1 | 1) => void;
  /** 🎯: the next map click relocates this stop (null cancels). */
  startMovingStop: (index: number | null) => void;
  /** Relocate the stop being moved to where the map was clicked. */
  placeMovingStop: (stop: NavStop) => void;
  clearStops: () => void;
  /** Open a saved route in Navigate (its stops become editable). */
  openRoute: (route: SavedPath) => void;
  /** The open route was saved as / became this saved path (or was deleted: null). */
  setOpenRoute: (id: string | null) => void;
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
    if (navStops.length >= MAX_STOPS) return;
    const next = [...navStops, stop];
    set({ navStops: next, addingStops: next.length < MAX_STOPS });
  },

  updateStop: (index, stop) => set({ navStops: get().navStops.map((item, i) => (i === index ? stop : item)) }),

  removeStop: (index) =>
    set({ navStops: get().navStops.filter((_, i) => i !== index), movingStop: null }),

  moveStop: (index, direction) => {
    const target = index + direction;
    const navStops = [...get().navStops];
    if (target < 0 || target >= navStops.length) return;
    [navStops[index], navStops[target]] = [navStops[target], navStops[index]];
    set({ navStops, movingStop: null });
  },

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
      navStops: (route.stops ?? []).map((stop) => ({ point: { ...stop.point }, label: stop.label })),
      openRouteId: route.id,
      addingStops: false,
      movingStop: null,
      measuring: false,
      selection: null,
    }),

  setOpenRoute: (id) => set({ openRouteId: id }),
}));

/** Bounds for a single point (the engine zooms to street level for these). */
export function pointFocus(point: Point): Bounds {
  return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
}
