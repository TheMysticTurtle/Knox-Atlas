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
} as const;

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
        <section class="filter-section">
          <h2>World</h2>
          <div id="world-filters" class="filter-list"></div>
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
          <button id="show-filters" class="icon-button layers-button" aria-label="Show map layers">☷</button>
          <span class="tool-separator"></span>
          <button id="zoom-in" class="icon-button" aria-label="Zoom in">+</button>
          <button id="zoom-out" class="icon-button" aria-label="Zoom out">−</button>
          <button id="reset-view" class="icon-button reset-icon" aria-label="Return to latest map view">⌖</button>
          <button id="fit-map" class="icon-button fit-icon" aria-label="Fit the whole map">□</button>
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
          <div class="selection-actions">
            <button id="set-current">Set as my position</button>
            <button id="set-destination">Set destination</button>
          </div>
        </div>

        <div id="route-readout" class="route-readout" hidden>
          <span>DIRECT DISTANCE</span><strong id="route-distance">0 tiles</strong>
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
let selectedPoint: Point | undefined;
let selectedPoi: Poi | undefined;
let currentPosition: Point | undefined;
let destination: Point | undefined;
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
  group: "orientation" | "loot" | "world";
  key: FilterKey;
  label: string;
  description: string;
  color: string;
  count: (data: GameSnapshot) => number;
}> = [
  { group: "orientation", key: "towns", label: "Towns & areas", description: "Official map labels", color: "#d8ad68", count: (data) => data.labels.filter((item) => item.kind === "town" || item.kind === "place").length },
  { group: "orientation", key: "streets", label: "Street names", description: "Visible as you zoom in", color: "#a9a69b", count: (data) => data.counts.streets },
  { group: "orientation", key: "businesses", label: "Businesses", description: "Labels and game zones", color: "#98b26b", count: (data) => data.counts.businesses },
  { group: "orientation", key: "buildings", label: "Building types", description: "Use in-game map colors", color: "#a6805e", count: (data) => data.counts.buildings },
  { group: "loot", key: "food", label: "Food", description: "Grocers, kitchens, dining", color: categoryColors.food, count: (data) => data.pois.filter((poi) => poi.category === "food").length },
  { group: "loot", key: "medical", label: "Medical", description: "Clinics and pharmacies", color: categoryColors.medical, count: (data) => data.pois.filter((poi) => poi.category === "medical").length },
  { group: "loot", key: "tools", label: "Tools & materials", description: "Industrial and hardware", color: categoryColors.tools, count: (data) => data.pois.filter((poi) => poi.category === "tools").length },
  { group: "loot", key: "security", label: "Security & services", description: "Police, fire, military", color: categoryColors.security, count: (data) => data.pois.filter((poi) => poi.category === "security").length },
  { group: "loot", key: "fuel", label: "Fuel", description: "Gas station zones", color: categoryColors.fuel, count: (data) => data.pois.filter((poi) => poi.category === "fuel").length },
  { group: "loot", key: "water", label: "Water", description: "Water features and zones", color: categoryColors.water, count: (data) => data.pois.filter((poi) => poi.category === "water").length },
  { group: "world", key: "vehicles", label: "Vehicle zones", description: "Possible parked vehicles", color: categoryColors.vehicles, count: (data) => data.counts.vehicleZones },
];

