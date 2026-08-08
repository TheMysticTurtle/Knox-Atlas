import { invoke } from "@tauri-apps/api/core";

type Point = { x: number; y: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type MapFeature = {
  kind: "water" | "road" | "railway" | "building" | "terrain" | "place";
  value: string;
  detail?: string;
  points: Point[];
};
type Street = { name: string; width: number; points: Point[] };
type MapLabel = {
  text: string;
  kind: string;
  style: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
};
type Poi = {
  label: string;
  kind: "business" | "vehicle" | "loot" | "resource";
  category: PoiCategory;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  source: string;
  details: string;
  vehicleTypes: Array<"cars" | "vans" | "trucks" | "emergency">;
  expectedQuality?: number;
  partDamageChance?: number;
};
type SaveInfo = {
  name: string;
  group: string;
  center?: Point;
  isometric: boolean;
};
type SnapshotCounts = {
  buildings: number;
  streets: number;
  labels: number;
  businesses: number;
  vehicleZones: number;
  lootZones: number;
};
type GameSnapshot = {
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

type PoiCategory =
  | "business"
  | "food"
  | "medical"
  | "tools"
  | "security"
  | "fuel"
  | "water"
  | "vehicles";
type FilterKey =
  | "towns"
  | "streets"
  | "businesses"
  | "buildings"
  | Exclude<PoiCategory, "business">;
type PreparedFeature = MapFeature & { path: Path2D; bounds: Bounds };
type PreparedStreet = Street & { path: Path2D; bounds: Bounds; anchor: Point; angle: number };
type SearchEntry = { label: string; meta: string; point: Point; poi?: Poi };
type CustomMarker = Point & { id: string; label: string };
type FilterIcon = PoiCategory | "towns" | "streets" | "buildings";
type SubfilterItem = {
  id: string;
  label: string;
  count: number;
  color: string;
  icon?: FilterIcon;
};

const mapColors = {
  paper: "#dbd7c0",
  paperGrid: "rgba(75, 72, 64, 0.12)",
  water: "#3b8d95",
  trail: "#b97a57",
  tertiary: "#ab9e8f",
  majorRoad: "#867d71",
  railway: "#c8bfe7",
  terrain: "#c8cfaa",
  outline: "#6e695e",
  residential: "#d29e69",
  community: "#8b75eb",
  hospitality: "#7fcee1",
  industrial: "#383635",
  medical: "#e58097",
  entertainment: "#f5e13c",
  retail: "#b8cd54",
  defaultBuilding: "#baad93",
  ink: "#2d302b",
  mutedInk: "#67685f",
  selected: "#e19952",
  current: "#37a6a0",
  destination: "#d85f55",
  customMarker: "#c38a45",
} as const;

const customMarkerStorageKey = "knox-atlas.custom-markers.v1";
const customMarkerLimit = 100;

const categoryColors: Record<PoiCategory, string> = {
  business: "#2c3734",
  food: "#bf8b3d",
  medical: "#c75f70",
  tools: "#667076",
  security: "#4d6380",
  fuel: "#b2663e",
  water: "#3b8d95",
  vehicles: "#6e655c",
};

const filters: Record<FilterKey, boolean> = {
  towns: true,
  streets: true,
  businesses: true,
  buildings: true,
  food: false,
  medical: false,
  tools: false,
  security: false,
  fuel: false,
  water: false,
  vehicles: false,
};

const lootFilterKeys = ["food", "medical", "tools", "security", "fuel", "water"] as const;
const subfilterGroups = new Map<FilterKey, SubfilterItem[]>();
const subfilterState = new Map<string, boolean>();

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root was not found.");

app.innerHTML = `
  <div class="app-shell is-loading">
    <header class="topbar">
      <div class="brand" aria-label="Knox Atlas">
        <span class="brand-mark" aria-hidden="true"><i></i></span>
        <span><strong>KNOX</strong><small>ATLAS</small></span>
      </div>
      <div class="search-area">
        <label class="search-box">
          <span class="search-icon" aria-hidden="true"></span>
          <input id="search-input" type="search" placeholder="Find a town, street, or business" autocomplete="off" />
          <kbd>Ctrl K</kbd>
        </label>
        <div id="search-results" class="search-results" hidden></div>
      </div>
      <form id="coordinate-form" class="coordinate-form" aria-label="Go to coordinates">
        <label><span>X</span><input id="coordinate-x" inputmode="decimal" placeholder="10820" aria-label="X coordinate" /></label>
        <label><span>Y</span><input id="coordinate-y" inputmode="decimal" placeholder="9650" aria-label="Y coordinate" /></label>
        <button type="submit">Go</button>
      </form>
      <div class="source-state">
        <span class="status-light"></span>
        <span><strong id="source-status">Reading local data</strong><small id="build-status">Project Zomboid</small></span>
      </div>
    </header>

    <main class="workspace">
      <aside class="filter-panel" aria-label="Map layers">
        <div class="panel-heading">
          <div><p>MAP LAYERS</p><h1>What are you looking for?</h1></div>
          <button id="collapse-filters" class="icon-button panel-close" aria-label="Hide map layers">×</button>
        </div>

        <section class="filter-section">
          <h2>Orientation</h2>
          <div id="orientation-filters" class="filter-list"></div>
        </section>
        <section class="filter-section">
          <div class="section-title"><h2>Likely loot</h2><span>zone-based</span></div>
          <div id="loot-filters" class="filter-list"></div>
          <p class="filter-note">Broad hints inferred from game spawn zones—not guaranteed item locations.</p>
        </section>
        <div class="source-card">
          <span class="source-card-icon" aria-hidden="true"></span>
          <div><strong>Local game source</strong><p id="source-detail">Discovering your installation…</p></div>
        </div>
      </aside>

      <section class="map-stage" aria-label="Interactive Knox Country map">
        <canvas id="map-canvas" aria-label="Interactive map. Drag to pan and use the mouse wheel to zoom."></canvas>

        <div id="loading-state" class="loading-state" role="status">
          <div class="loader-compass"><i></i></div>
          <strong>Reading Knox Country</strong>
          <span>Parsing the map files already installed by the game…</span>
        </div>

        <div class="map-tools" aria-label="Map controls">
          <button id="show-filters" class="icon-button layers-button" aria-label="Show map layers" data-tooltip="Show map layers">
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 6h14M5 12h14M5 18h14"/><circle cx="8" cy="6" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="10" cy="18" r="1.6"/></svg>
          </button>
          <span class="tool-separator"></span>
          <button id="zoom-in" class="icon-button" aria-label="Zoom in" data-tooltip="Zoom in">
            <svg class="tool-icon tool-icon-large" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button id="zoom-out" class="icon-button" aria-label="Zoom out" data-tooltip="Zoom out">
            <svg class="tool-icon tool-icon-large" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14"/></svg>
          </button>
          <button id="reset-view" class="icon-button reset-icon" aria-label="Return to latest map view" data-tooltip="Latest saved view">
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="3.5"/><path d="M12 3v4M12 17v4M3 12h4M17 12h4"/></svg>
          </button>
          <button id="fit-map" class="icon-button fit-icon" aria-label="Fit the whole map" data-tooltip="Fit whole map">
            <svg class="tool-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5H5v4M15 5h4v4M19 15v4h-4M9 19H5v-4"/></svg>
          </button>
        </div>

        <div id="save-context" class="save-context" hidden>
          <span class="eyebrow">LATEST LOCAL SAVE</span>
          <strong id="save-name">No save selected</strong>
          <span id="save-note">Starting near the last in-game map view</span>
        </div>

        <div id="selection-card" class="selection-card" hidden>
          <button id="close-selection" class="selection-close" aria-label="Close selection">×</button>
          <span id="selection-kind" class="eyebrow">SELECTED COORDINATE</span>
          <strong id="selection-title">Map point</strong>
          <p id="selection-detail"></p>
          <div class="selection-coordinates" aria-label="Selected map coordinates">
            <div><span>X</span><strong id="selection-x">—</strong></div>
            <div><span>Y</span><strong id="selection-y">—</strong></div>
            <div><span>CELL</span><strong id="selection-cell">—</strong></div>
            <div><span>CHUNK</span><strong id="selection-chunk">—</strong></div>
          </div>
          <div class="selection-actions">
            <button id="set-current" class="position-action"><i aria-hidden="true"></i>Set position</button>
            <button id="clear-current-selection" class="clear-route-action position-clear-action" disabled><span aria-hidden="true">&times;</span>Clear position</button>
            <button id="set-destination" class="destination-action"><i aria-hidden="true"></i>Set destination</button>
            <button id="clear-destination-selection" class="clear-route-action destination-clear-action" disabled><span aria-hidden="true">&times;</span>Clear destination</button>
            <button id="add-custom-marker" class="marker-action"><i aria-hidden="true"></i>Add marker</button>
            <button id="copy-selection-coordinates" class="copy-selection"><i class="copy-icon" aria-hidden="true"></i><span id="selection-copy-label">Copy X/Y</span></button>
          </div>
          <form id="marker-form" class="marker-form" hidden>
            <label for="marker-name">Marker name</label>
            <div>
              <input id="marker-name" maxlength="40" autocomplete="off" placeholder="Safehouse, meetup, supplies&hellip;" />
              <button id="save-marker" type="submit">Save</button>
              <button id="cancel-marker" type="button">Cancel</button>
            </div>
            <span id="marker-form-note">Saved locally on this computer.</span>
          </form>
        </div>

        <section id="marker-panel" class="marker-panel" aria-label="Custom map markers" hidden>
          <div class="marker-panel-heading">
            <div><span class="eyebrow">CUSTOM MARKERS</span><strong id="marker-panel-title">Saved places</strong></div>
            <div class="marker-panel-controls">
              <button id="toggle-markers" class="marker-collapse" type="button" aria-label="Collapse custom markers" aria-expanded="true" title="Collapse custom markers">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m5 7.5 5 5 5-5"/></svg>
              </button>
            </div>
          </div>
          <div id="marker-list" class="marker-list"></div>
        </section>

        <div id="route-readout" class="route-readout" hidden>
          <div class="route-point">
            <i class="route-dot position-dot" aria-hidden="true"></i>
            <span>POSITION</span><strong id="current-coordinate">Not set</strong>
            <button id="clear-current" type="button" aria-label="Clear position">×</button>
          </div>
          <div class="route-point">
            <i class="route-dot destination-dot" aria-hidden="true"></i>
            <span>DESTINATION</span><strong id="destination-coordinate">Not set</strong>
            <button id="clear-destination" type="button" aria-label="Clear destination">×</button>
          </div>
          <div id="route-distance-row" class="route-distance"><span>DIRECT DISTANCE</span><strong id="route-distance">0 tiles</strong></div>
        </div>

        <div class="coordinate-hud">
          <div><span>X</span><strong id="pointer-x">—</strong></div>
          <div><span>Y</span><strong id="pointer-y">—</strong></div>
          <div><span>CELL</span><strong id="pointer-cell">—</strong></div>
          <div><span>CHUNK</span><strong id="pointer-chunk">—</strong></div>
        </div>

        <p class="map-credit">Game-derived vector data · Read-only companion</p>
      </section>
    </main>
  </div>
`;

const canvas = must<HTMLCanvasElement>("#map-canvas");
const canvasContext = canvas.getContext("2d", { alpha: false });
if (!canvasContext) throw new Error("2D canvas is not supported by this WebView.");
const context: CanvasRenderingContext2D = canvasContext;

let snapshot: GameSnapshot;
let preparedFeatures: PreparedFeature[] = [];
let preparedStreets: PreparedStreet[] = [];
let searchEntries: SearchEntry[] = [];
let center: Point = { x: 0, y: 0 };
let scale = 0.22;
let pointerWorld: Point | undefined;
let selectedPoint: Point | undefined;
let selectedPoi: Poi | undefined;
let currentPosition: Point | undefined;
let destination: Point | undefined;
let customMarkers = loadCustomMarkers();
let editingMarkerId: string | undefined;
let selectedCustomMarkerId: string | undefined;
let dragging = false;
let dragMoved = false;
let dragOrigin = { x: 0, y: 0 };
let centerOrigin = { x: 0, y: 0 };
let renderQueued = false;

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Required element not found: ${selector}`);
  return element;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US", { notation: value > 9999 ? "compact" : "standard" }).format(value);
}

function buildPath(points: Point[], close = true): Path2D {
  const path = new Path2D();
  const first = points[0];
  if (!first) return path;
  path.moveTo(first.x, first.y);
  for (let index = 1; index < points.length; index += 1) {
    path.lineTo(points[index].x, points[index].y);
  }
  if (close && points.length > 2) path.closePath();
  return path;
}

function pointBounds(points: Point[]): Bounds {
  const bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const point of points) {
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
  }
  return bounds;
}

function streetAnchor(points: Point[]): { anchor: Point; angle: number } {
  let bestLength = 0;
  let anchor = points[0] ?? { x: 0, y: 0 };
  let angle = 0;
  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length > bestLength) {
      bestLength = length;
      anchor = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
      angle = Math.atan2(end.y - start.y, end.x - start.x);
      if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;
    }
  }
  return { anchor, angle };
}

function prepareData(data: GameSnapshot): void {
  preparedFeatures = data.features.map((feature) => ({
    ...feature,
    path: buildPath(feature.points, feature.kind !== "railway"),
    bounds: pointBounds(feature.points),
  }));
  preparedStreets = data.streets.map((street) => {
    const label = streetAnchor(street.points);
    return {
      ...street,
      path: buildPath(street.points, false),
      bounds: pointBounds(street.points),
      anchor: label.anchor,
      angle: label.angle,
    };
  });

  const seen = new Set<string>();
  searchEntries = [];
  for (const label of data.labels) {
    const key = `${label.text}|${Math.round(label.x / 100)}|${Math.round(label.y / 100)}`;
    if (!seen.has(key)) {
      seen.add(key);
      searchEntries.push({ label: label.text, meta: label.kind === "town" ? "Town / area" : "Map label", point: label });
    }
  }
  for (const street of preparedStreets) {
    const key = `street|${street.name}`;
    if (!seen.has(key)) {
      seen.add(key);
      searchEntries.push({ label: street.name, meta: "Street", point: street.anchor });
    }
  }
  for (const poi of data.pois) {
    if (poi.kind !== "business") continue;
    const key = `${poi.label}|${Math.round(poi.x / 250)}|${Math.round(poi.y / 250)}`;
    if (!seen.has(key)) {
      seen.add(key);
      searchEntries.push({ label: poi.label, meta: "Game zone", point: poi, poi });
    }
  }
}

const filterDefinitions: Array<{
  group: "orientation" | "loot";
  key: FilterKey;
  label: string;
  description: string;
  color: string;
  icon: FilterIcon;
  count: (data: GameSnapshot) => number;
}> = [
  { group: "orientation", key: "towns", label: "Towns & areas", description: "Official map labels", color: "#d8ad68", icon: "towns", count: (data) => data.labels.filter((item) => ["town", "area", "water"].includes(item.kind)).length },
  { group: "orientation", key: "streets", label: "Street names", description: "Visible as you zoom in", color: "#a9a69b", icon: "streets", count: (data) => data.counts.streets },
  { group: "orientation", key: "vehicles", label: "Drivable vehicle pools", description: "Cars, vans, trucks & services", color: categoryColors.vehicles, icon: "vehicles", count: (data) => data.counts.vehicleZones },
  { group: "orientation", key: "businesses", label: "Businesses", description: "Choose activity types", color: "#98b26b", icon: "business", count: (data) => data.counts.businesses },
  { group: "orientation", key: "buildings", label: "Building types", description: "In-game color legend", color: "#a6805e", icon: "buildings", count: (data) => data.counts.buildings },
  { group: "loot", key: "food", label: "Food", description: "Grocers, kitchens, dining", color: categoryColors.food, icon: "food", count: (data) => data.pois.filter((poi) => poi.category === "food").length },
  { group: "loot", key: "medical", label: "Medical", description: "Clinics and pharmacies", color: categoryColors.medical, icon: "medical", count: (data) => data.pois.filter((poi) => poi.category === "medical").length },
  { group: "loot", key: "tools", label: "Tools & materials", description: "Industrial and hardware", color: categoryColors.tools, icon: "tools", count: (data) => data.pois.filter((poi) => poi.category === "tools").length },
  { group: "loot", key: "security", label: "Security & services", description: "Police, fire, military", color: categoryColors.security, icon: "security", count: (data) => data.pois.filter((poi) => poi.category === "security").length },
  { group: "loot", key: "fuel", label: "Fuel & gas", description: "Gas station activity zones", color: categoryColors.fuel, icon: "fuel", count: (data) => data.pois.filter((poi) => poi.category === "fuel").length },
  { group: "loot", key: "water", label: "Water zones", description: "Authored zones; waterways stay visible", color: categoryColors.water, icon: "water", count: (data) => data.pois.filter((poi) => poi.category === "water").length },
];

function filterIcon(icon: FilterIcon): string {
  const paths: Record<FilterIcon, string> = {
    towns: '<path d="M12 3 6 9v10h12V9l-6-6Zm-3 15v-6h6v6"/>',
    streets: '<path d="M5 4h4l1 5h4l1-5h4M8 20l1-6h6l1 6"/>',
    buildings: '<path d="M4 20V8l8-5 8 5v12M8 20v-7h8v7M4 9h16"/>',
    business: '<path d="M4 9h16l-2-5H6L4 9Zm1 0v11h14V9M9 20v-6h6v6"/>',
    food: '<path d="M7 3v7m-2-7v4a2 2 0 0 0 4 0V3m-2 7v11M16 3v18m0-18c3 2 3 7 0 9"/>',
    medical: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z"/>',
    tools: '<path d="m14 6 4-3 3 3-3 4-3-1-7 7 1 2-2 2-3-3 2-2 2 1 7-7-1-3Z"/>',
    security: '<path d="m12 3 7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3Z"/>',
    fuel: '<path d="M5 21V4h10v17M5 9h10M8 17h4m3-10 3 2v8a2 2 0 0 0 4 0v-6l-2-2"/>',
    water: '<path d="M12 3S6 10 6 15a6 6 0 0 0 12 0c0-5-6-12-6-12Z"/>',
    vehicles: '<path d="m5 9 2-5h10l2 5 2 2v6h-2v3h-3v-3H8v3H5v-3H3v-6l2-2Zm1 2h12M7 14h.01M17 14h.01"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[icon]}</svg>`;
}

function countByLabel(pois: Poi[], category: PoiCategory): SubfilterItem[] {
  const counts = new Map<string, number>();
  for (const poi of pois) {
    if (poi.category !== category) continue;
    counts.set(poi.label, (counts.get(poi.label) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ id: `${category}:${label}`, label, count, color: categoryColors[category], icon: category }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function setSubfilterGroup(key: FilterKey, items: SubfilterItem[]): void {
  subfilterGroups.set(key, items);
  for (const item of items) {
    if (!subfilterState.has(item.id)) subfilterState.set(item.id, filters[key]);
  }
}

function prepareSubfilters(data: GameSnapshot): void {
  const townFilters: SubfilterItem[] = [
    { id: "towns:town", label: "Town names", count: data.labels.filter((label) => label.kind === "town").length, color: "#d8ad68", icon: "towns" },
    { id: "towns:area", label: "Areas & landmarks", count: data.labels.filter((label) => label.kind === "area").length, color: "#bca777", icon: "towns" },
    { id: "towns:water", label: "Water names", count: data.labels.filter((label) => label.kind === "water").length, color: categoryColors.water, icon: "water" },
  ];
  setSubfilterGroup("towns", townFilters.filter((item) => item.count > 0));

  const businessCategories: Array<{ category: PoiCategory; label: string; icon: FilterIcon }> = [
    { category: "food", label: "Food & dining", icon: "food" },
    { category: "fuel", label: "Gas stations", icon: "fuel" },
    { category: "medical", label: "Medical", icon: "medical" },
    { category: "tools", label: "Industrial & tools", icon: "tools" },
    { category: "security", label: "Security & civic", icon: "security" },
    { category: "business", label: "Other businesses", icon: "business" },
  ];
  setSubfilterGroup("businesses", businessCategories.map(({ category, label, icon }) => ({
    id: `businesses:${category}`,
    label,
    count: data.pois.filter((poi) => poi.kind === "business" && poi.category === category).length,
    color: categoryColors[category],
    icon,
  })).filter((item) => item.count > 0));

  const buildingValues = new Map<string, number>();
  for (const feature of data.features) {
    if (feature.kind === "building") buildingValues.set(feature.value, (buildingValues.get(feature.value) ?? 0) + 1);
  }
  const buildingOrder = ["Residential", "RetailAndCommercial", "RestaurantsAndEntertainment", "Medical", "CommunityServices", "Hospitality", "Industrial", "Unclassified"];
  const buildingNames: Record<string, string> = {
    Residential: "Residential",
    RetailAndCommercial: "Retail & commercial",
    RestaurantsAndEntertainment: "Dining & entertainment",
    Medical: "Medical",
    CommunityServices: "Community services",
    Hospitality: "Hospitality",
    Industrial: "Industrial",
    Unclassified: "Unclassified buildings",
  };
  setSubfilterGroup("buildings", [...buildingValues.entries()]
    .map(([value, count]) => ({ id: `buildings:${value}`, label: buildingNames[value] ?? value, count, color: buildingColor(value) }))
    .sort((a, b) => {
      const aOrder = buildingOrder.indexOf(a.id.slice("buildings:".length));
      const bOrder = buildingOrder.indexOf(b.id.slice("buildings:".length));
      return (aOrder < 0 ? 99 : aOrder) - (bOrder < 0 ? 99 : bOrder);
    }));

  for (const category of lootFilterKeys) setSubfilterGroup(category, countByLabel(data.pois, category));
  const vehicleTypes: Array<{ id: "cars" | "vans" | "trucks" | "emergency"; label: string }> = [
    { id: "cars", label: "Cars & SUVs" },
    { id: "vans", label: "Vans & shuttles" },
    { id: "trucks", label: "Trucks & utility" },
    { id: "emergency", label: "Emergency & service" },
  ];
  setSubfilterGroup("vehicles", vehicleTypes.map(({ id, label }) => ({
    id: `vehicles:${id}`,
    label,
    count: data.pois.filter((poi) => poi.kind === "vehicle" && poi.vehicleTypes?.includes(id)).length,
    color: categoryColors.vehicles,
    icon: "vehicles" as const,
  })).filter((item) => item.count > 0));
}

function subfilterEnabled(id: string): boolean {
  return subfilterState.get(id) ?? false;
}

function syncParentFilter(key: FilterKey): void {
  const children = subfilterGroups.get(key) ?? [];
  if (!children.length) return;
  const enabled = children.filter((item) => subfilterEnabled(item.id)).length;
  filters[key] = enabled > 0;
  const parent = document.querySelector<HTMLInputElement>(`#filter-${key}`);
  if (parent) {
    parent.checked = enabled === children.length;
    parent.indeterminate = enabled > 0 && enabled < children.length;
  }
}

function renderFilters(data: GameSnapshot): void {
  prepareSubfilters(data);
  for (const group of ["orientation", "loot"] as const) {
    const target = must<HTMLDivElement>(`#${group}-filters`);
    target.innerHTML = filterDefinitions
      .filter((definition) => definition.group === group)
      .map((definition) => {
        const children = subfilterGroups.get(definition.key) ?? [];
        return `
          <div class="filter-item">
            <div class="filter-row">
              <label class="filter-main" for="filter-${definition.key}">
                <span class="filter-icon" style="--swatch:${definition.color}">${filterIcon(definition.icon)}</span>
                <span class="filter-copy"><strong>${definition.label}</strong><small>${definition.description}</small></span>
                <span class="filter-count">${formatCount(definition.count(data))}</span>
                <input id="filter-${definition.key}" type="checkbox" data-filter="${definition.key}" ${filters[definition.key] ? "checked" : ""} />
                <span class="switch" aria-hidden="true"></span>
              </label>
              ${children.length ? `<button class="expand-filter" type="button" data-expand="${definition.key}" aria-expanded="false" aria-controls="subfilters-${definition.key}" aria-label="Choose ${definition.label} types"><span>›</span></button>` : ""}
            </div>
            ${children.length ? `
              <div id="subfilters-${definition.key}" class="subfilter-list" hidden>
                ${children.map((child, index) => `
                  <label class="subfilter-row" for="subfilter-${definition.key}-${index}">
                    <input id="subfilter-${definition.key}-${index}" type="checkbox" data-subfilter="${escapeHtml(child.id)}" data-parent-filter="${definition.key}" ${subfilterEnabled(child.id) ? "checked" : ""} />
                    <span class="subfilter-check" aria-hidden="true"></span>
                    <span class="subfilter-symbol" style="--swatch:${child.color}">${child.icon ? filterIcon(child.icon) : ""}</span>
                    <span>${escapeHtml(child.label)}</span>
                    <small>${formatCount(child.count)}</small>
                  </label>
                `).join("")}
                ${definition.key === "vehicles" ? '<p class="subfilter-hint">Spawn-pool estimates. Select a marker for expected quality; live condition and key locations require save/server data.</p>' : ""}
              </div>` : ""}
          </div>`;
      }).join("");
  }

  document.querySelectorAll<HTMLInputElement>("[data-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.filter as FilterKey;
      filters[key] = input.checked;
      for (const child of subfilterGroups.get(key) ?? []) subfilterState.set(child.id, input.checked);
      document.querySelectorAll<HTMLInputElement>(`[data-parent-filter="${key}"]`).forEach((childInput) => {
        childInput.checked = input.checked;
      });
      queueRender();
    });
  });

  document.querySelectorAll<HTMLInputElement>("[data-subfilter]").forEach((input) => {
    input.addEventListener("change", () => {
      subfilterState.set(input.dataset.subfilter ?? "", input.checked);
      syncParentFilter(input.dataset.parentFilter as FilterKey);
      queueRender();
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-expand]").forEach((button) => {
    button.addEventListener("click", () => {
      const key = button.dataset.expand as FilterKey;
      const list = must<HTMLElement>(`#subfilters-${key}`);
      const expanded = button.getAttribute("aria-expanded") !== "true";
      button.setAttribute("aria-expanded", String(expanded));
      list.hidden = !expanded;
      button.closest(".filter-item")?.classList.toggle("is-expanded", expanded);
    });
  });
}

function viewportBounds(): Bounds {
  const width = canvas.clientWidth / scale;
  const height = canvas.clientHeight / scale;
  return {
    minX: center.x - width / 2,
    minY: center.y - height / 2,
    maxX: center.x + width / 2,
    maxY: center.y + height / 2,
  };
}

function intersects(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

function toScreen(point: Point): Point {
  return {
    x: (point.x - center.x) * scale + canvas.clientWidth / 2,
    y: (point.y - center.y) * scale + canvas.clientHeight / 2,
  };
}

function toWorld(clientX: number, clientY: number): Point {
  const rect = canvas.getBoundingClientRect();
  return {
    x: center.x + (clientX - rect.left - rect.width / 2) / scale,
    y: center.y + (clientY - rect.top - rect.height / 2) / scale,
  };
}

function buildingColor(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("residential")) return mapColors.residential;
  if (normalized.includes("community")) return mapColors.community;
  if (normalized.includes("hospitality")) return mapColors.hospitality;
  if (normalized.includes("industrial")) return mapColors.industrial;
  if (normalized.includes("medical")) return mapColors.medical;
  if (normalized.includes("restaurant") || normalized.includes("entertainment")) return mapColors.entertainment;
  if (normalized.includes("retail") || normalized.includes("commercial")) return mapColors.retail;
  return mapColors.defaultBuilding;
}

function drawFeature(feature: PreparedFeature): void {
  if (feature.kind === "building") {
    if (!subfilterEnabled(`buildings:${feature.value}`)) return;
    context.fillStyle = buildingColor(feature.value);
    context.fill(feature.path);
    if (scale > 0.18) {
      context.strokeStyle = mapColors.outline;
      context.lineWidth = Math.max(0.55 / scale, 1.2);
      context.stroke(feature.path);
    }
    return;
  }
  if (feature.kind === "water") {
    context.fillStyle = mapColors.water;
    context.fill(feature.path);
    return;
  }
  if (feature.kind === "terrain") {
    context.fillStyle = mapColors.terrain;
    context.globalAlpha = 0.55;
    context.fill(feature.path);
    context.globalAlpha = 1;
    return;
  }
  if (feature.kind === "road") {
    const road = feature.value.toLowerCase();
    context.fillStyle = road.includes("trail")
      ? mapColors.trail
      : road.includes("primary") || road.includes("secondary")
        ? mapColors.majorRoad
        : mapColors.tertiary;
    context.fill(feature.path);
    return;
  }
  if (feature.kind === "railway") {
    context.strokeStyle = mapColors.railway;
    context.lineWidth = Math.max(2 / scale, 5);
    context.stroke(feature.path);
  }
}

function drawGrid(view: Bounds): void {
  if (scale < 0.16) return;
  const cellSize = snapshot.compiledCellSize;
  context.beginPath();
  for (let x = Math.floor(view.minX / cellSize) * cellSize; x <= view.maxX; x += cellSize) {
    context.moveTo(x, view.minY);
    context.lineTo(x, view.maxY);
  }
  for (let y = Math.floor(view.minY / cellSize) * cellSize; y <= view.maxY; y += cellSize) {
    context.moveTo(view.minX, y);
    context.lineTo(view.maxX, y);
  }
  context.strokeStyle = mapColors.paperGrid;
  context.lineWidth = 1 / scale;
  context.stroke();
}

function labelFits(screen: Point, text: string, fontSize: number, occupied: Bounds[]): boolean {
  const width = Math.max(38, text.length * fontSize * 0.56);
  const candidate = { minX: screen.x - width / 2 - 5, minY: screen.y - fontSize, maxX: screen.x + width / 2 + 5, maxY: screen.y + 5 };
  if (candidate.maxX < 0 || candidate.minX > canvas.clientWidth || candidate.maxY < 0 || candidate.minY > canvas.clientHeight) return false;
  if (occupied.some((item) => intersects(item, candidate))) return false;
  occupied.push(candidate);
  return true;
}

function drawScreenLabel(text: string, point: Point, size: number, weight: number, color: string, occupied: Bounds[], uppercase = false): void {
  const screen = toScreen(point);
  const label = uppercase ? text.toUpperCase() : text;
  if (!labelFits(screen, label, size, occupied)) return;
  context.font = `${weight} ${size}px Inter, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "rgba(219, 215, 192, 0.94)";
  context.lineWidth = size > 15 ? 5 : 3.5;
  context.strokeText(label, screen.x, screen.y);
  context.fillStyle = color;
  context.fillText(label, screen.x, screen.y);
}

function drawMapLabels(occupied: Bounds[], townsOnly = false): void {
  for (const label of snapshot.labels) {
    const isTown = label.kind === "town";
    const isArea = label.kind === "area";
    const isWater = label.kind === "water";
    const isBusiness = label.kind === "landmark";
    if (townsOnly && !isTown) continue;
    if (isTown && !subfilterEnabled("towns:town")) continue;
    if (isArea && !subfilterEnabled("towns:area")) continue;
    if (isWater && !subfilterEnabled("towns:water")) continue;
    if (isBusiness && !subfilterEnabled("businesses:business")) continue;
    if (!isTown && !isArea && !isWater && !isBusiness && scale < 0.18) continue;
    if (isBusiness && scale < 0.18) continue;
    const townSize = Math.max(18, Math.min(28, 28 - scale * 8));
    const areaSize = Math.max(14, Math.min(19, 19 - scale * 3));
    const size = isTown ? townSize : isArea || isWater ? areaSize : Math.max(12, Math.min(16, 10 + scale * 11));
    drawScreenLabel(label.text, label, size, isTown ? 700 : 650, isTown ? mapColors.ink : mapColors.mutedInk, occupied, isTown);
  }
}

function drawStreetLabels(view: Bounds, occupied: Bounds[]): void {
  if (!filters.streets || scale < 0.26) return;
  const step = scale < 0.42 ? 3 : scale < 0.72 ? 2 : 1;
  for (let index = 0; index < preparedStreets.length; index += step) {
    const street = preparedStreets[index];
    if (!intersects(street.bounds, view)) continue;
    const screen = toScreen(street.anchor);
    const size = scale > 0.7 ? 13 : 12;
    if (!labelFits(screen, street.name, size, occupied)) continue;
    context.save();
    context.translate(screen.x, screen.y);
    context.rotate(street.angle);
    context.font = `600 ${size}px Inter, "Segoe UI", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.lineJoin = "round";
    context.strokeStyle = "rgba(219, 215, 192, 0.92)";
    context.lineWidth = 3.5;
    context.strokeText(street.name, 0, 0);
    context.fillStyle = mapColors.mutedInk;
    context.fillText(street.name, 0, 0);
    context.restore();
  }
}

function businessLayerEnabled(poi: Poi): boolean {
  return poi.kind === "business" && subfilterEnabled(`businesses:${poi.category}`);
}

function lootLayerEnabled(poi: Poi): boolean {
  if (poi.category === "business" || poi.category === "vehicles") return false;
  return filters[poi.category] && subfilterEnabled(`${poi.category}:${poi.label}`);
}

function poiIsVisible(poi: Poi): boolean {
  if (poi.kind === "vehicle") {
    return scale >= 0.42
      && filters.vehicles
      && (poi.vehicleTypes ?? ["cars"]).some((type) => subfilterEnabled(`vehicles:${type}`));
  }
  return businessLayerEnabled(poi) || lootLayerEnabled(poi);
}

function drawPoiIcon(screen: Point, category: PoiCategory, highlighted: boolean): void {
  const size = highlighted ? 20 : scale > 0.65 ? 18 : 14;
  const radius = size / 2;
  context.save();
  context.translate(screen.x, screen.y);

  if (highlighted) {
    context.beginPath();
    context.arc(0, 0, radius + 4, 0, Math.PI * 2);
    context.fillStyle = `${categoryColors[category]}30`;
    context.fill();
    context.strokeStyle = categoryColors[category];
    context.lineWidth = 1.5;
    context.stroke();
  }

  context.beginPath();
  context.arc(0, 0, radius, 0, Math.PI * 2);
  context.fillStyle = categoryColors[category];
  context.fill();
  context.strokeStyle = "rgba(255,255,255,.82)";
  context.lineWidth = 1.2;
  context.stroke();

  const unit = size / 18;
  context.scale(unit, unit);
  context.strokeStyle = "#fff8e9";
  context.fillStyle = "#fff8e9";
  context.lineWidth = 1.45;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();

  if (category === "medical") {
    context.fillRect(-1.5, -5, 3, 10);
    context.fillRect(-5, -1.5, 10, 3);
  } else if (category === "food") {
    context.moveTo(-3.5, -5);
    context.lineTo(-3.5, 5);
    context.moveTo(-5.2, -5);
    context.lineTo(-5.2, -1.5);
    context.quadraticCurveTo(-3.5, 0, -1.8, -1.5);
    context.lineTo(-1.8, -5);
    context.moveTo(3.4, -5);
    context.lineTo(3.4, 5);
    context.moveTo(3.4, -5);
    context.quadraticCurveTo(6, -1, 3.4, 1);
    context.stroke();
  } else if (category === "fuel") {
    context.rect(-4.5, -5, 6.5, 10);
    context.moveTo(-4.5, -1.5);
    context.lineTo(2, -1.5);
    context.moveTo(2, -3.5);
    context.quadraticCurveTo(5, -3, 5, 0);
    context.lineTo(5, 3.5);
    context.quadraticCurveTo(5, 5, 3.5, 5);
    context.stroke();
  } else if (category === "security") {
    context.moveTo(0, -5.5);
    context.lineTo(5, -3.5);
    context.lineTo(4.2, 1.5);
    context.quadraticCurveTo(3, 4, 0, 5.5);
    context.quadraticCurveTo(-3, 4, -4.2, 1.5);
    context.lineTo(-5, -3.5);
    context.closePath();
    context.stroke();
  } else if (category === "tools") {
    context.arc(-2.5, 2.5, 1.8, 0, Math.PI * 2);
    context.moveTo(-1.2, 1.2);
    context.lineTo(4.5, -4.5);
    context.moveTo(2.5, -5.3);
    context.lineTo(5.3, -2.5);
    context.stroke();
  } else if (category === "water") {
    context.moveTo(0, -6);
    context.bezierCurveTo(4.5, -1, 5, 1.2, 5, 2.2);
    context.arc(0, 2, 5, 0, Math.PI, true);
    context.bezierCurveTo(-5, 1.2, -4.5, -1, 0, -6);
    context.fill();
  } else if (category === "vehicles") {
    context.rect(-5.5, -2.5, 11, 5.5);
    context.moveTo(-3.5, -2.5);
    context.lineTo(-1.8, -5);
    context.lineTo(3, -5);
    context.lineTo(4.7, -2.5);
    context.stroke();
    context.beginPath();
    context.arc(-3.3, 3.2, 1.2, 0, Math.PI * 2);
    context.arc(3.3, 3.2, 1.2, 0, Math.PI * 2);
    context.fill();
  } else {
    context.moveTo(-5, -1.5);
    context.lineTo(5, -1.5);
    context.moveTo(-4, -1.5);
    context.lineTo(-4, 5);
    context.lineTo(4, 5);
    context.lineTo(4, -1.5);
    context.moveTo(-5, -1.5);
    context.lineTo(-3.5, -5);
    context.lineTo(3.5, -5);
    context.lineTo(5, -1.5);
    context.stroke();
  }
  context.restore();
}

function drawPois(view: Bounds, occupied: Bounds[]): void {
  const hasActiveLootFilter = lootFilterKeys.some((key) => filters[key]);
  for (const poi of snapshot.pois) {
    if (!poiIsVisible(poi)) continue;
    if (poi.x < view.minX || poi.x > view.maxX || poi.y < view.minY || poi.y > view.maxY) continue;
    const isHighlightedLoot = lootLayerEnabled(poi);
    const screen = toScreen(poi);

    if (hasActiveLootFilter && businessLayerEnabled(poi) && !isHighlightedLoot) {
      context.globalAlpha = 0.18;
    }
    drawPoiIcon(screen, poi.category, isHighlightedLoot);

    const showLabel = poi.kind === "business"
      && ((isHighlightedLoot && scale >= 0.3) || (!hasActiveLootFilter && scale >= 0.52));
    if (showLabel) {
      drawScreenLabel(poi.label, { x: poi.x, y: poi.y - 12 / scale }, 11, 650, mapColors.ink, occupied);
    }
    context.globalAlpha = 1;
  }
}

function drawMarker(point: Point, color: string, label: string): void {
  const screen = toScreen(point);
  context.save();
  context.translate(screen.x, screen.y);
  context.beginPath();
  context.arc(0, 0, 10, 0, Math.PI * 2);
  context.fillStyle = "rgba(255,255,255,.9)";
  context.fill();
  context.beginPath();
  context.arc(0, 0, 6, 0, Math.PI * 2);
  context.fillStyle = color;
  context.fill();
  context.strokeStyle = "rgba(31,39,37,.8)";
  context.lineWidth = 1.5;
  context.stroke();
  context.font = '700 11px Inter, "Segoe UI", sans-serif';
  context.textAlign = "center";
  context.strokeStyle = "rgba(219,215,192,.96)";
  context.lineWidth = 4;
  context.strokeText(label, 0, -17);
  context.fillStyle = mapColors.ink;
  context.fillText(label, 0, -17);
  context.restore();
}

function drawRoute(): void {
  if (!currentPosition || !destination) return;
  const start = toScreen(currentPosition);
  const end = toScreen(destination);
  context.save();
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.setLineDash([8, 7]);
  context.strokeStyle = "rgba(45,48,43,.72)";
  context.lineWidth = 2;
  context.stroke();
  context.restore();
}

function customMarkerAt(point: Point): CustomMarker | undefined {
  const radius = Math.max(18 / scale, 16);
  return customMarkers
    .map((marker) => ({ marker, distance: Math.hypot(point.x - marker.x, point.y - marker.y) }))
    .filter(({ distance }) => distance < radius)
    .sort((left, right) => left.distance - right.distance)[0]?.marker;
}

function draw(): void {
  renderQueued = false;
  if (!snapshot) return;
  const deviceScale = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * deviceScale));
  const height = Math.max(1, Math.round(canvas.clientHeight * deviceScale));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  context.fillStyle = mapColors.paper;
  context.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

  const view = viewportBounds();
  context.setTransform(
    deviceScale * scale,
    0,
    0,
    deviceScale * scale,
    deviceScale * (canvas.clientWidth / 2 - center.x * scale),
    deviceScale * (canvas.clientHeight / 2 - center.y * scale),
  );
  drawGrid(view);
  for (const kind of ["terrain", "water", "road", "railway", "building"] as const) {
    for (const feature of preparedFeatures) {
      if (feature.kind === kind && intersects(feature.bounds, view)) drawFeature(feature);
    }
  }

  context.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
  const occupied: Bounds[] = [];
  drawMapLabels(occupied);
  drawStreetLabels(view, occupied);
  drawPois(view, occupied);
  drawRoute();
  for (const marker of customMarkers) {
    const label = marker.label.length > 24 ? `${marker.label.slice(0, 21)}...` : marker.label;
    drawMarker(marker, mapColors.customMarker, label);
  }
  if (currentPosition) drawMarker(currentPosition, mapColors.current, "YOU");
  if (destination) drawMarker(destination, mapColors.destination, "DESTINATION");
  const selectedMatchesRoute = selectedPoint
    && [currentPosition, destination].some((point) => point && Math.hypot(point.x - selectedPoint!.x, point.y - selectedPoint!.y) < 0.5);
  const selectedMatchesCustomMarker = selectedPoint
    && customMarkers.some((marker) => Math.hypot(marker.x - selectedPoint!.x, marker.y - selectedPoint!.y) < 0.5);
  if (selectedPoint && !selectedPoi && !selectedMatchesRoute && !selectedMatchesCustomMarker) {
    drawMarker(selectedPoint, mapColors.selected, "SELECTED");
  }

  // Towns participate in collision avoidance above, then receive a final topmost
  // pass so dense POI and vehicle layers can never obscure their names.
  drawMapLabels([], true);
}

