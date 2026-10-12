import { markerColors } from "../engine/colors";
import { pathLength, pointBounds } from "../engine/geometry";
import type { SavedPath } from "../engine/types";
import { pointFocus, useMapUi } from "../mapUiStore";
import { useSaved } from "../savedStore";

/**
 * "Your map": saved places, routes and paths. Hidden until something is saved. Clicking a place
 * flies to it and opens its card; a route reopens in Navigate; a path flies to it. × deletes.
 */
export function YourMapSection() {
  const markers = useSaved((state) => state.markers);
  const paths = useSaved((state) => state.paths);
  const removeMarker = useSaved((state) => state.removeMarker);
  const removePath = useSaved((state) => state.removePath);
  const select = useMapUi((state) => state.select);
  const focusOn = useMapUi((state) => state.focusOn);
  const openRoute = useMapUi((state) => state.openRoute);
  const openRouteId = useMapUi((state) => state.openRouteId);
  const setOpenRoute = useMapUi((state) => state.setOpenRoute);
  const selectedMarkerId = useMapUi((state) => state.selection?.markerId);

  if (markers.length === 0 && paths.length === 0) return null;

  const routes = paths.filter((path) => path.stops);
  const lines = paths.filter((path) => !path.stops);

  function deletePath(path: SavedPath) {
    removePath(path.id);
    if (openRouteId === path.id) setOpenRoute(null);
  }

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

      {routes.length > 0 && (
        <>
          <p className="saved-group-heading">Routes · {routes.length}</p>
          <ul className="saved-list">
            {routes.map((route) => (
              <li key={route.id} className={`saved-item${openRouteId === route.id ? " is-open" : ""}`}>
                <button
                  className="saved-focus"
                  title="Open this route in Navigate"
                  onClick={() => {
                    openRoute(route);
                    focusOn(pointBounds(route.points));
                  }}
                >
                  <i className="saved-dot is-route" style={{ background: markerColors[route.color] }}>
                    🧭
                  </i>
                  <span>
                    <strong>{route.label}</strong>
                    <small>
                      {route.stops!.length} stops · {Math.round(pathLength(route.points)).toLocaleString()}{" "}
                      tiles
                    </small>
                  </span>
                </button>
                <button
                  className="saved-remove"
                  aria-label={`Delete ${route.label}`}
                  title="Delete route"
                  onClick={() => deletePath(route)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {lines.length > 0 && (
        <>
          <p className="saved-group-heading">Paths · {lines.length}</p>
          <ul className="saved-list">
            {lines.map((path) => (
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
                  onClick={() => deletePath(path)}
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
