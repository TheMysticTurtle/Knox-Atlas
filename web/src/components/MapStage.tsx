import { useEffect, useMemo, useRef, useState } from "react";

import { MapEngine } from "../engine/mapEngine";
import { planTrip, roadGraphFor, snapToRoad } from "../engine/roadGraph";
import type { GameSnapshot, MapPoi, NavStop, Point, RoomLoot, Selection } from "../engine/types";
import { pointFocus, useMapUi } from "../mapUiStore";
import { useSaved } from "../savedStore";
import { useFilters } from "../store";
import { useView } from "../viewStore";
import { CoordinateReadout } from "./CoordinateReadout";
import { MapToolbar } from "./MapToolbar";
import { MeasurePanel } from "./MeasurePanel";
import { NavigatePanel } from "./NavigatePanel";
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
  const navOpen = useMapUi((state) => state.navOpen);
  const navStops = useMapUi((state) => state.navStops);
  const addingStops = useMapUi((state) => state.addingStops);
  const movingStop = useMapUi((state) => state.movingStop);
  const toggleNav = useMapUi((state) => state.toggleNav);
  const openRouteId = useMapUi((state) => state.openRouteId);
  const [pointer, setPointer] = useState<Point | null>(null);
  const [satelliteStatus, setSatelliteStatus] = useState("");

  // The road network is built on first use of Navigate (then cached), and the trip re-routed as
  // stops change.
  const graph = useMemo(
    () => (snapshot && navOpen ? roadGraphFor(snapshot.streets) : null),
    [snapshot, navOpen],
  );
  // The engine's drag callbacks are set once; they read the current road network through this ref.
  const graphRef = useRef(graph);
  graphRef.current = graph;
  const tripResult = useMemo(() => {
    const points = navStops.map((stop) => stop.point);
    return graph && points.length >= 2 ? planTrip(graph, points) : null;
  }, [graph, navStops]);

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    // What a click means: move or add a Navigate stop, else add a measure point, else select.
    engine.onClick = (hit) => {
      const ui = useMapUi.getState();
      if (ui.movingStop !== null) ui.placeMovingStop(stopFromHit(hit));
      else if (ui.addingStops) ui.appendStop(stopFromHit(hit));
      else if (ui.measuring) ui.addMeasurePoint(hit.point);
      else ui.select(hit);
    };
    // Keep the previous object when the hovered tile is unchanged, so React skips the re-render.
    engine.onPointerPosition = (point) =>
      setPointer((previous) =>
        point && previous?.x === point.x && previous.y === point.y ? previous : point,
      );
    engine.onSatelliteStatus = setSatelliteStatus;
    // Route editing on the map: drag the line to add a bend, drag stops/bends, remove bends.
    // Bends snap onto the nearest street (like Google Maps) so the route never detours off-road.
    const onRoad = (point: Point) => (graphRef.current ? snapToRoad(graphRef.current, point) : point);
    engine.onAddBend = (index, point) => useMapUi.getState().addBend(index, onRoad(point));
    engine.onDragStop = (index, point) => {
      const ui = useMapUi.getState();
      ui.dragStop(index, ui.navStops[index]?.via ? onRoad(point) : point);
    };
    engine.onRemoveBend = (index) => useMapUi.getState().removeStop(index);
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

  // A saved route open in Navigate is drawn live by Navigate, so hide its saved copy meanwhile.
  useEffect(() => {
    const shown = navOpen && openRouteId ? paths.filter((path) => path.id !== openRouteId) : paths;
    engineRef.current?.setAnnotations({ markers, paths: shown, measurement });
  }, [markers, paths, measurement, navOpen, openRouteId, snapshot]);

  useEffect(() => {
    engineRef.current?.setSelection(selection);
  }, [selection, snapshot]);

  useEffect(() => {
    engineRef.current?.setNavigation({
      stops: navOpen ? navStops : [],
      trip: navOpen && tripResult?.ok ? tripResult.trip : null,
    });
  }, [navOpen, navStops, tripResult, snapshot]);

  useEffect(() => {
    engineRef.current?.setPlacingCursor(measuring || addingStops || movingStop !== null);
  }, [measuring, addingStops, movingStop, snapshot]);

  useEffect(() => {
    if (focus) engineRef.current?.focus(focus.bounds);
  }, [focus]);

  // Esc: cancel moving/adding route stops, else stop measuring, else close the popup.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const ui = useMapUi.getState();
      if (ui.movingStop !== null) ui.startMovingStop(null);
      else if (ui.addingStops) ui.setAddingStops(false);
      else if (ui.measuring) ui.finishMeasure();
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
            navOpen={navOpen}
            onToggleNavigate={toggleNav}
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
          {navOpen && <NavigatePanel bounds={snapshot.bounds} result={tripResult} />}
        </>
      )}

      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}

      {selection && snapshot && !measuring && !addingStops && movingStop === null && (
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

/** Name a picked Navigate stop after what was clicked: a saved place, a store, or its coordinates. */
function stopFromHit(hit: Selection): NavStop {
  const marker = hit.markerId
    ? useSaved.getState().markers.find((item) => item.id === hit.markerId)
    : undefined;
  return { point: hit.point, label: marker?.label ?? hit.poi?.name ?? `${hit.point.x}, ${hit.point.y}` };
}
