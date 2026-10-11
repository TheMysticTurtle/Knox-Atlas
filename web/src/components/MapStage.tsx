import { useEffect, useRef, useState } from "react";

import { MapEngine } from "../engine/mapEngine";
import type { GameSnapshot, MapPoi, Point, RoomLoot } from "../engine/types";
import { pointFocus, useMapUi } from "../mapUiStore";
import { useSaved } from "../savedStore";
import { useFilters } from "../store";
import { useView } from "../viewStore";
import { CoordinateReadout } from "./CoordinateReadout";
import { MapToolbar } from "./MapToolbar";
import { MeasurePanel } from "./MeasurePanel";
import { SelectionCard } from "./SelectionCard";

type MapStageProps = {
  snapshot?: GameSnapshot;
  pois: MapPoi[];
  loot: RoomLoot;
  error?: string;
};

/**
 * The map surface: hands a canvas to the (non-React) MapEngine and keeps it in sync with data,
 * filters, view toggles, saved items and interaction state. Decides what a map click means.
 */
export function MapStage({ snapshot, pois, loot, error }: MapStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MapEngine | undefined>(undefined);
  const enabled = useFilters((state) => state.enabled);
  const { towns, streets, buildings, businesses, satellite } = useView();
  const markers = useSaved((state) => state.markers);
  const paths = useSaved((state) => state.paths);
  const savedView = useSaved((state) => state.view);
  const saveView = useSaved((state) => state.saveView);
  const selection = useMapUi((state) => state.selection);
  const measuring = useMapUi((state) => state.measuring);
  const measurement = useMapUi((state) => state.measurement);
  const focus = useMapUi((state) => state.focus);
  const select = useMapUi((state) => state.select);
  const focusOn = useMapUi((state) => state.focusOn);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState("");

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    engine.onClick = (hit) => {
      const ui = useMapUi.getState();
      if (ui.measuring) ui.addMeasurePoint(hit.point);
      else ui.select(hit);
    };
    // Keep the previous object when the hovered tile is unchanged, so React skips the re-render.
    engine.onPointerPosition = (point) =>
      setPointer((previous) =>
        point && previous?.x === point.x && previous.y === point.y ? previous : point,
      );
    engine.onSatelliteStatus = setSatelliteStatus;
    // Open where the user left their saved view; otherwise the engine fits the whole map.
    const initialView = useSaved.getState().view;
    if (initialView) engine.setCamera(initialView);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = undefined;
      useMapUi.getState().select(null);
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

  useEffect(() => {
    engineRef.current?.setAnnotations({ markers, paths, measurement });
  }, [markers, paths, measurement, snapshot]);

  useEffect(() => {
    engineRef.current?.setSelection(selection);
  }, [selection, snapshot]);

  useEffect(() => {
    engineRef.current?.setPlacingCursor(measuring);
  }, [measuring, snapshot]);

  useEffect(() => {
    if (focus) engineRef.current?.focus(focus.bounds);
  }, [focus]);

  // Esc: stop measuring first, otherwise close the popup.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const ui = useMapUi.getState();
      if (ui.measuring) ui.finishMeasure();
      else if (ui.selection) ui.select(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="map-stage">
      <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive Knox Country map" />

      {snapshot && (
        <>
          <MapToolbar
            bounds={snapshot.bounds}
            hasSavedView={Boolean(savedView)}
            onZoom={(factor) => engineRef.current?.zoomBy(factor)}
            onFit={() => engineRef.current?.fit()}
            onSaveView={() => {
              const camera = engineRef.current?.getCamera();
              if (camera) saveView(camera);
            }}
            onReturnToView={() => {
              if (savedView) engineRef.current?.setCamera(savedView);
            }}
            onJump={(point) => {
              focusOn(pointFocus(point));
              select({ point, poi: null, markerId: null });
            }}
          />

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
              <span>Click the map to save, copy or measure · hover for coordinates</span>
            )}
          </div>

          <MeasurePanel />
        </>
      )}

      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}

      {selection && snapshot && !measuring && (
        <SelectionCard
          key={`${selection.point.x},${selection.point.y},${selection.markerId},${selection.poi?.rawName}`}
          selection={selection}
          loot={loot}
          cellSize={snapshot.compiledCellSize}
          chunkSize={snapshot.chunkSize}
          onClose={() => select(null)}
        />
      )}
    </div>
  );
}
