import { create } from "zustand";

import type { MarkerColor, NavStop, Point, SavedMarker, SavedPath, SavedView } from "./engine/types";
import { LIMITS, cleanLabel, loadSaved, newId, persist } from "./savedStorage";

/** The user's own map: saved places, saved paths and the saved camera. Persisted on every change. */
type SavedState = {
  markers: SavedMarker[];
  paths: SavedPath[];
  view?: SavedView;
  /** Returns the new place, or null when the name is empty or the limit is reached. */
  addMarker: (point: Point, label: string, color: MarkerColor) => SavedMarker | null;
  updateMarker: (id: string, label: string, color: MarkerColor) => void;
  removeMarker: (id: string) => void;
  /**
   * Returns the new path, or null when the name is empty, it has < 2 points, or the limit is reached.
   * Passing `stops` saves it as a route that reopens in Navigate.
   */
  addPath: (points: Point[], label: string, color: MarkerColor, stops?: NavStop[]) => SavedPath | null;
  /** Replace a saved path's line, name, colour and stops (re-saving an opened route). */
  updatePath: (id: string, points: Point[], label: string, color: MarkerColor, stops?: NavStop[]) => void;
  removePath: (id: string) => void;
  saveView: (view: SavedView) => void;
};

const initial = loadSaved();

export const useSaved = create<SavedState>((set, get) => ({
  markers: initial.markers,
  paths: initial.paths,
  view: initial.view,

  addMarker: (point, label, color) => {
    const name = cleanLabel(label);
    if (!name || get().markers.length >= LIMITS.markers) return null;
    const marker: SavedMarker = { id: newId(), label: name, color, x: point.x, y: point.y };
    const markers = [...get().markers, marker];
    set({ markers });
    persist("markers", markers);
    return marker;
  },

  updateMarker: (id, label, color) => {
    const name = cleanLabel(label);
    if (!name) return;
    const markers = get().markers.map((marker) =>
      marker.id === id ? { ...marker, label: name, color } : marker,
    );
    set({ markers });
    persist("markers", markers);
  },

  removeMarker: (id) => {
    const markers = get().markers.filter((marker) => marker.id !== id);
    set({ markers });
    persist("markers", markers);
  },

  addPath: (points, label, color, stops) => {
    const name = cleanLabel(label);
    if (!name || points.length < 2 || get().paths.length >= LIMITS.paths) return null;
    const path = makePath(newId(), points, name, color, stops);
    const paths = [...get().paths, path];
    set({ paths });
    persist("paths", paths);
    return path;
  },

  updatePath: (id, points, label, color, stops) => {
    const name = cleanLabel(label);
    if (!name || points.length < 2) return;
    const paths = get().paths.map((path) =>
      path.id === id ? makePath(id, points, name, color, stops) : path,
    );
    set({ paths });
    persist("paths", paths);
  },

  removePath: (id) => {
    const paths = get().paths.filter((path) => path.id !== id);
    set({ paths });
    persist("paths", paths);
  },

  saveView: (view) => {
    set({ view });
    persist("view", view);
  },
}));

/** A path record in the released shape; `stops` only when it is a route (2+ numbered stops). */
function makePath(
  id: string,
  points: Point[],
  label: string,
  color: MarkerColor,
  stops?: NavStop[],
): SavedPath {
  const path: SavedPath = {
    id,
    label,
    color,
    points: points.slice(0, LIMITS.pathPoints).map((point) => ({ x: point.x, y: point.y })),
  };
  if (stops && stops.filter((stop) => !stop.via).length >= 2) {
    // Copy only the stored fields; bends keep their flag (numbered stops omit it).
    path.stops = stops.map((stop) => ({
      point: { x: stop.point.x, y: stop.point.y },
      label: stop.label,
      ...(stop.via ? { via: true } : {}),
    }));
  }
  return path;
}
