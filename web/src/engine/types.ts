// Mirrors the serialized `GameSnapshot` from `crates/core` (serde camelCase). Keep in sync with
// crates/core/src/types.rs.

export type Point = { x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

/**
 * What a map click hit, and what the map has selected: always a tile point, plus the saved place
 * (`markerId`) or room POI under it, if any. Saved places win over POIs.
 */
export type Selection = { point: Point; poi: MapPoi | null; markerId: string | null };

// --- user annotations (saved by the app; shapes are the released 0.1.x storage contract) ---

export type MarkerColor = "amber" | "teal" | "red" | "blue" | "violet" | "green" | "white";

/**
 * Your-map organisation fields (newer, optional — the released app ignores them): the id of the user
 * group an item is filed in, and whether it is hidden from the map.
 */
type Organised = { group?: string; hidden?: boolean };

export type SavedMarker = Point & { id: string; label: string; color: MarkerColor } & Organised;
/**
 * A saved line. `stops` makes it a saved ROUTE (reopens in Navigate); it is an optional addition to
 * the released 0.1.x shape, which ignores it — old apps still see and draw the line.
 */
export type SavedPath = {
  id: string;
  label: string;
  color: MarkerColor;
  points: Point[];
  stops?: NavStop[];
} & Organised;

/** The three Your-map sections; each has its own (one-tier) user groups. */
export type SavedSection = "places" | "routes" | "paths";
export type SavedGroup = { id: string; name: string; section: SavedSection; collapsed?: boolean };
/** Your-map organisation: user groups and which sections are collapsed. */
export type SavedLayout = { groups: SavedGroup[]; collapsed: SavedSection[] };
/** A saved camera: world center + zoom scale (CSS pixels per tile). */
export type SavedView = Point & { scale: number };

/**
 * A Navigate stop: where, plus a readable name (a place, a store, or its coordinates). A `via` stop
 * is a bend made by dragging the route: it shapes the route but isn't a numbered, listed stop.
 */
export type NavStop = { point: Point; label: string; via?: boolean };

/** Everything user-authored the engine draws on top of the map. */
export type Annotations = {
  markers: SavedMarker[];
  paths: SavedPath[];
  /** The in-progress measurement line (empty when not measuring). */
  measurement: Point[];
};

/** Metadata from the installed game's image pyramid; levels are resolutions, not Z floors. */
export type SatelliteInfo = {
  bounds: Bounds;
  imageWidth: number;
  imageHeight: number;
  tileSize: number;
  levels: number[];
};

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
