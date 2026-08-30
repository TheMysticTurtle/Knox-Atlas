// Framework-agnostic canvas map engine. React owns the UI chrome and state; this owns pixels —
// it draws the base map (terrain / water / roads / rail / buildings) and handles pan, zoom, and
// viewport culling. POI icons, labels, room overlays, and the satellite base layer are layered on
// in later steps. Ported from the prototype renderer into a self-contained, disposable class.

import { buildingColor, categoryColors, mapColors } from "./colors";
import { poiSubIds } from "./subcategories";
import type { Bounds, Category, GameSnapshot, MapFeature, MapPoi, Point } from "./types";

type PreparedFeature = MapFeature & { path: Path2D; bounds: Bounds };

const MIN_SCALE = 0.022;
const MAX_SCALE = 3.2;
// Draw order: background layers first so buildings sit on top.
const DRAW_ORDER: MapFeature["kind"][] = ["terrain", "water", "road", "railway", "building"];

export class MapEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly snapshot: GameSnapshot;
  private prepared: PreparedFeature[] = [];
  private pois: { poi: MapPoi; subIds: string[] }[] = [];
  private enabledSubs: Set<string> | null = null;

  private center: Point;
  private scale = 0.22;

  private renderQueued = false;
  private userAdjusted = false;
  private dragging = false;
  private dragOrigin = { x: 0, y: 0 };
  private centerOrigin = { x: 0, y: 0 };

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
      for (const feature of this.prepared) {
        if (feature.kind === kind && intersects(feature.bounds, view)) {
          this.drawFeature(feature);
        }
      }
    }

    // Overlay pass in screen space (POI dots — pinned to world coordinates, but screen-sized).
    ctx.setTransform(deviceScale, 0, 0, deviceScale, 0, 0);
    this.drawPois(view);
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
    this.dragOrigin = { x: event.clientX, y: event.clientY };
    this.centerOrigin = { ...this.center };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (!this.dragging) return;
    this.center = {
      x: this.centerOrigin.x - (event.clientX - this.dragOrigin.x) / this.scale,
      y: this.centerOrigin.y - (event.clientY - this.dragOrigin.y) / this.scale,
    };
    this.queueRender();
  };

  private onPointerUp = (event: PointerEvent): void => {
    this.dragging = false;
    this.canvas.releasePointerCapture(event.pointerId);
  };

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
