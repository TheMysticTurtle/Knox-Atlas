import { useEffect, useMemo, useState } from "react";

import { FilterPanel } from "./components/FilterPanel";
import { MapStage } from "./components/MapStage";
import { loadLoot, loadPois, loadSnapshot } from "./data";
import { poiSubIds } from "./engine/subcategories";
import type { GameSnapshot, MapPoi, RoomLoot } from "./engine/types";

export function App() {
  const [snapshot, setSnapshot] = useState<GameSnapshot>();
  const [pois, setPois] = useState<MapPoi[]>([]);
  const [loot, setLoot] = useState<RoomLoot>({});
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    loadSnapshot()
      .then((loaded) => {
        if (cancelled) return;
        setSnapshot(loaded);
        loadPois(loaded.installPath)
          .then((loadedPois) => !cancelled && setPois(loadedPois))
          .catch((cause) => console.warn("POIs failed:", cause));
        loadLoot(loaded.installPath)
          .then((loadedLoot) => !cancelled && setLoot(loadedLoot))
          .catch((cause) => console.warn("Loot failed:", cause));
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
      <MapStage snapshot={snapshot} pois={pois} loot={loot} error={error} />
    </div>
  );
}
