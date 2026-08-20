import { useEffect } from "react";
import { useAppStore } from "./store";

// Scaffold placeholder. Replaced during Phase S by the map stage (canvas engine) + filter panels.
export function App() {
  const ready = useAppStore((state) => state.ready);
  const setReady = useAppStore((state) => state.setReady);

  useEffect(() => setReady(true), [setReady]);

  return (
    <main className="scaffold">
      <span className="brand">KNOX<small>ATLAS</small></span>
      <p>Core-evolution scaffold — {ready ? "React shell online" : "booting"}.</p>
      <p className="hint">Map engine + parity port land next (Phase S).</p>
    </main>
  );
}
