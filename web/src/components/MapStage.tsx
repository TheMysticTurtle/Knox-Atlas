import { useEffect, useRef } from "react";

import { MapEngine } from "../engine/mapEngine";
import type { Category, GameSnapshot, MapPoi } from "../engine/types";
import { useFilters } from "../store";

type MapStageProps = {
  snapshot?: GameSnapshot;
  pois: MapPoi[];
  error?: string;
};

/** The map surface: hands a canvas to the (non-React) MapEngine and syncs it with data + filters. */
export function MapStage({ snapshot, pois, error }: MapStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<MapEngine | undefined>(undefined);
  const enabled = useFilters((state) => state.enabled);

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = undefined;
    };
  }, [snapshot]);

  // Re-apply on data or engine (re)creation.
  useEffect(() => {
    engineRef.current?.setPois(pois);
  }, [pois, snapshot]);

  useEffect(() => {
    const active = (Object.keys(enabled) as Category[]).filter((category) => enabled[category]);
    engineRef.current?.setEnabledCategories(active);
  }, [enabled, snapshot]);

  return (
    <div className="map-stage">
      <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive Knox Country map" />
      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}
    </div>
  );
}