function loadCustomMarkers(): CustomMarker[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(customMarkerStorageKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value): CustomMarker[] => {
      if (!value || typeof value !== "object") return [];
      const candidate = value as Partial<CustomMarker>;
      if (
        typeof candidate.id !== "string"
        || typeof candidate.label !== "string"
        || typeof candidate.x !== "number"
        || typeof candidate.y !== "number"
        || !Number.isFinite(candidate.x)
        || !Number.isFinite(candidate.y)
      ) return [];
      const label = candidate.label.trim().slice(0, 40);
      return label ? [{ id: candidate.id, label, x: candidate.x, y: candidate.y }] : [];
    }).slice(0, customMarkerLimit);
  } catch {
    return [];
  }
}

function persistCustomMarkers(): void {
  try {
    localStorage.setItem(customMarkerStorageKey, JSON.stringify(customMarkers));
  } catch {
    // The map remains usable if app-owned WebView storage is unavailable.
  }
}

function queueRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(draw);
}

function zoomAt(factor: number, anchor?: Point): void {
  const oldScale = scale;
  scale = Math.max(0.022, Math.min(3.2, scale * factor));
  if (anchor) {
    center.x = anchor.x - (anchor.x - center.x) * oldScale / scale;
    center.y = anchor.y - (anchor.y - center.y) * oldScale / scale;
  }
  queueRender();
}

