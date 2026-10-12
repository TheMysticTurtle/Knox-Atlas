import { useEffect, useRef, useState } from "react";

import { markerColors } from "../engine/colors";
import { pathLength, pointBounds } from "../engine/geometry";
import { countBends, countNumbered, rerouteCount } from "../engine/stops";
import type { MarkerColor, SavedGroup, SavedSection } from "../engine/types";
import { pointFocus, useMapUi } from "../mapUiStore";
import { LIMITS } from "../savedStorage";
import { useSaved } from "../savedStore";

/** One saved thing as the list shows it, whatever its kind. */
type Entry = {
  id: string;
  label: string;
  sub: string;
  color: MarkerColor;
  icon: "place" | "route" | "path";
  hidden: boolean;
  group?: string;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
};

type SetHidden = (ids: string[], hidden: boolean) => void;

/**
 * "Your map": saved places, routes and paths in three collapsible sections, each with one tier of
 * user groups. Every level has a show/hide checkbox (tri-state for sections and groups); hidden
 * items stay listed (dimmed) but are not drawn. Hidden until something is saved.
 */
export function YourMapSection() {
  const markers = useSaved((state) => state.markers);
  const paths = useSaved((state) => state.paths);
  const groupCount = useSaved((state) => state.layout.groups.length);
  const removeMarker = useSaved((state) => state.removeMarker);
  const removePath = useSaved((state) => state.removePath);
  const setHidden = useSaved((state) => state.setHidden);
  const select = useMapUi((state) => state.select);
  const focusOn = useMapUi((state) => state.focusOn);
  const openRoute = useMapUi((state) => state.openRoute);
  const openRouteId = useMapUi((state) => state.openRouteId);
  const setOpenRoute = useMapUi((state) => state.setOpenRoute);
  const selectedMarkerId = useMapUi((state) => state.selection?.markerId);

  if (markers.length === 0 && paths.length === 0 && groupCount === 0) return null;

  const tiles = (points: { x: number; y: number }[]) =>
    `${Math.round(pathLength(points)).toLocaleString()} tiles`;

  const deletePath = (id: string) => {
    removePath(id);
    if (openRouteId === id) setOpenRoute(null);
  };

  const places: Entry[] = markers.map((marker) => ({
    id: marker.id,
    label: marker.label,
    sub: `${Math.round(marker.x)}, ${Math.round(marker.y)}`,
    color: marker.color,
    icon: "place",
    hidden: Boolean(marker.hidden),
    group: marker.group,
    active: selectedMarkerId === marker.id,
    onOpen: () => {
      focusOn(pointFocus(marker));
      select({ point: { x: marker.x, y: marker.y }, poi: null, markerId: marker.id });
    },
    onDelete: () => {
      removeMarker(marker.id);
      if (selectedMarkerId === marker.id) select(null);
    },
  }));

  const routes: Entry[] = paths
    .filter((path) => path.stops)
    .map((route) => {
      const stops = route.stops ?? [];
      const bends = countBends(stops);
      return {
        id: route.id,
        label: route.label,
        // Numbered stops only; dragged bends ("re-routes" on screen) are counted separately.
        sub: [
          `${countNumbered(stops)} stops`,
          bends > 0 ? rerouteCount(bends) : "",
          tiles(route.points),
        ]
          .filter(Boolean)
          .join(" · "),
        color: route.color,
        icon: "route",
        hidden: Boolean(route.hidden),
        group: route.group,
        active: openRouteId === route.id,
        onOpen: () => {
          openRoute(route);
          focusOn(pointBounds(route.points));
        },
        onDelete: () => deletePath(route.id),
      };
    });

  const lines: Entry[] = paths
    .filter((path) => !path.stops)
    .map((path) => ({
      id: path.id,
      label: path.label,
      sub: `${path.points.length} points · ${tiles(path.points)}`,
      color: path.color,
      icon: "path",
      hidden: Boolean(path.hidden),
      group: path.group,
      active: false,
      onOpen: () => focusOn(pointBounds(path.points)),
      onDelete: () => deletePath(path.id),
    }));

  return (
    <section className="your-map-section">
      <p className="panel-eyebrow">YOUR MAP</p>
      <SavedSectionList
        section="places"
        title="Places"
        entries={places}
        onSetHidden={(ids, hidden) => setHidden("markers", ids, hidden)}
      />
      <SavedSectionList
        section="routes"
        title="Routes"
        entries={routes}
        onSetHidden={(ids, hidden) => setHidden("paths", ids, hidden)}
      />
      <SavedSectionList
        section="paths"
        title="Paths"
        entries={lines}
        onSetHidden={(ids, hidden) => setHidden("paths", ids, hidden)}
      />
    </section>
  );
}