function renderFilters(data: GameSnapshot): void {
  for (const group of ["orientation", "loot", "world"] as const) {
    const target = must<HTMLDivElement>(`#${group}-filters`);
    target.innerHTML = filterDefinitions
      .filter((definition) => definition.group === group)
      .map((definition) => `
        <label class="filter-row" for="filter-${definition.key}">
          <span class="filter-swatch" style="--swatch:${definition.color}"></span>
          <span class="filter-copy"><strong>${definition.label}</strong><small>${definition.description}</small></span>
          <span class="filter-count">${formatCount(definition.count(data))}</span>
          <input id="filter-${definition.key}" type="checkbox" data-filter="${definition.key}" ${filters[definition.key] ? "checked" : ""} />
          <span class="switch" aria-hidden="true"></span>
        </label>
      `).join("");
  }

  document.querySelectorAll<HTMLInputElement>("[data-filter]").forEach((input) => {
    input.addEventListener("change", () => {
      const key = input.dataset.filter as FilterKey;
      filters[key] = input.checked;
      queueRender();
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
    if (!filters.buildings) return;
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

function drawMapLabels(occupied: Bounds[]): void {
  for (const label of snapshot.labels) {
    const isTown = label.kind === "town" || label.kind === "place";
    const isBusiness = label.kind === "landmark";
    if ((isTown && !filters.towns) || (isBusiness && !filters.businesses)) continue;
    if (!isTown && !isBusiness && scale < 0.18) continue;
    if (isBusiness && scale < 0.18) continue;
    const size = isTown ? Math.max(14, Math.min(24, 10 + scale * 24)) : Math.max(11, Math.min(15, 9 + scale * 11));
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
    const size = scale > 0.7 ? 12 : 11;
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

function poiIsVisible(poi: Poi): boolean {
  if (poi.kind === "vehicle") return filters.vehicles && scale >= 0.42;
  const isSelectedCategory = poi.category !== "business"
    && poi.category !== "vehicles"
    && filters[poi.category];
  if (poi.kind === "loot" || poi.kind === "resource") return isSelectedCategory;
  return filters.businesses || isSelectedCategory;
}

function drawPois(view: Bounds, occupied: Bounds[]): void {
  const hasActiveLootFilter = lootFilterKeys.some((key) => filters[key]);
  for (const poi of snapshot.pois) {
    if (!poiIsVisible(poi)) continue;
    if (poi.x < view.minX || poi.x > view.maxX || poi.y < view.minY || poi.y > view.maxY) continue;
    const isHighlightedLoot = poi.category !== "business"
      && poi.category !== "vehicles"
      && filters[poi.category];
    const screen = toScreen(poi);
    const dotRadius = isHighlightedLoot ? 5 : scale > 0.65 ? 4.5 : 3.5;

    if (hasActiveLootFilter && poi.kind === "business" && !isHighlightedLoot) {
      context.globalAlpha = 0.18;
    }
    if (isHighlightedLoot) {
      context.beginPath();
      context.arc(screen.x, screen.y, 9, 0, Math.PI * 2);
      context.fillStyle = `${categoryColors[poi.category]}33`;
      context.fill();
      context.strokeStyle = categoryColors[poi.category];
      context.lineWidth = 1.5;
      context.stroke();
    }
    context.beginPath();
    if (poi.kind === "vehicle") {
      context.rect(screen.x - 3.5, screen.y - 2.5, 7, 5);
    } else {
      context.arc(screen.x, screen.y, dotRadius, 0, Math.PI * 2);
    }
    context.fillStyle = categoryColors[poi.category] ?? categoryColors.business;
    context.fill();
    context.strokeStyle = "rgba(255,255,255,.75)";
    context.lineWidth = 1.2;
    context.stroke();

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
  if (currentPosition) drawMarker(currentPosition, mapColors.current, "YOU");
  if (destination) drawMarker(destination, mapColors.destination, "DESTINATION");
  if (selectedPoint && !selectedPoi) drawMarker(selectedPoint, mapColors.selected, "SELECTED");
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
  must<HTMLElement>("#pointer-x").textContent = point ? Math.round(point.x).toString() : "—";
  must<HTMLElement>("#pointer-y").textContent = point ? Math.round(point.y).toString() : "—";
  must<HTMLElement>("#pointer-cell").textContent = point
    ? `${Math.floor(point.x / snapshot.compiledCellSize)}, ${Math.floor(point.y / snapshot.compiledCellSize)}`
    : "—";
  must<HTMLElement>("#pointer-chunk").textContent = point
    ? `${Math.floor(point.x / snapshot.chunkSize)}, ${Math.floor(point.y / snapshot.chunkSize)}`
    : "—";
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
  must<HTMLElement>("#selection-kind").textContent = poi ? poi.kind.toUpperCase() : "SELECTED COORDINATE";
  must<HTMLElement>("#selection-title").textContent = poi?.label ?? `${Math.round(point.x)}, ${Math.round(point.y)}`;
  must<HTMLElement>("#selection-detail").textContent = poi
    ? `${poi.details} · X ${Math.round(poi.x)} / Y ${Math.round(poi.y)} / Z ${poi.z}`
    : `Cell ${Math.floor(point.x / snapshot.compiledCellSize)}, ${Math.floor(point.y / snapshot.compiledCellSize)} · Chunk ${Math.floor(point.x / snapshot.chunkSize)}, ${Math.floor(point.y / snapshot.chunkSize)}`;
  must<HTMLElement>("#selection-card").hidden = false;
  queueRender();
}

function updateRoute(): void {
  const readout = must<HTMLElement>("#route-readout");
  if (!currentPosition || !destination) {
    readout.hidden = true;
    return;
  }
  const distance = Math.round(Math.hypot(destination.x - currentPosition.x, destination.y - currentPosition.y));
  must<HTMLElement>("#route-distance").textContent = `${formatCount(distance)} tiles`;
  readout.hidden = false;
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
      const poi = nearestPoi(point);
      showSelection(poi ?? point, poi);
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
  must<HTMLButtonElement>("#close-selection").addEventListener("click", () => {
    must<HTMLElement>("#selection-card").hidden = true;
    selectedPoint = undefined;
    selectedPoi = undefined;
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
