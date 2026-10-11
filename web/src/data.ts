import type { GameSnapshot, MapPoi, RoomLoot, SatelliteInfo } from "./engine/types";

/**
 * Load the map snapshot. In the Tauri desktop app this reads the installed game live; in a plain
 * browser (dev, or the future served web view) it falls back to a pre-generated `snapshot.json`
 * (produce it with `cargo run -p knox-atlas-core --example dump_snapshot`).
 */
export async function loadSnapshot(): Promise<GameSnapshot> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<GameSnapshot>("load_game_snapshot", { gameRoot: null });
  }
  const response = await fetch("/snapshot.json");
  if (!response.ok) {
    throw new Error(`Could not load snapshot.json (HTTP ${response.status})`);
  }
  return (await response.json()) as GameSnapshot;
}

/** Categorized RoomDef POIs (the "findable places" dots). `gameRoot` comes from the loaded snapshot. */
export async function loadPois(gameRoot: string): Promise<MapPoi[]> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<MapPoi[]>("load_room_pois", { gameRoot });
  }
  return fetchJson<MapPoi[]>("/pois.json");
}

/** room type → expected loot table (looked up by a POI's `rawName` on click). */
export async function loadLoot(gameRoot: string): Promise<RoomLoot> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<RoomLoot>("load_room_loot", { gameRoot });
  }
  return fetchJson<RoomLoot>("/loot.json");
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url} (HTTP ${response.status})`);
  return (await response.json()) as T;
}

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function loadSatelliteInfo(gameRoot: string): Promise<SatelliteInfo> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<SatelliteInfo>("load_satellite_info", { gameRoot });
  }
  return fetchJson<SatelliteInfo>("/__atlas_satellite/info");
}

export async function loadSatelliteTile(gameRoot: string, level: number, x: number, y: number, signal: AbortSignal): Promise<Blob> {
  if (isTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<ArrayBuffer>("load_satellite_tile", { gameRoot, level, x, y });
    signal.throwIfAborted();
    return new Blob([bytes], { type: "image/png" });
  }
  const response = await fetch(`/__atlas_satellite/${level}/${x}/${y}`, { signal });
  if (!response.ok) throw new Error(`Satellite tile could not be read (HTTP ${response.status})`);
  return response.blob();
}
