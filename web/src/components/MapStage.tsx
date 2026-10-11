import { useEffect, useRef, useState, type FormEvent } from "react";

import { parseCoordinates } from "../engine/coordinates";
import { MapEngine } from "../engine/mapEngine";
import type { GameSnapshot, MapPoi, Point, RoomLoot, Selection } from "../engine/types";
import { useFilters } from "../store";
import { useView } from "../viewStore";
import { CoordinateReadout } from "./CoordinateReadout";
import { SelectionCard } from "./SelectionCard";

type MapStageProps = {
  snapshot?: GameSnapshot;
  pois: MapPoi[];
  loot: RoomLoot;
  error?: string;
};

/** The map surface: hands a canvas to the (non-React) MapEngine and syncs it with data + filters. */
export function MapStage({ snapshot, pois, loot, error }: MapStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MapEngine | undefined>(undefined);
  const enabled = useFilters((state) => state.enabled);
  const { towns, streets, buildings, businesses, satellite } = useView();
  const [selected, setSelected] = useState<Selection | null>(null);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState("");
  const [jumpX, setJumpX] = useState("");
  const [jumpY, setJumpY] = useState("");
  const [jumpError, setJumpError] = useState("");

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    engine.onSelect = setSelected;
    // Keep the previous object when the hovered tile is unchanged, so React skips the re-render.
    engine.onPointerPosition = (point) =>
      setPointer((previous) =>
        point && previous?.x === point.x && previous.y === point.y ? previous : point,
      );
    engine.onSatelliteStatus = setSatelliteStatus;
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = undefined;
      setSelected(null);
      setPointer(null);
      setSatelliteStatus("");
    };
  }, [snapshot]);

  // Re-apply on data or engine (re)creation.
  useEffect(() => {
    engineRef.current?.setPois(pois);
  }, [pois, snapshot]);

  useEffect(() => {
    engineRef.current?.setEnabledSubs(enabled);
  }, [enabled, snapshot]);

  useEffect(() => {
    engineRef.current?.setView({ towns, streets, buildings, businesses, satellite });
  }, [towns, streets, buildings, businesses, satellite, snapshot]);

  function jump(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) return;
    const point = parseCoordinates(jumpX, jumpY, snapshot.bounds);
    if (!point) {
      setJumpError("Enter an X and Y inside this map's bounds.");
      return;
    }
    setJumpError("");
    engineRef.current?.jumpTo(point);
  }

  function closeSelection() {
    setSelected(null);
    engineRef.current?.clearSelection();
  }

  return (
    <div className="map-stage">
      <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive Knox Country map" />

      {snapshot && (
        <>
          <div className="map-toolbar">
            <div className="map-controls" aria-label="Map controls">
              <button onClick={() => engineRef.current?.zoomBy(1.5)} aria-label="Zoom in" title="Zoom in">
                +
              </button>
              <button
                onClick={() => engineRef.current?.zoomBy(1 / 1.5)}
                aria-label="Zoom out"
                title="Zoom out"
              >
                −
              </button>
              <button
                onClick={() => engineRef.current?.fit()}
                aria-label="Fit whole map"
                title="Fit whole map"
              >
                ⛶
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

          {satellite && (
            <div className="satellite-status" role="status">
              {satelliteStatus || "Reading satellite imagery…"}
            </div>
          )}

          <div className="pointer-coordinates" title="Coordinates of the tile under the pointer">
            {pointer ? (
              <CoordinateReadout
                point={pointer}
                cellSize={snapshot.compiledCellSize}
                chunkSize={snapshot.chunkSize}
              />
            ) : (
              <span>Hover the map for coordinates · or enter X/Y above</span>
            )}
          </div>
        </>
      )}

      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}

      {selected && snapshot && (
        <SelectionCard
          key={`${selected.point.x},${selected.point.y},${selected.poi?.rawName}`}
          point={selected.point}
          poi={selected.poi}
          cellSize={snapshot.compiledCellSize}
          chunkSize={snapshot.chunkSize}
          loot={loot}
          onClose={closeSelection}
        />
      )}
    </div>
  );
}
