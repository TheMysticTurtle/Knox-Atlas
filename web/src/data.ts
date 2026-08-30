import type { GameSnapshot, MapPoi, RoomLoot } from "./engine/types";

/**
 * Load the map snapshot. In the Tauri desktop app this reads the installed game live; in a plain
 * browser (dev, or the future served web view) it falls back to a pre-generated `snapshot.json`
 * (produce it with `cargo run -p knox-atlas-core --example dump_snapshot > web/public/snapshot.json`).
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
