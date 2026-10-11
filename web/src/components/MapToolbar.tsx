import { useEffect, useState, type FormEvent } from "react";

import { parseCoordinates } from "../engine/coordinates";
import type { Bounds, Point } from "../engine/types";

type MapToolbarProps = {
  /** Map bounds, for validating typed coordinates. */
  bounds: Bounds;
  hasSavedView: boolean;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onSaveView: () => void;
  onReturnToView: () => void;
  onJump: (point: Point) => void;
};

/** Top-of-map controls: zoom, fit, saved view, and jump-to-coordinates. */
export function MapToolbar({
  bounds,
  hasSavedView,
  onZoom,
  onFit,
  onSaveView,
  onReturnToView,
  onJump,
}: MapToolbarProps) {
  const [jumpX, setJumpX] = useState("");
  const [jumpY, setJumpY] = useState("");
  const [jumpError, setJumpError] = useState("");
  const [viewSaved, setViewSaved] = useState(false);

  useEffect(() => {
    if (!viewSaved) return;
    const timer = window.setTimeout(() => setViewSaved(false), 1200);
    return () => window.clearTimeout(timer);
  }, [viewSaved]);

  function jump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const point = parseCoordinates(jumpX, jumpY, bounds);
    if (!point) {
      setJumpError("Enter an X and Y inside this map's bounds.");
      return;
    }
    setJumpError("");
    onJump(point);
  }

  return (
    <div className="map-toolbar">
      <div className="map-controls" aria-label="Map controls">
        <button onClick={() => onZoom(1.5)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button onClick={() => onZoom(1 / 1.5)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <button onClick={onFit} aria-label="Fit whole map" title="Fit whole map">
          ⛶
        </button>
        <button
          onClick={onReturnToView}
          disabled={!hasSavedView}
          aria-label="Return to saved view"
          title={hasSavedView ? "Return to your saved view" : "No saved view yet"}
        >
          ⌂
        </button>
        <button
          onClick={() => {
            onSaveView();
            setViewSaved(true);
          }}
          aria-label="Save this view"
          title="Save this view — the map opens here next time"
        >
          {viewSaved ? "✓" : "★"}
        </button>
      </div>

      <form className="coordinate-jump" onSubmit={jump} aria-label="Jump to coordinates">
        <label>
          X
          <input
            aria-label="Jump to X"
            inputMode="numeric"
            value={jumpX}
            onChange={(event) => setJumpX(event.target.value)}
            placeholder="10820"
          />
        </label>
        <label>
          Y
          <input
            aria-label="Jump to Y"
            inputMode="numeric"
            value={jumpY}
            onChange={(event) => setJumpY(event.target.value)}
            placeholder="9650"
          />
        </label>
        <button type="submit" title="Center the map on these world coordinates">
          Go
        </button>
        {jumpError && (
          <span className="jump-error" role="alert">
            {jumpError}
          </span>
        )}
      </form>
    </div>
  );
}