function fitMap(): void {
  const margin = 120;
  const widthScale = canvas.clientWidth / (snapshot.bounds.maxX - snapshot.bounds.minX + margin * 2);
  const heightScale = canvas.clientHeight / (snapshot.bounds.maxY - snapshot.bounds.minY + margin * 2);
  scale = Math.max(0.022, Math.min(widthScale, heightScale));
  center = {
    x: (snapshot.bounds.minX + snapshot.bounds.maxX) / 2,
    y: (snapshot.bounds.minY + snapshot.bounds.maxY) / 2,
  };
  queueRender();
}

function resetView(): void {
  center = { ...snapshot.initialCenter };
  scale = 0.24;
  queueRender();
}

function updatePointer(point?: Point): void {
  if (point) pointerWorld = point;
  const displayedPoint = point ?? pointerWorld;
  must<HTMLElement>("#pointer-x").textContent = displayedPoint ? Math.round(displayedPoint.x).toString() : "—";
  must<HTMLElement>("#pointer-y").textContent = displayedPoint ? Math.round(displayedPoint.y).toString() : "—";
  must<HTMLElement>("#pointer-cell").textContent = displayedPoint
    ? `${Math.floor(displayedPoint.x / snapshot.compiledCellSize)}, ${Math.floor(displayedPoint.y / snapshot.compiledCellSize)}`
    : "—";
  must<HTMLElement>("#pointer-chunk").textContent = displayedPoint
    ? `${Math.floor(displayedPoint.x / snapshot.chunkSize)}, ${Math.floor(displayedPoint.y / snapshot.chunkSize)}`
    : "—";
}

