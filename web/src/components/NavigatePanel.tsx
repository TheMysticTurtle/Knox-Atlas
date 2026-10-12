import { useEffect, useState, type FormEvent } from "react";

import { parseCoordinates } from "../engine/coordinates";
import { simplifyPath } from "../engine/geometry";
import { stopTag, tripPolyline, type TripResult } from "../engine/roadGraph";
import type { Bounds, NavStop, SavedMarker } from "../engine/types";
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
 * and the trip saved as a path.
 */
export function NavigatePanel({ bounds, result }: NavigatePanelProps) {
  const stops = useMapUi((state) => state.navStops);
  const adding = useMapUi((state) => state.addingStops);
  const toggleNav = useMapUi((state) => state.toggleNav);
  const setAdding = useMapUi((state) => state.setAddingStops);
  const updateStop = useMapUi((state) => state.updateStop);
  const removeStop = useMapUi((state) => state.removeStop);
  const moveStop = useMapUi((state) => state.moveStop);
  const clearStops = useMapUi((state) => state.clearStops);
  const markers = useSaved((state) => state.markers);
  const pathCount = useSaved((state) => state.paths.length);
  const addPath = useSaved((state) => state.addPath);
  const [saving, setSaving] = useState(false);

  const trip = result?.ok ? result.trip : null;
  const full = stops.length >= MAX_STOPS;

  function saveTrip(name: string, color: Parameters<typeof addPath>[2]) {
    if (!trip) return;
    if (addPath(simplifyPath(tripPolyline(trip), LIMITS.pathPoints), name, color)) setSaving(false);
  }

  return (
    <section className="navigate-panel" aria-label="Navigate">
      <header className="navigate-heading">
        <small>NAVIGATE</small>
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
              markers={markers}
              canMoveUp={index > 0}
              canMoveDown={index < stops.length - 1}
              onChange={(next) => updateStop(index, next)}
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
                    initialName={`${stops[0].label} → ${stops[stops.length - 1].label}`}
                    initialColor="blue"
                    placeholder="Supply run, patrol, shortcut…"
                    submitLabel="Save path"
                    note={`Saved on this computer · ${pathCount}/${LIMITS.paths}`}
                    onSubmit={saveTrip}
                    onCancel={() => setSaving(false)}
                  />
                ) : (
                  <div className="card-actions">
                    <button
                      className="primary-action"
                      onClick={() => setSaving(true)}
                      disabled={pathCount >= LIMITS.paths}
                      title={
                        pathCount >= LIMITS.paths ? `You can save up to ${LIMITS.paths} paths` : undefined
                      }
                    >
                      Save as path
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
  markers: SavedMarker[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (stop: NavStop) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

/** One stop: editable X/Y (applied on Enter or leaving the pair), saved places, reorder, remove. */
function StopRow({
  tag,
  stop,
  bounds,
  markers,
  canMoveUp,
  canMoveDown,
  onChange,
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
        {markers.length > 0 && (
          <select
            className="stop-saved"
            aria-label={`Use a saved place for ${tag}`}
            title="Use a saved place"
            value=""
            onChange={(event) => {
              const marker = markers.find((item) => item.id === event.target.value);
              if (marker) onChange({ point: { x: marker.x, y: marker.y }, label: marker.label });
            }}
          >
            <option value="">★</option>
            {markers.map((marker) => (
              <option key={marker.id} value={marker.id}>
                {marker.label}
              </option>
            ))}
          </select>
        )}
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
      {name && <span className="stop-label">{name}</span>}
    </li>
  );
}
