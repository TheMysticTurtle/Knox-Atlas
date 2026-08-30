import { useEffect, useMemo, useState } from "react";

import { FilterPanel } from "./components/FilterPanel";
import { MapStage } from "./components/MapStage";
import { loadPois, loadSnapshot } from "./data";
import { poiSubIds } from "./engine/subcategories";
import type { GameSnapshot, MapPoi } from "./engine/types";

export function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [pois, setPois] = useState<MapPoi[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then((loaded) => {
        if (cancelled) return undefined;
        setSnapshot(loaded);
        return loadPois(loaded.installPath);
      })
      .then((loadedPois) => {
        if (loadedPois && !cancelled) setPois(loadedPois);
      })
      .catch((cause) => !cancelled && setError(String(cause)));
    return () => {
      cancelled = true;
    };
  }, []);

  // POI counts per sub-bucket id (`<category>:<sub>`) for the filter rows.
  const subCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const poi of pois) {
      for (const id of poiSubIds(poi)) counts[id] = (counts[id] ?? 0) + 1;
    }
    return counts;
  }, [pois]);

  return (
    <div className="app-shell">
      <FilterPanel subCounts={subCounts} />
      <MapStage snapshot={snapshot} pois={pois} error={error} />
    </div>
  );
}
