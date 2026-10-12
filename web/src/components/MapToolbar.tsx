import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { parseCoordinates } from "../engine/coordinates";
import type { Bounds, Point } from "../engine/types";

type MapToolbarProps = {
  /** Map bounds, for validating typed coordinates. */
  bounds: Bounds;
  hasSavedView: boolean;
  navOpen: boolean;
  onToggleNavigate: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  onSaveView: () => void;
  onReturnToView: () => void;
  onJump: (point: Point) => void;
  /** The search control, shown in the left group after Nav (it opens to the right). */
  search?: ReactNode;
};

/** Top-of-map controls: zoom, Full (fit), Home / Set Home (saved view), Nav, Search, jump-to-X/Y. */
export function MapToolbar({
  bounds,
  hasSavedView,
  navOpen,
  onToggleNavigate,
  onZoom,
  onFit,
  onSaveView,
  onReturnToView,
  onJump,
  search,
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
        <button className="map-tool" onClick={() => onZoom(1.5)} aria-label="Zoom in" title="Zoom in">
          +
        </button>
        <button className="map-tool" onClick={() => onZoom(1 / 1.5)} aria-label="Zoom out" title="Zoom out">
          −
        </button>
        <ToolButton icon="⛶" label="Full" title="Fit the whole map" onClick={onFit} />
        <ToolButton
          icon="⌂"
          label="Home"
          title={hasSavedView ? "Go to your Home view" : "No Home set yet — use Set Home"}
          disabled={!hasSavedView}
          onClick={onReturnToView}
        />
        <ToolButton
          icon={viewSaved ? "✓" : "★"}
          label="Set Home"
          title="Set this view as Home — the map opens here next time"
          onClick={() => {
            onSaveView();
            setViewSaved(true);
          }}
        />
        <ToolButton
          icon="🧭"
          label="Nav"
          title="Navigate — plan a route by road through your stops"
          active={navOpen}
          onClick={onToggleNavigate}
        />
        {search}
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

type ToolButtonProps = {
  icon: string;
  label: string;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  /** Pressed state, for toggles like Nav. */
  active?: boolean;
};

/** A labelled toolbar button: centered icon with a short word under it. */
function ToolButton({ icon, label, title, onClick, disabled, active }: ToolButtonProps) {
  return (
    <button
      className={`map-tool tool-button${active ? " is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      title={title}
    >
      <span className="tool-icon" aria-hidden="true">
        {icon}
      </span>
      <span className="tool-label">{label}</span>
    </button>
  );
}
