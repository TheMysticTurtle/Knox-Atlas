import { useEffect, useState, type FormEvent } from "react";

import { parseCoordinates } from "../engine/coordinates";
import { simplifyPath } from "../engine/geometry";
import { stopTag, tripPolyline, type TripResult } from "../engine/roadGraph";
import type { Bounds, NavStop } from "../engine/types";
import { MAX_STOPS, useMapUi } from "../mapUiStore";
import { LIMITS } from "../savedStorage";
import { useSaved } from "../savedStore";
import { NameColorForm } from "./NameColorForm";

/** How many street names to list before summarising the rest. */
const STREETS_SHOWN = 6;

type NavigatePanelProps = {
  /** Map bounds, for validating typed coordinates. */
  bounds: Bounds;
  /** The routed trip through the stops, or null when there are fewer than two. */
  result: TripResult | null;
};

/**
 * 🧭 Navigate. "+ Add route", then click the map: each click adds a stop in order (Start, 1, 2…,
 * End) and the route follows the streets through them. Stops can be edited, reordered or removed,
 * and the trip saved as a route (reopened later from Your map).
 */
export function NavigatePanel({ bounds, result }: NavigatePanelProps) {
  const stops = useMapUi((state) => state.navStops);
  const adding = useMapUi((state) => state.addingStops);
  const toggleNav = useMapUi((state) => state.toggleNav);
  const setAdding = useMapUi((state) => state.setAddingStops);
  const updateStop = useMapUi((state) => state.updateStop);
  const removeStop = useMapUi((state) => state.removeStop);
  const moveStop = useMapUi((state) => state.moveStop);
  const movingStop = useMapUi((state) => state.movingStop);
  const startMovingStop = useMapUi((state) => state.startMovingStop);
  const clearStops = useMapUi((state) => state.clearStops);
  const openRouteId = useMapUi((state) => state.openRouteId);
  const setOpenRoute = useMapUi((state) => state.setOpenRoute);
  const pathCount = useSaved((state) => state.paths.length);
  const openRoute = useSaved((state) => state.paths.find((path) => path.id === openRouteId));
  const addPath = useSaved((state) => state.addPath);
  const updatePath = useSaved((state) => state.updatePath);
  const [saving, setSaving] = useState(false);

  const trip = result?.ok ? result.trip : null;
  const full = stops.length >= MAX_STOPS;
  // Re-saving an opened route updates it; otherwise it's a new saved route (limit applies).
  const atLimit = !openRoute && pathCount >= LIMITS.paths;

  /** Save the trip as a route: its line (released path format) plus its stops. */
  function saveRoute(name: string, color: Parameters<typeof addPath>[2]) {
    if (!trip) return;
    const line = simplifyPath(tripPolyline(trip), LIMITS.pathPoints);
    if (openRoute) {
      updatePath(openRoute.id, line, name, color, stops);
    } else {
      const saved = addPath(line, name, color, stops);
      if (!saved) return;
      setOpenRoute(saved.id);
    }
    setSaving(false);
  }

  return (
    <section className="navigate-panel" aria-label="Navigate">
      <header className="navigate-heading">
        <small>NAVIGATE</small>
        {openRoute && <strong className="navigate-route-name">{openRoute.label}</strong>}
        <button className="selection-close" onClick={toggleNav} aria-label="Close Navigate">
          ×
        </button>
      </header>

      {adding ? (
        <div className="navigate-adding">
          <p>Click locations on the map to add them as stops.</p>
          <button className="primary-action" onClick={() => setAdding(false)} title="Stop adding (Esc)">
            Done
          </button>
        </div>
      ) : (
        <div className="card-actions">
          <button
            className="primary-action"
            onClick={() => setAdding(true)}
            disabled={full}
            title={full ? `A route can have up to ${MAX_STOPS} stops` : undefined}
          >
            {stops.length === 0 ? "+ Add route" : "+ Add stops"}
          </button>
          {stops.length > 0 && <button onClick={clearStops}>Clear</button>}
        </div>
      )}

      {stops.length > 0 && (
        <ol className="stop-list">
          {stops.map((stop, index) => (
            <StopRow
              key={index}
              tag={stopTag(index, stops.length)}
              stop={stop}
              bounds={bounds}
              moving={movingStop === index}
              canMoveUp={index > 0}
              canMoveDown={index < stops.length - 1}
              onChange={(next) => updateStop(index, next)}
              onRepick={() => startMovingStop(movingStop === index ? null : index)}
              onMove={(direction) => moveStop(index, direction)}
              onRemove={() => removeStop(index)}
            />
          ))}
        </ol>
      )}

      {result && (
        <div className="navigate-result" role="status">
          {!result.ok ? (
            <p className="navigate-hint is-error">
              {result.reason === "no-roads"
                ? "No road data is available for this map."
                : `No road connects ${stopTag(result.leg, stops.length)} to ${stopTag(result.leg + 1, stops.length)}. Dirt trails aren't in the road data, so remote spots may not connect.`}
            </p>
          ) : (
            trip && (
              <>
                <p className="navigate-distance">
                  <strong>{Math.round(trip.roadLength).toLocaleString()} tiles</strong> by road
                  {trip.offRoadLength >= 1 && (
                    <span> + {Math.round(trip.offRoadLength).toLocaleString()} off-road</span>
                  )}
                </p>
                {trip.streets.length > 0 && (
                  <p className="navigate-streets">
                    via {trip.streets.slice(0, STREETS_SHOWN).join(" → ")}
                    {trip.streets.length > STREETS_SHOWN &&
                      ` → +${trip.streets.length - STREETS_SHOWN} more`}
                  </p>
                )}
                {saving ? (
                  <NameColorForm
                    initialName={openRoute?.label ?? `${stops[0].label} → ${stops[stops.length - 1].label}`}
                    initialColor={openRoute?.color ?? "blue"}
                    placeholder="Supply run, patrol, shortcut…"
                    submitLabel={openRoute ? "Save changes" : "Save route"}
                    note={openRoute ? undefined : `Saved on this computer · ${pathCount}/${LIMITS.paths}`}
                    onSubmit={saveRoute}
                    onCancel={() => setSaving(false)}
                  />
                ) : (
                  <div className="card-actions">
                    <button
                      className="primary-action"
                      onClick={() => setSaving(true)}
                      disabled={atLimit}
                      title={atLimit ? `You can save up to ${LIMITS.paths} paths and routes` : undefined}
                    >
                      {openRoute ? "Save changes" : "Save route"}
                    </button>
                  </div>
                )}
              </>
            )
          )}
        </div>
      )}
    </section>
  );
}

