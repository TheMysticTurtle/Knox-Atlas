import { useEffect, useRef, useState } from "react";

import { MapEngine } from "../engine/mapEngine";
import type { GameSnapshot, MapPoi, RoomLoot } from "../engine/types";
import { useFilters } from "../store";
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
  const [selected, setSelected] = useState<MapPoi | null>(null);

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    engine.onSelectPoi = (poi) => setSelected(poi);
    engineRef.current = engine;
    return () => {
      engine.dispose();
      engineRef.current = undefined;
      setSelected(null);
    };
  }, [snapshot]);

  // Re-apply on data or engine (re)creation.
  useEffect(() => {
    engineRef.current?.setPois(pois);
  }, [pois, snapshot]);

  useEffect(() => {
    engineRef.current?.setEnabledSubs(enabled);
  }, [enabled, snapshot]);

  return (
    <div className="map-stage">
      <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive Knox Country map" />
      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}
      {selected && <SelectionCard poi={selected} loot={loot} onClose={() => setSelected(null)} />}
    </div>
  );
}
