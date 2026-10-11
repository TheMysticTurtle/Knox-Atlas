import { markerColors } from "../engine/colors";
import { pathLength, pointBounds } from "../engine/geometry";
import { pointFocus, useMapUi } from "../mapUiStore";
import { useSaved } from "../savedStore";

/**
 * "Your map": the user's saved places and paths. Hidden until something is saved. Clicking an entry
 * flies the map to it (and opens a place's card); × deletes it.
 */
export function YourMapSection() {
  const markers = useSaved((state) => state.markers);
  const paths = useSaved((state) => state.paths);
  const removeMarker = useSaved((state) => state.removeMarker);
  const removePath = useSaved((state) => state.removePath);
  const select = useMapUi((state) => state.select);
  const focusOn = useMapUi((state) => state.focusOn);
  const selectedMarkerId = useMapUi((state) => state.selection?.markerId);

  if (markers.length === 0 && paths.length === 0) return null;

  return (
    <section className="your-map-section">
      <p className="panel-eyebrow">YOUR MAP</p>

      {markers.length > 0 && (
        <>
          <p className="saved-group-heading">Places · {markers.length}</p>
          <ul className="saved-list">
            {markers.map((marker) => (
              <li key={marker.id} className="saved-item">
                <button
                  className="saved-focus"
                  onClick={() => {
                    focusOn(pointFocus(marker));
                    select({ point: { x: marker.x, y: marker.y }, poi: null, markerId: marker.id });
                  }}
                >
                  <i className="saved-dot" style={{ background: markerColors[marker.color] }} />
                  <span>
                    <strong>{marker.label}</strong>
                    <small>
                      {Math.round(marker.x)}, {Math.round(marker.y)}
                    </small>
                  </span>
                </button>
                <button
                  className="saved-remove"
                  aria-label={`Delete ${marker.label}`}
                  title="Delete place"
                  onClick={() => {
                    removeMarker(marker.id);
                    if (selectedMarkerId === marker.id) select(null);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {paths.length > 0 && (
        <>
          <p className="saved-group-heading">Paths · {paths.length}</p>
          <ul className="saved-list">
            {paths.map((path) => (
              <li key={path.id} className="saved-item">
                <button className="saved-focus" onClick={() => focusOn(pointBounds(path.points))}>
                  <i className="saved-dot is-path" style={{ background: markerColors[path.color] }} />
                  <span>
                    <strong>{path.label}</strong>
                    <small>
                      {path.points.length} points · {Math.round(pathLength(path.points)).toLocaleString()}{" "}
                      tiles
                    </small>
                  </span>
                </button>
                <button
                  className="saved-remove"
                  aria-label={`Delete ${path.label}`}
                  title="Delete path"
                  onClick={() => removePath(path.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