async function copyCoordinates(): Promise<void> {
  if (!selectedPoint) return;
  const point = selectedPoint;
  const value = `${Math.round(point.x)}, ${Math.round(point.y)}`;
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const fallback = document.createElement("textarea");
    fallback.value = value;
    fallback.setAttribute("readonly", "");
    fallback.style.position = "fixed";
    fallback.style.opacity = "0";
    document.body.append(fallback);
    fallback.select();
    document.execCommand("copy");
    fallback.remove();
  }
  const button = must<HTMLButtonElement>("#copy-selection-coordinates");
  const label = must<HTMLElement>("#selection-copy-label");
  button.classList.add("is-copied");
  label.textContent = "Copied X/Y";
  window.setTimeout(() => {
    button.classList.remove("is-copied");
    label.textContent = "Copy X/Y";
  }, 1200);
}

function nearestPoi(point: Point): Poi | undefined {
  const radius = Math.max(18 / scale, 16);
  let nearest: Poi | undefined;
  let nearestDistance = radius;
  for (const poi of snapshot.pois) {
    if (!poiIsVisible(poi) && poi.kind !== "business") continue;
    const distance = Math.hypot(point.x - poi.x, point.y - poi.y);
    if (distance < nearestDistance) {
      nearest = poi;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function showSelection(point: Point, poi?: Poi): void {
  selectedPoint = { ...point };
  selectedPoi = poi;
  selectedCustomMarkerId = undefined;
  must<HTMLElement>("#selection-kind").textContent = poi ? poi.kind.toUpperCase() : "SELECTED COORDINATE";
  must<HTMLElement>("#selection-title").textContent = poi?.label ?? "Selected map point";
  must<HTMLElement>("#selection-detail").textContent = poi
    ? `${poi.details} · Level ${poi.z}`
    : "Stable details for this clicked location. Copy it or use it as a route marker.";
  must<HTMLElement>("#selection-x").textContent = Math.round(point.x).toString();
  must<HTMLElement>("#selection-y").textContent = Math.round(point.y).toString();
  must<HTMLElement>("#selection-cell").textContent = `${Math.floor(point.x / snapshot.compiledCellSize)}, ${Math.floor(point.y / snapshot.compiledCellSize)}`;
  must<HTMLElement>("#selection-chunk").textContent = `${Math.floor(point.x / snapshot.chunkSize)}, ${Math.floor(point.y / snapshot.chunkSize)}`;
  must<HTMLElement>("#selection-card").hidden = false;
  queueRender();
}

function showCustomMarkerSelection(marker: CustomMarker): void {
  showSelection(marker);
  selectedCustomMarkerId = marker.id;
  must<HTMLElement>("#selection-kind").textContent = "CUSTOM MARKER";
  must<HTMLElement>("#selection-title").textContent = marker.label;
  must<HTMLElement>("#selection-detail").textContent = "Saved locally by Knox Atlas. Use this point as a route marker or copy its coordinates.";
}

function hideMarkerForm(): void {
  editingMarkerId = undefined;
  must<HTMLFormElement>("#marker-form").hidden = true;
  must<HTMLInputElement>("#marker-name").value = "";
  must<HTMLElement>("#marker-form-note").textContent = "Saved locally on this computer.";
  must<HTMLButtonElement>("#save-marker").textContent = "Save";
}

function showMarkerForm(marker?: CustomMarker): void {
  editingMarkerId = marker?.id;
  const form = must<HTMLFormElement>("#marker-form");
  const input = must<HTMLInputElement>("#marker-name");
  form.hidden = false;
  input.value = marker?.label ?? selectedPoi?.label ?? "";
  must<HTMLButtonElement>("#save-marker").textContent = marker ? "Rename" : "Save";
  must<HTMLElement>("#marker-form-note").textContent = marker
    ? "Change the label for this saved point."
    : `Saved locally on this computer. ${customMarkers.length}/${customMarkerLimit} used.`;
  input.focus();
  input.select();
}

function renderCustomMarkers(): void {
  const panel = must<HTMLElement>("#marker-panel");
  const list = must<HTMLElement>("#marker-list");
  panel.hidden = customMarkers.length === 0;
  must<HTMLElement>("#marker-panel-title").textContent = `Saved places (${customMarkers.length})`;
  list.innerHTML = customMarkers.map((marker) => `
    <article class="marker-list-item">
      <button class="marker-focus" type="button" data-marker-focus="${escapeHtml(marker.id)}">
        <i aria-hidden="true"></i>
        <span><strong>${escapeHtml(marker.label)}</strong><small>${Math.round(marker.x)}, ${Math.round(marker.y)}</small></span>
      </button>
      <button class="marker-list-action" type="button" data-marker-rename="${escapeHtml(marker.id)}" aria-label="Rename ${escapeHtml(marker.label)}" title="Rename marker">&#9998;</button>
      <button class="marker-list-action marker-remove" type="button" data-marker-remove="${escapeHtml(marker.id)}" aria-label="Remove ${escapeHtml(marker.label)}" title="Remove marker">&times;</button>
    </article>
  `).join("");

  const addButton = must<HTMLButtonElement>("#add-custom-marker");
  addButton.disabled = customMarkers.length >= customMarkerLimit;
  addButton.title = addButton.disabled ? `Maximum of ${customMarkerLimit} custom markers reached` : "Save a named marker at this point";
}

function removeCustomMarker(markerId: string): void {
  customMarkers = customMarkers.filter((marker) => marker.id !== markerId);
  persistCustomMarkers();
  renderCustomMarkers();
  if (selectedCustomMarkerId === markerId) {
    selectedCustomMarkerId = undefined;
    selectedPoint = undefined;
    must<HTMLElement>("#selection-card").hidden = true;
  }
  if (editingMarkerId === markerId) hideMarkerForm();
  queueRender();
}

function updateRoute(): void {
  const readout = must<HTMLElement>("#route-readout");
  readout.hidden = !currentPosition && !destination;
  must<HTMLElement>("#current-coordinate").textContent = currentPosition
    ? `${Math.round(currentPosition.x)}, ${Math.round(currentPosition.y)}`
    : "Not set";
  must<HTMLElement>("#destination-coordinate").textContent = destination
    ? `${Math.round(destination.x)}, ${Math.round(destination.y)}`
    : "Not set";
  must<HTMLButtonElement>("#clear-current").hidden = !currentPosition;
  must<HTMLButtonElement>("#clear-destination").hidden = !destination;
  must<HTMLButtonElement>("#clear-current-selection").disabled = !currentPosition;
  must<HTMLButtonElement>("#clear-destination-selection").disabled = !destination;
  const distanceRow = must<HTMLElement>("#route-distance-row");
  distanceRow.hidden = !currentPosition || !destination;
  if (!currentPosition || !destination) return;
  const distance = Math.round(Math.hypot(destination.x - currentPosition.x, destination.y - currentPosition.y));
  must<HTMLElement>("#route-distance").textContent = `${formatCount(distance)} tiles`;
}

function clearCurrentPosition(): void {
  currentPosition = undefined;
  updateRoute();
  queueRender();
}

function clearDestination(): void {
  destination = undefined;
  updateRoute();
  queueRender();
}

function focusEntry(entry: SearchEntry): void {
  center = { ...entry.point };
  scale = Math.max(scale, 0.55);
  showSelection(entry.point, entry.poi);
  must<HTMLInputElement>("#search-input").value = entry.label;
  must<HTMLElement>("#search-results").hidden = true;
}

function renderSearch(query: string): void {
  const results = must<HTMLDivElement>("#search-results");
  const trimmed = query.trim();
  if (!trimmed) {
    results.hidden = true;
    return;
  }
  const coordinates = trimmed.match(/^\s*(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)\s*$/);
  const matches = searchEntries
    .filter((entry) => entry.label.toLowerCase().includes(trimmed.toLowerCase()))
    .sort((a, b) => Number(!a.label.toLowerCase().startsWith(trimmed.toLowerCase())) - Number(!b.label.toLowerCase().startsWith(trimmed.toLowerCase())))
    .slice(0, coordinates ? 6 : 8);
  results.innerHTML = `${coordinates ? `
    <button class="search-result" data-coordinate="${coordinates[1]},${coordinates[2]}">
      <span class="result-pin">+</span><span><strong>Go to ${coordinates[1]}, ${coordinates[2]}</strong><small>Coordinates</small></span>
    </button>` : ""}${matches.map((entry) => `
    <button class="search-result" data-search-index="${searchEntries.indexOf(entry)}">
      <span class="result-pin"></span><span><strong>${escapeHtml(entry.label)}</strong><small>${escapeHtml(entry.meta)} · ${Math.round(entry.point.x)}, ${Math.round(entry.point.y)}</small></span>
    </button>`).join("")}`;
  results.hidden = !coordinates && matches.length === 0;

  results.querySelectorAll<HTMLButtonElement>("[data-search-index]").forEach((button) => {
    button.addEventListener("click", () => focusEntry(searchEntries[Number(button.dataset.searchIndex)]));
  });
  results.querySelector<HTMLButtonElement>("[data-coordinate]")?.addEventListener("click", (event) => {
    const value = (event.currentTarget as HTMLButtonElement).dataset.coordinate?.split(",").map(Number);
    if (!value || value.length !== 2) return;
    const point = { x: value[0], y: value[1] };
    center = point;
    scale = Math.max(scale, 0.5);
    showSelection(point);
    results.hidden = true;
  });
}

function wireInteractions(): void {
  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    dragMoved = false;
    dragOrigin = { x: event.clientX, y: event.clientY };
    centerOrigin = { ...center };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  });
  canvas.addEventListener("pointermove", (event) => {
    updatePointer(toWorld(event.clientX, event.clientY));
    if (!dragging) return;
    const dx = event.clientX - dragOrigin.x;
    const dy = event.clientY - dragOrigin.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
    center = { x: centerOrigin.x - dx / scale, y: centerOrigin.y - dy / scale };
    queueRender();
  });
  canvas.addEventListener("pointerup", (event) => {
    if (!dragMoved) {
      const point = toWorld(event.clientX, event.clientY);
      const marker = customMarkerAt(point);
      if (marker) {
        showCustomMarkerSelection(marker);
      } else {
        const poi = nearestPoi(point);
        showSelection(poi ?? point, poi);
      }
    }
    dragging = false;
    canvas.classList.remove("is-dragging");
    canvas.releasePointerCapture(event.pointerId);
  });
  canvas.addEventListener("pointerleave", () => {
    if (!dragging) updatePointer();
  });
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomAt(event.deltaY < 0 ? 1.18 : 1 / 1.18, toWorld(event.clientX, event.clientY));
  }, { passive: false });

  must<HTMLButtonElement>("#zoom-in").addEventListener("click", () => zoomAt(1.35));
  must<HTMLButtonElement>("#zoom-out").addEventListener("click", () => zoomAt(1 / 1.35));
  must<HTMLButtonElement>("#reset-view").addEventListener("click", resetView);
  must<HTMLButtonElement>("#fit-map").addEventListener("click", fitMap);
  must<HTMLButtonElement>("#copy-selection-coordinates").addEventListener("click", copyCoordinates);
  must<HTMLButtonElement>("#close-selection").addEventListener("click", () => {
    must<HTMLElement>("#selection-card").hidden = true;
    selectedPoint = undefined;
    selectedPoi = undefined;
    selectedCustomMarkerId = undefined;
    hideMarkerForm();
    queueRender();
  });
  must<HTMLButtonElement>("#set-current").addEventListener("click", () => {
    if (!selectedPoint) return;
    currentPosition = { ...selectedPoint };
    updateRoute();
    queueRender();
  });
  must<HTMLButtonElement>("#set-destination").addEventListener("click", () => {
    if (!selectedPoint) return;
    destination = { ...selectedPoint };
    updateRoute();
    queueRender();
  });
  must<HTMLButtonElement>("#clear-current").addEventListener("click", clearCurrentPosition);
  must<HTMLButtonElement>("#clear-current-selection").addEventListener("click", clearCurrentPosition);
  must<HTMLButtonElement>("#clear-destination").addEventListener("click", clearDestination);
  must<HTMLButtonElement>("#clear-destination-selection").addEventListener("click", clearDestination);
  must<HTMLButtonElement>("#add-custom-marker").addEventListener("click", () => {
    if (!selectedPoint || customMarkers.length >= customMarkerLimit) return;
    showMarkerForm();
  });
  must<HTMLButtonElement>("#cancel-marker").addEventListener("click", hideMarkerForm);
  must<HTMLFormElement>("#marker-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = must<HTMLInputElement>("#marker-name");
    const label = input.value.trim().slice(0, 40);
    const note = must<HTMLElement>("#marker-form-note");
    if (!label) {
      note.textContent = "Give this marker a name first.";
      input.focus();
      return;
    }

    let savedMarker: CustomMarker | undefined;
    if (editingMarkerId) {
      customMarkers = customMarkers.map((marker) => {
        if (marker.id !== editingMarkerId) return marker;
        savedMarker = { ...marker, label };
        return savedMarker;
      });
    } else if (selectedPoint && customMarkers.length < customMarkerLimit) {
      savedMarker = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        label,
        ...selectedPoint,
      };
      customMarkers = [...customMarkers, savedMarker];
    }

    if (!savedMarker) return;
    persistCustomMarkers();
    renderCustomMarkers();
    hideMarkerForm();
    showCustomMarkerSelection(savedMarker);
    queueRender();
  });

  must<HTMLElement>("#marker-list").addEventListener("click", (event) => {
    const target = event.target as Element;
    const focusId = target.closest<HTMLButtonElement>("[data-marker-focus]")?.dataset.markerFocus;
    const renameId = target.closest<HTMLButtonElement>("[data-marker-rename]")?.dataset.markerRename;
    const removeId = target.closest<HTMLButtonElement>("[data-marker-remove]")?.dataset.markerRemove;
    const markerId = focusId ?? renameId;
    if (markerId) {
      const marker = customMarkers.find((candidate) => candidate.id === markerId);
      if (!marker) return;
      center = { x: marker.x, y: marker.y };
      scale = Math.max(scale, 0.55);
      showCustomMarkerSelection(marker);
      if (renameId) showMarkerForm(marker);
      queueRender();
    }
    if (removeId) removeCustomMarker(removeId);
  });
  must<HTMLButtonElement>("#toggle-markers").addEventListener("click", () => {
    const panel = must<HTMLElement>("#marker-panel");
    const button = must<HTMLButtonElement>("#toggle-markers");
    const collapsed = panel.classList.toggle("is-collapsed");
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", collapsed ? "Expand custom markers" : "Collapse custom markers");
    button.title = collapsed ? "Expand custom markers" : "Collapse custom markers";
  });

  const panel = must<HTMLElement>(".filter-panel");
  must<HTMLButtonElement>("#collapse-filters").addEventListener("click", () => panel.classList.add("is-collapsed"));
  must<HTMLButtonElement>("#show-filters").addEventListener("click", () => panel.classList.remove("is-collapsed"));

  const search = must<HTMLInputElement>("#search-input");
  search.addEventListener("input", () => renderSearch(search.value));
  search.addEventListener("keydown", (event) => {
    if (event.key === "Escape") must<HTMLElement>("#search-results").hidden = true;
    if (event.key === "Enter") {
      const first = must<HTMLElement>("#search-results").querySelector<HTMLButtonElement>("button");
      first?.click();
    }
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      search.focus();
      search.select();
    }
  });
  document.addEventListener("pointerdown", (event) => {
    if (!(event.target as Element).closest(".search-area")) must<HTMLElement>("#search-results").hidden = true;
  });

  must<HTMLFormElement>("#coordinate-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const x = Number(must<HTMLInputElement>("#coordinate-x").value);
    const y = Number(must<HTMLInputElement>("#coordinate-y").value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const point = { x, y };
    center = point;
    scale = Math.max(scale, 0.5);
    showSelection(point);
  });

  new ResizeObserver(queueRender).observe(canvas);
}

