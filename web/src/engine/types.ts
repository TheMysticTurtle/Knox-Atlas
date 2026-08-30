// Mirrors the serialized `GameSnapshot` from `crates/core` (serde camelCase). Keep in sync with
// crates/core/src/types.rs.

export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export type MapFeatureKind = "water" | "road" | "railway" | "building" | "terrain" | "place";
export type MapFeature = {
  kind: MapFeatureKind;
  value: string;
  detail?: string;
  points: Point[];
};

export type Street = { name: string; width: number; points: Point[] };

export type MapLabel = {
  text: string;
  kind: string;
  style: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};

export type PoiKind = "business" | "vehicle" | "loot" | "resource";
export type Poi = {
  label: string;
  kind: PoiKind;
  category: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  source: string;
  details: string;
  vehicleTypes: string[];
  expectedQuality?: number;
  partDamageChance?: number;
};

export type SaveInfo = {
  name: string;
  group: string;
  center?: Point;
  isometric: boolean;
};

export type SnapshotCounts = {
  buildings: number;
  streets: number;
  labels: number;
  businesses: number;
  vehicleZones: number;
  lootZones: number;
};

// --- RoomDef-derived layer (crates/core: category.rs, poi.rs, distributions.rs) ---

export type Category =
  | "food"
  | "alcohol"
  | "weapons"
  | "medical"
  | "tools"
  | "knowledge"
  | "fishing"
  | "electronics"
  | "clothing"
  | "fuel"
  | "homes";

/** A findable place on the map (a categorized room). Loot is looked up by `rawName` in `RoomLoot`. */
export type MapPoi = {
  name: string;
  rawName: string;
  categories: Category[];
  x: number;
  y: number;
  floor: number;
};

export type LootItem = { item: string; weight: number };
/** room type (lowercase) → expected items. */
export type RoomLoot = Record<string, LootItem[]>;

export type GameSnapshot = {
  gameTitle: string;
  steamBuildId?: string;
  installPath: string;
  mapDirectory: string;
  compiledCellSize: number;
  chunkSize: number;
  bounds: Bounds;
  initialCenter: Point;
  save?: SaveInfo;
  features: MapFeature[];
  streets: Street[];
  labels: MapLabel[];
  pois: Poi[];
  counts: SnapshotCounts;
  warnings: string[];
};
