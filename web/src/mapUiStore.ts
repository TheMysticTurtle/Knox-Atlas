import { create } from "zustand";

import type { Bounds, Point, Selection } from "./engine/types";
import { LIMITS } from "./savedStorage";

/** A request for the map to frame these bounds; `nonce` makes repeat requests fire again. */
export type FocusRequest = { bounds: Bounds; nonce: number };

/**
 * Transient map interaction state shared by the map and the side panel. React decides what a map
 * click means here (select, or add a measure point); the engine only reports clicks and draws.
 */
type MapUiState = {
  selection: Selection | null;
  /** True while map clicks add measure points instead of selecting. */
  measuring: boolean;
  measurement: Point[];
  focus: FocusRequest | null;

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
};

export const useMapUi = create<MapUiState>((set, get) => ({
  selection: null,
  measuring: false,
  measurement: [],
  focus: null,

  select: (selection) => set({ selection }),

  startMeasure: (from) => set({ measuring: true, measurement: from ? [from] : [], selection: null }),

  addMeasurePoint: (point) => {
    const { measurement } = get();
    if (measurement.length >= LIMITS.pathPoints) return;
    set({ measurement: [...measurement, point] });
  },

  undoMeasurePoint: () => set({ measurement: get().measurement.slice(0, -1) }),

  finishMeasure: () => set({ measuring: false }),

  clearMeasure: () => set({ measuring: false, measurement: [] }),

  focusOn: (bounds) => set({ focus: { bounds, nonce: (get().focus?.nonce ?? 0) + 1 } }),
}));

/** Bounds for a single point (the engine zooms to street level for these). */
export function pointFocus(point: Point): Bounds {
  return { minX: point.x, minY: point.y, maxX: point.x, maxY: point.y };
}