function presentSnapshot(data: GameSnapshot): void {
  snapshot = data;
  center = { ...data.initialCenter };
  prepareData(data);
  renderFilters(data);
  renderCustomMarkers();
  wireInteractions();

  must<HTMLElement>("#source-status").textContent = "Local map ready";
  must<HTMLElement>("#build-status").textContent = data.steamBuildId ? `Steam build ${data.steamBuildId}` : data.gameTitle;
  must<HTMLElement>("#source-detail").textContent = `${formatCount(data.features.length)} shapes · ${formatCount(data.counts.streets)} streets · ${formatCount(data.pois.length)} zones`;
  if (data.save) {
    must<HTMLElement>("#save-context").hidden = false;
    must<HTMLElement>("#save-name").textContent = data.save.name;
    must<HTMLElement>("#save-note").textContent = data.save.center
      ? "Centered on the last saved map view—not live player position"
      : "Save found; using the map default view";
  }
  must<HTMLElement>("#loading-state").hidden = true;
  must<HTMLElement>(".app-shell").classList.remove("is-loading");
  queueRender();
}

function presentError(error: unknown): void {
  const loading = must<HTMLElement>("#loading-state");
  loading.classList.add("is-error");
  loading.innerHTML = `<div class="error-mark">!</div><strong>Couldn’t read the local map</strong><span>${escapeHtml(String(error))}</span>`;
  must<HTMLElement>("#source-status").textContent = "Map unavailable";
  must<HTMLElement>("#build-status").textContent = "Check the local installation";
}

invoke<GameSnapshot>("load_game_snapshot").then(presentSnapshot).catch(presentError);
