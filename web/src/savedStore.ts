import { create } from "zustand";

import type {
  MarkerColor,
  NavStop,
  Point,
  SavedGroup,
  SavedLayout,
  SavedMarker,
  SavedPath,
  SavedSection,
  SavedView,
} from "./engine/types";
import { LIMITS, cleanLabel, loadSaved, newId, persist } from "./savedStorage";

/**
 * The user's own map: saved places, saved paths/routes, the saved camera, and how they're organised
 * (groups, hidden items, collapsed sections). Persisted on every change.
 */
type SavedState = {
  markers: SavedMarker[];
  paths: SavedPath[];
  view?: SavedView;
  layout: SavedLayout;
  /** Returns the new place, or null when the name is empty or the limit is reached. */
  addMarker: (point: Point, label: string, color: MarkerColor, group?: string) => SavedMarker | null;
  updateMarker: (id: string, label: string, color: MarkerColor, group?: string) => void;
  removeMarker: (id: string) => void;
  /**
   * Returns the new path, or null when the name is empty, it has < 2 points, or the limit is reached.
   * Passing `stops` saves it as a route that reopens in Navigate.
   */
  addPath: (
    points: Point[],
    label: string,
    color: MarkerColor,
    stops?: NavStop[],
    group?: string,
  ) => SavedPath | null;
  /** Replace a saved path's line, name, colour, stops and group (re-saving an opened route). */
  updatePath: (
    id: string,
    points: Point[],
    label: string,
    color: MarkerColor,
    stops?: NavStop[],
    group?: string,
  ) => void;
  removePath: (id: string) => void;
  saveView: (view: SavedView) => void;

  /** Show or hide saved items on the map (places by `markers`, routes and paths by `paths`). */
  setHidden: (kind: "markers" | "paths", ids: string[], hidden: boolean) => void;
  /** Create a group in a section; null when the name is empty or the limit is reached. */
  addGroup: (section: SavedSection, name: string) => SavedGroup | null;
  renameGroup: (id: string, name: string) => void;
  /** Delete a group; its items stay, ungrouped. */
  deleteGroup: (id: string) => void;
  toggleGroupCollapsed: (id: string) => void;
  toggleSectionCollapsed: (section: SavedSection) => void;
};

const initial = loadSaved();

export const useSaved = create<SavedState>((set, get) => ({
  markers: initial.markers,
  paths: initial.paths,
  view: initial.view,
  layout: initial.layout,

  addMarker: (point, label, color, group) => {
    const name = cleanLabel(label);
    if (!name || get().markers.length >= LIMITS.markers) return null;
    const marker: SavedMarker = {
      id: newId(),
      label: name,
      color,
      x: point.x,
      y: point.y,
      ...(group ? { group } : {}),
    };
    const markers = [...get().markers, marker];
    set({ markers });
    persist("markers", markers);
    return marker;
  },

  updateMarker: (id, label, color, group) => {
    const name = cleanLabel(label);
    if (!name) return;
    const markers = get().markers.map((marker) =>
      marker.id === id ? withGroup({ ...marker, label: name, color }, group) : marker,
    );
    set({ markers });
    persist("markers", markers);
  },

  removeMarker: (id) => {
    const markers = get().markers.filter((marker) => marker.id !== id);
    set({ markers });
    persist("markers", markers);
  },

  addPath: (points, label, color, stops, group) => {
    const name = cleanLabel(label);
    if (!name || points.length < 2 || get().paths.length >= LIMITS.paths) return null;
    const path = withGroup(makePath(newId(), points, name, color, stops), group);
    const paths = [...get().paths, path];
    set({ paths });
    persist("paths", paths);
    return path;
  },

  updatePath: (id, points, label, color, stops, group) => {
    const name = cleanLabel(label);
    if (!name || points.length < 2) return;
    const paths = get().paths.map((path) =>
      path.id === id
        ? withGroup({ ...makePath(id, points, name, color, stops), ...hiddenOf(path) }, group)
        : path,
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

  setHidden: (kind, ids, hidden) => {
    const targets = new Set(ids);
    const toggle = <T extends SavedMarker | SavedPath>(item: T): T => {
      if (!targets.has(item.id)) return item;
      const { hidden: _previous, ...rest } = item;
      return (hidden ? { ...rest, hidden: true } : rest) as T;
    };
    if (kind === "markers") {
      const markers = get().markers.map(toggle);
      set({ markers });
      persist("markers", markers);
    } else {
      const paths = get().paths.map(toggle);
      set({ paths });
      persist("paths", paths);
    }
  },

  addGroup: (section, name) => {
    const groupName = cleanLabel(name);
    const { layout } = get();
    if (!groupName || layout.groups.length >= LIMITS.groups) return null;
    const group: SavedGroup = { id: newId(), name: groupName, section };
    saveLayout({ ...layout, groups: [...layout.groups, group] });
    return group;
  },

  renameGroup: (id, name) => {
    const groupName = cleanLabel(name);
    const { layout } = get();
    if (!groupName) return;
    saveLayout({
      ...layout,
      groups: layout.groups.map((group) => (group.id === id ? { ...group, name: groupName } : group)),
    });
  },

  deleteGroup: (id) => {
    const { layout, markers, paths } = get();
    const ungroup = <T extends SavedMarker | SavedPath>(item: T): T => (item.group === id ? withGroup(item) : item);
    const nextMarkers = markers.map(ungroup);
    const nextPaths = paths.map(ungroup);
    set({ markers: nextMarkers, paths: nextPaths });
    persist("markers", nextMarkers);
    persist("paths", nextPaths);
    saveLayout({ ...layout, groups: layout.groups.filter((group) => group.id !== id) });
  },

  toggleGroupCollapsed: (id) => {
    const { layout } = get();
    saveLayout({
      ...layout,
      groups: layout.groups.map((group) => {
        if (group.id !== id) return group;
        const { collapsed, ...rest } = group;
        return collapsed ? rest : { ...rest, collapsed: true };
      }),
    });
  },

  toggleSectionCollapsed: (section) => {
    const { layout } = get();
    const collapsed = layout.collapsed.includes(section)
      ? layout.collapsed.filter((item) => item !== section)
      : [...layout.collapsed, section];
    saveLayout({ ...layout, collapsed });
  },
}));

/** Persist and publish a new Your-map layout. */
function saveLayout(layout: SavedLayout): void {
  useSaved.setState({ layout });
  persist("layout", layout);
}

/** File an item in `group`, or ungroup it (no field) when `group` is empty. */
function withGroup<T extends SavedMarker | SavedPath>(item: T, group?: string): T {
  const { group: _previous, ...rest } = item;
  return (group ? { ...rest, group } : rest) as T;
}

/** Keep an item's hidden flag across a rebuild of its record. */
function hiddenOf(item: SavedMarker | SavedPath): { hidden?: true } {
  return item.hidden ? { hidden: true } : {};
}

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
