// Framework-agnostic canvas map engine. React owns the UI chrome and state; this owns pixels —
// it draws the base map (terrain / water / roads / rail / buildings) and handles pan, zoom, and
// viewport culling. POI icons, labels, room overlays, and the satellite base layer are layered on
// in later steps. Ported from the prototype renderer into a self-contained, disposable class.

import { buildingColor, categoryColors, mapColors } from "./colors";
import { poiSubIds } from "./subcategories";
import type { Bounds, Category, GameSnapshot, MapFeature, MapPoi, Point } from "./types";

type PreparedFeature = MapFeature & { path: Path2D; bounds: Bounds };
type PreparedStreet = { name: string; anchor: Point; angle: number; bounds: Bounds };

/** Which base/label layers are drawn (the View section toggles). */
export type ViewOptions = { towns: boolean; streets: boolean; buildings: boolean; businesses: boolean };

const MIN_SCALE = 0.022;
const MAX_SCALE = 3.2;
// Draw order: background layers first so buildings sit on top.
const DRAW_ORDER: MapFeature["kind"][] = ["terrain", "water", "road", "railway", "building"];

export class MapEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly snapshot: GameSnapshot;
  private prepared: PreparedFeature[] = [];
  private preparedStreets: PreparedStreet[] = [];
  private pois: { poi: MapPoi; subIds: string[] }[] = [];
  private enabledSubs: Set<string> | null = null;
  private view: ViewOptions = { towns: true, streets: true, buildings: true, businesses: true };

  private center: Point;
  private scale = 0.22;

  private renderQueued = false;
  private userAdjusted = false;
  private dragging = false;
  private dragMoved = false;
  private dragOrigin = { x: 0, y: 0 };
  private centerOrigin = { x: 0, y: 0 };

  /** Set by React: called with the clicked POI (or null when clicking empty map). */
  onSelectPoi?: (poi: MapPoi | null) => void;

  private readonly resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, snapshot: GameSnapshot) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas is not supported by this browser.");
    this.canvas = canvas;
    this.ctx = ctx;
    this.snapshot = snapshot;
    this.center = { ...snapshot.initialCenter };

    this.prepare();
    this.attachListeners();
    // Auto-fit to the window until the user pans/zooms; after that, just redraw on resize.
    this.resizeObserver = new ResizeObserver(() => {
      if (this.userAdjusted) this.queueRender();
      else this.fit();
    });
    this.resizeObserver.observe(canvas);
    this.fit();
  }

  /** Provide the categorized RoomDef POIs to draw (loaded separately by React). */
  setPois(pois: MapPoi[]): void {
    this.pois = pois.map((poi) => ({ poi, subIds: poiSubIds(poi) }));
    this.queueRender();
  }

  /** Show only POIs whose `<category>:<sub>` id is in this enabled set. */
  setEnabledSubs(enabled: Set<string>): void {
    this.enabledSubs = enabled;
    this.queueRender();
  }

  /** Detach all listeners so React can dispose the engine cleanly on unmount. */
  dispose(): void {
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
  }

  /** Frame the whole map in the current viewport. */
  fit(): void {
    const margin = 120;
    const { bounds } = this.snapshot;
    const widthScale = this.canvas.clientWidth / (bounds.maxX - bounds.minX + margin * 2);
    const heightScale = this.canvas.clientHeight / (bounds.maxY - bounds.minY + margin * 2);
    this.scale = Math.max(MIN_SCALE, Math.min(widthScale, heightScale));
    this.center = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2,
    };
    this.queueRender();
  }

  zoomBy(factor: number, anchor?: Point): void {
    const previous = this.scale;
    this.scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this.scale * factor));
    if (anchor) {
      this.center.x = anchor.x - ((anchor.x - this.center.x) * previous) / this.scale;
      this.center.y = anchor.y - ((anchor.y - this.center.y) * previous) / this.scale;
    }
    this.queueRender();
  }

  // --- data preparation -----------------------------------------------------

  private prepare(): void {
    this.prepared = this.snapshot.features.map((feature) => ({
      ...feature,
      path: buildPath(feature.points, feature.kind !== "railway"),
      bounds: pointBounds(feature.points),
    }));
    this.preparedStreets = this.snapshot.streets
      .filter((street) => street.points.length > 1)
      .map((street) => {
        const { anchor, angle } = streetAnchor(street.points);
        return { name: street.name, anchor, angle, bounds: pointBounds(street.points) };
      });
  }

  /** Toggle which base/label layers are drawn (the View section). */
  setView(view: ViewOptions): void {
    this.view = view;
    this.queueRender();
  }

  // --- coordinate transforms ------------------------------------------------

  private toWorld(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: this.center.x + (clientX - rect.left - rect.width / 2) / this.scale,
      y: this.center.y + (clientY - rect.top - rect.height / 2) / this.scale,
    };
  }

  /** World point → CSS-pixel point (for the screen-space overlay pass). */
  private toScreen(point: Point): Point {
    return {
      x: (point.x - this.center.x) * this.scale + this.canvas.clientWidth / 2,
      y: (point.y - this.center.y) * this.scale + this.canvas.clientHeight / 2,
    };
  }

  private viewportBounds(): Bounds {
    const width = this.canvas.clientWidth / this.scale;
    const height = this.canvas.clientHeight / this.scale;
    return {
      minX: this.center.x - width / 2,
      minY: this.center.y - height / 2,
      maxX: this.center.x + width / 2,
      maxY: this.center.y + height / 2,
    };
  }

  // --- rendering ------------------------------------------------------------

  private queueRender(): void {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => this.draw());
  }

  private draw(): void {
    this.renderQueued = false;
    const { ctx, canvas } = this;
    const deviceScale = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(canvas.clientWidth * deviceScale));
    const height = Math.max(1, Math.round(canvas.clientHeight * deviceScale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    ctx.fillStyle = mapColors.paper;
    ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const view = this.viewportBounds();
    ctx.setTransform(
      deviceScale * this.scale,
      0,
      0,
      deviceScale * this.scale,
      deviceScale * (canvas.clientWidth / 2 - this.center.x * this.scale),
      deviceScale * (canvas.clientHeight / 2 - this.center.y * this.scale),
    );

    for (const kind of DRAW_ORDER) {
      if (kind === "building" && !this.view.buildings) continue;
      for (const feature of this.prepared) {
        if (feature.kind === kind && intersects(feature.bounds, view)) {
          this.drawFeature(feature);
        }
      }
    }

    // Overlay pass in screen space (labels + POI dots — pinned to world coords, screen-sized).
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    const occupied: Bounds[] = [];
    this.drawStreetLabels(view, occupied);
    this.drawPois(view);
    this.drawMapLabels(occupied);
  }

  // --- labels ---------------------------------------------------------------

  private labelFits(screen: Point, text: string, fontSize: number, occupied: Bounds[]): boolean {
    const width = Math.max(38, text.length * fontSize * 0.56);
    const box = {
      minX: screen.x - width / 2 - 5,
      minY: screen.y - fontSize,
      maxX: screen.x + width / 2 + 5,
      maxY: screen.y + 5,
    };
    if (box.maxX < 0 || box.minX > this.canvas.clientWidth) return false;
    if (box.maxY < 0 || box.minY > this.canvas.clientHeight) return false;
    if (occupied.some((item) => intersects(item, box))) return false;
    occupied.push(box);
    return true;
  }

  private drawScreenLabel(
    text: string,
    point: Point,
    size: number,
    weight: number,
    color: string,
    occupied: Bounds[],
    uppercase = false,
  ): void {
    const screen = this.toScreen(point);
    const label = uppercase ? text.toUpperCase() : text;
    if (!this.labelFits(screen, label, size, occupied)) return;
    const { ctx } = this;
    ctx.font = `${weight} ${size}px Inter, "Segoe UI", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(219, 215, 192, 0.94)";
    ctx.lineWidth = size > 15 ? 5 : 3.5;
    ctx.strokeText(label, screen.x, screen.y);
    ctx.fillStyle = color;
    ctx.fillText(label, screen.x, screen.y);
  }

  private drawMapLabels(occupied: Bounds[]): void {
    for (const label of this.snapshot.labels) {
      const isTown = label.kind === "town";
      const isArea = label.kind === "area";
      const isWater = label.kind === "water";
      const isBusiness = label.kind === "landmark";
      if ((isTown || isArea || isWater) && !this.view.towns) continue;
      if (isBusiness && (!this.view.businesses || this.scale < 0.35)) continue;
      if (!isTown && !isArea && !isWater && !isBusiness) continue;
      const townSize = Math.max(18, Math.min(28, 28 - this.scale * 8));
      const areaSize = Math.max(14, Math.min(19, 19 - this.scale * 3));
      const size = isTown
        ? townSize
        : isArea || isWater
          ? areaSize
          : Math.max(11, Math.min(15, 9 + this.scale * 11));
      this.drawScreenLabel(
        label.text,
        label,
        size,
        isTown ? 700 : 650,
        isTown ? mapColors.ink : mapColors.mutedInk,
        occupied,
        isTown,
      );
    }
  }

  private drawStreetLabels(view: Bounds, occupied: Bounds[]): void {
    if (!this.view.streets || this.scale < 0.26) return;
    const { ctx } = this;
    const step = this.scale < 0.42 ? 3 : this.scale < 0.72 ? 2 : 1;
    for (let index = 0; index < this.preparedStreets.length; index += step) {
      const street = this.preparedStreets[index];
      if (!intersects(street.bounds, view)) continue;
      const screen = this.toScreen(street.anchor);
      const size = this.scale > 0.7 ? 13 : 12;
      if (!this.labelFits(screen, street.name, size, occupied)) continue;
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(street.angle);
      ctx.font = `600 ${size}px Inter, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "rgba(219, 215, 192, 0.92)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(street.name, 0, 0);
      ctx.fillStyle = mapColors.mutedInk;
      ctx.fillText(street.name, 0, 0);
      ctx.restore();
    }
  }

  private drawPois(view: Bounds): void {
    if (this.scale < 0.3 || this.pois.length === 0) return; // declutter until zoomed into a town
    const { ctx } = this;
    const radius = this.scale > 0.7 ? 4 : 3;
    const enabled = this.enabledSubs;
    for (const { poi, subIds } of this.pois) {
      if (poi.x < view.minX || poi.x > view.maxX || poi.y < view.minY || poi.y > view.maxY) continue;
      // Show if any of the POI's sub-buckets is enabled; colour by the first enabled one.
      const shownId = enabled ? subIds.find((id) => enabled.has(id)) : subIds[0];
      if (!shownId) continue;
      const category = shownId.slice(0, shownId.indexOf(":")) as Category;
      const screen = this.toScreen(poi);
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = categoryColors[category] ?? mapColors.mutedInk;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(255, 248, 233, 0.85)";
      ctx.stroke();
    }
  }

  private drawFeature(feature: PreparedFeature): void {
    const { ctx } = this;
    switch (feature.kind) {
      case "building": {
        ctx.fillStyle = buildingColor(feature.value);
        ctx.fill(feature.path);
        if (this.scale > 0.18) {
          ctx.strokeStyle = mapColors.outline;
          ctx.lineWidth = Math.max(0.55 / this.scale, 1.2);
          ctx.stroke(feature.path);
        }
        return;
      }
      case "water":
        ctx.fillStyle = mapColors.water;
        ctx.fill(feature.path);
        return;
      case "terrain":
        ctx.fillStyle = mapColors.terrain;
        ctx.globalAlpha = 0.55;
        ctx.fill(feature.path);
        ctx.globalAlpha = 1;
        return;
      case "road": {
        const road = feature.value.toLowerCase();
        ctx.fillStyle = road.includes("trail")
          ? mapColors.trail
          : road.includes("primary") || road.includes("secondary")
            ? mapColors.majorRoad
            : mapColors.tertiary;
        ctx.fill(feature.path);
        return;
      }
      case "railway":
        ctx.strokeStyle = mapColors.railway;
        ctx.lineWidth = Math.max(2 / this.scale, 5);
        ctx.stroke(feature.path);
        return;
      default:
        return;
    }
  }

  // --- interaction ----------------------------------------------------------

  private attachListeners(): void {
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.userAdjusted = true;
    this.dragging = true;
    this.dragMoved = false;
    this.dragOrigin = { x: event.clientX, y: event.clientY };
    this.centerOrigin = { ...this.center };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    if (Math.abs(event.clientX - this.dragOrigin.x) + Math.abs(event.clientY - this.dragOrigin.y) > 4) {
      this.dragMoved = true;
    }
    this.center = {
      x: this.centerOrigin.x - (event.clientX - this.dragOrigin.x) / this.scale,
      y: this.centerOrigin.y - (event.clientY - this.dragOrigin.y) / this.scale,
    };
    this.queueRender();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    this.canvas.releasePointerCapture(event.pointerId);
    // A click (not a drag) selects the nearest visible POI, or clears the selection.
    if (!this.dragMoved) this.onSelectPoi?.(this.hitTestPoi(event.clientX, event.clientY));
  };

  /** Nearest visible POI within a small pixel radius of the click, or null. */
  private hitTestPoi(clientX: number, clientY: number): MapPoi | null {
    if (this.scale < 0.3) return null;
    const rect = this.canvas.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;
    const enabled = this.enabledSubs;
    let best: MapPoi | null = null;
    let bestDistance = 14;
    for (const { poi, subIds } of this.pois) {
      if (enabled && !subIds.some((id) => enabled.has(id))) continue;
      const screen = this.toScreen(poi);
      const distance = Math.hypot(screen.x - px, screen.y - py);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = poi;
      }
    }
    return best;
  }

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.userAdjusted = true;
    this.zoomBy(event.deltaY < 0 ? 1.18 : 1 / 1.18, this.toWorld(event.clientX, event.clientY));
  };
}

// --- geometry helpers -------------------------------------------------------

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

function intersects(a: Bounds, b: Bounds): boolean {
  return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Anchor a street label at the midpoint of its longest segment, aligned to that segment. */
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
