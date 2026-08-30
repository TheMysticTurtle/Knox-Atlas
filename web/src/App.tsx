import { useEffect, useMemo, useState } from "react";

import { FilterPanel } from "./components/FilterPanel";
import { MapStage } from "./components/MapStage";
import { loadPois, loadSnapshot } from "./data";
import type { Category, GameSnapshot, MapPoi } from "./engine/types";
import { LOOT_CATEGORIES } from "./store";

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

  // POI counts per category for the filter rows.
  const counts = useMemo(() => {
    const tally = Object.fromEntries(LOOT_CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
    for (const poi of pois) {
      for (const category of poi.categories) {
        if (category in tally) tally[category] += 1;
      }
    }
    return tally;
  }, [pois]);

  return (
    <div className="app-shell">
      <FilterPanel counts={counts} />
      <MapStage snapshot={snapshot} pois={pois} error={error} />
    </div>
  );
}