type SectionProps = {
  section: SavedSection;
  title: string;
  entries: Entry[];
  onSetHidden: SetHidden;
};

/** One section: collapsible, show/hide-all, its groups (each collapsible), then ungrouped items. */
function SavedSectionList({ section, title, entries, onSetHidden }: SectionProps) {
  const allGroups = useSaved((state) => state.layout.groups);
  const collapsed = useSaved((state) => state.layout.collapsed.includes(section));
  const toggleSectionCollapsed = useSaved((state) => state.toggleSectionCollapsed);
  const addGroup = useSaved((state) => state.addGroup);
  const [naming, setNaming] = useState(false);

  const groups = allGroups.filter((group) => group.section === section);
  if (entries.length === 0 && groups.length === 0) return null;

  const groupIds = new Set(groups.map((group) => group.id));
  // Items filed in a group that no longer exists show as ungrouped.
  const ungrouped = entries.filter((entry) => !entry.group || !groupIds.has(entry.group));
  const atLimit = allGroups.length >= LIMITS.groups;

  return (
    <div className="saved-section">
      <div className="saved-row saved-section-row">
        <Disclosure open={!collapsed} label={title} onToggle={() => toggleSectionCollapsed(section)} />
        <VisibilityBox entries={entries} label={title} onSetHidden={onSetHidden} />
        <button className="saved-row-title" onClick={() => toggleSectionCollapsed(section)}>
          {title} <small>· {entries.length}</small>
        </button>
        <button
          className="saved-add-group"
          onClick={() => setNaming(true)}
          disabled={atLimit}
          title={atLimit ? `Up to ${LIMITS.groups} groups` : `New ${title.toLowerCase()} group`}
        >
          + Group
        </button>
      </div>

      {!collapsed && (
        <div className="saved-section-body">
          {naming && (
            <InlineName
              initial=""
              placeholder="Group name, then Enter"
              onDone={(name) => {
                if (name) addGroup(section, name);
                setNaming(false);
              }}
            />
          )}
          {groups.map((group) => (
            <GroupBlock
              key={group.id}
              group={group}
              entries={entries.filter((entry) => entry.group === group.id)}
              onSetHidden={onSetHidden}
            />
          ))}
          {ungrouped.length > 0 && (
            <ul className="saved-list">
              {ungrouped.map((entry) => (
                <EntryRow key={entry.id} entry={entry} onSetHidden={onSetHidden} />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

type GroupProps = { group: SavedGroup; entries: Entry[]; onSetHidden: SetHidden };

/** A user group: collapsible, show/hide-all, rename / delete on hover. */
function GroupBlock({ group, entries, onSetHidden }: GroupProps) {
  const toggleGroupCollapsed = useSaved((state) => state.toggleGroupCollapsed);
  const renameGroup = useSaved((state) => state.renameGroup);
  const deleteGroup = useSaved((state) => state.deleteGroup);
  const [renaming, setRenaming] = useState(false);

  return (
    <div className="saved-group">
      {renaming ? (
        <InlineName
          initial={group.name}
          placeholder="Group name, then Enter"
          onDone={(name) => {
            if (name) renameGroup(group.id, name);
            setRenaming(false);
          }}
        />
      ) : (
        <div className="saved-row saved-group-row">
          <Disclosure
            open={!group.collapsed}
            label={group.name}
            onToggle={() => toggleGroupCollapsed(group.id)}
          />
          <VisibilityBox entries={entries} label={group.name} onSetHidden={onSetHidden} />
          <button className="saved-row-title" onClick={() => toggleGroupCollapsed(group.id)}>
            {group.name} <small>· {entries.length}</small>
          </button>
          <button
            className="saved-row-action"
            onClick={() => setRenaming(true)}
            title="Rename group"
            aria-label={`Rename ${group.name}`}
          >
            ✎
          </button>
          <button
            className="saved-row-action"
            onClick={() => deleteGroup(group.id)}
            title="Delete group (its items stay, ungrouped)"
            aria-label={`Delete ${group.name}`}
          >
            ×
          </button>
        </div>
      )}
      {!group.collapsed && (
        <ul className="saved-list saved-group-items">
          {entries.length === 0 ? (
            <li className="saved-empty">Empty — pick this group when saving or editing.</li>
          ) : (
            entries.map((entry) => <EntryRow key={entry.id} entry={entry} onSetHidden={onSetHidden} />)
          )}
        </ul>
      )}
    </div>
  );
}

/** One saved item: show/hide, open (fly to / reopen), delete on hover. Hidden items are dimmed. */
function EntryRow({ entry, onSetHidden }: { entry: Entry; onSetHidden: SetHidden }) {
  const classes = ["saved-item", entry.active && "is-open", entry.hidden && "is-hidden"];
  return (
    <li className={classes.filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        className="saved-visibility"
        checked={!entry.hidden}
        onChange={() => onSetHidden([entry.id], !entry.hidden)}
        aria-label={`Show ${entry.label} on the map`}
        title={entry.hidden ? "Hidden — click to show on the map" : "Shown — click to hide from the map"}
      />
      <button
        className="saved-focus"
        onClick={entry.onOpen}
        title={entry.icon === "route" ? "Open this route in Navigate" : undefined}
      >
        <i
          className={`saved-dot${entry.icon === "path" ? " is-path" : entry.icon === "route" ? " is-route" : ""}`}
          style={{ background: markerColors[entry.color] }}
        >
          {entry.icon === "route" ? "🧭" : null}
        </i>
        <span>
          <strong>{entry.label}</strong>
          <small>{entry.sub}</small>
        </span>
      </button>
      <button
        className="saved-remove"
        onClick={entry.onDelete}
        aria-label={`Delete ${entry.label}`}
        title="Delete"
      >
        ×
      </button>
    </li>
  );
}

/** ▸ / ▾ collapse toggle. */
function Disclosure({ open, label, onToggle }: { open: boolean; label: string; onToggle: () => void }) {
  return (
    <button
      className={`saved-disclosure${open ? " is-open" : ""}`}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
    >
      ›
    </button>
  );
}

/** Show/hide-all checkbox for a set of items: checked, unchecked, or partly (indeterminate). */
function VisibilityBox({
  entries,
  label,
  onSetHidden,
}: {
  entries: Entry[];
  label: string;
  onSetHidden: SetHidden;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const hiddenCount = entries.filter((entry) => entry.hidden).length;
  const allShown = hiddenCount === 0;
  const partly = hiddenCount > 0 && hiddenCount < entries.length;

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = partly;
  }, [partly]);

  return (
    <input
      ref={ref}
      type="checkbox"
      className="saved-visibility"
      checked={allShown && entries.length > 0}
      disabled={entries.length === 0}
      // Anything hidden → show all; everything shown → hide all.
      onChange={() => onSetHidden(entries.map((entry) => entry.id), allShown)}
      aria-label={`Show ${label} on the map`}
      title={allShown ? "Hide all" : "Show all"}
    />
  );
}

/** Inline name field for creating/renaming a group: Enter or leaving saves, Esc cancels. */
function InlineName({
  initial,
  placeholder,
  onDone,
}: {
  initial: string;
  placeholder: string;
  onDone: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  const finished = useRef(false);
  const finish = (value: string) => {
    if (finished.current) return;
    finished.current = true;
    onDone(value.trim());
  };
  return (
    <input
      className="saved-inline-name"
      autoFocus
      value={name}
      maxLength={LIMITS.label}
      placeholder={placeholder}
      aria-label="Group name"
      onChange={(event) => setName(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") finish(name);
        if (event.key === "Escape") finish("");
      }}
      onBlur={() => finish(name)}
    />
  );
}
