import { useEffect, useRef, useState } from "react";

import { loadPois, loadSnapshot } from "../data";
import { MapEngine } from "../engine/mapEngine";
import type { GameSnapshot } from "../engine/types";

/** The map surface: loads a snapshot, then hands a canvas to the (non-React) MapEngine to draw. */
export function MapStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then((loaded) => !cancelled && setSnapshot(loaded))
      .catch((cause) => !cancelled && setError(String(cause)));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!snapshot || !canvasRef.current) return;
    const engine = new MapEngine(canvasRef.current, snapshot);
    // POIs load independently (heavier); the engine draws them once they arrive.
    loadPois(snapshot.installPath)
      .then((pois) => engine.setPois(pois))
      .catch((cause) => console.warn("POIs failed to load:", cause));
    return () => engine.dispose();
  }, [snapshot]);

  return (
    <div className="map-stage">
      <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive Knox Country map" />
      {!snapshot && !error && <div className="map-status">Reading Knox Country…</div>}
      {error && <div className="map-status map-status-error">Couldn’t load the map: {error}</div>}
    </div>
  );
}