type StopRowProps = {
  tag: string;
  stop: NavStop;
  bounds: Bounds;
  /** Waiting for a map click to relocate this stop. */
  moving: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (stop: NavStop) => void;
  /** 🎯: relocate this stop with the next map click (again to cancel). */
  onRepick: () => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** One stop: editable X/Y (applied on Enter or leaving the pair), 🎯 re-pick, reorder, remove. */
function StopRow({
  tag,
  stop,
  bounds,
  moving,
  canMoveUp,
  canMoveDown,
  onChange,
  onRepick,
  onMove,
  onRemove,
}: StopRowProps) {
  const [x, setX] = useState("");
  const [y, setY] = useState("");
  const [invalid, setInvalid] = useState(false);

  // Show the stop's coordinates whenever it changes (added, edited, reordered…).
  useEffect(() => {
    setX(String(Math.round(stop.point.x)));
    setY(String(Math.round(stop.point.y)));
    setInvalid(false);
  }, [stop]);

  function apply(event?: FormEvent) {
    event?.preventDefault();
    const point = parseCoordinates(x, y, bounds);
    setInvalid(!point);
    if (point && (stop.point.x !== point.x || stop.point.y !== point.y)) {
      onChange({ point, label: `${point.x}, ${point.y}` });
    }
  }

  const tagClass = tag === "Start" ? "is-start" : tag === "End" ? "is-end" : "";
  // Show the name line only for named stops (a place or store), not plain coordinates.
  const name =
    stop.label !== `${Math.round(stop.point.x)}, ${Math.round(stop.point.y)}` ? stop.label : null;

  return (
    <li className="stop-row">
      <form
        onSubmit={apply}
        onBlur={(event) => {
          // Apply when focus leaves the whole X/Y pair, not when moving from X to Y.
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) apply();
        }}
      >
        <span className={`stop-tag ${tagClass}`}>{tag}</span>
        <input
          aria-label={`${tag} X`}
          aria-invalid={invalid}
          inputMode="numeric"
          value={x}
          onChange={(event) => setX(event.target.value)}
        />
        <input
          aria-label={`${tag} Y`}
          aria-invalid={invalid}
          inputMode="numeric"
          value={y}
          onChange={(event) => setY(event.target.value)}
        />
        <button
          type="button"
          className={`stop-repick${moving ? " is-active" : ""}`}
          onClick={onRepick}
          aria-pressed={moving}
          aria-label={`Pick a new spot for ${tag}`}
          title={moving ? "Click the map to move this stop (Esc to cancel)" : "Pick a new spot on the map"}
        >
          🎯
        </button>
        <button type="button" onClick={() => onMove(-1)} disabled={!canMoveUp} aria-label={`Move ${tag} earlier`} title="Move earlier">
          ↑
        </button>
        <button type="button" onClick={() => onMove(1)} disabled={!canMoveDown} aria-label={`Move ${tag} later`} title="Move later">
          ↓
        </button>
        <button type="button" className="stop-remove" onClick={onRemove} aria-label={`Remove ${tag}`} title="Remove stop">
          ×
        </button>
      </form>
      {moving ? (
        <span className="stop-label is-moving">Click the map to move this stop…</span>
      ) : (
        name && <span className="stop-label">{name}</span>
      )}
    </li>
  );
}
