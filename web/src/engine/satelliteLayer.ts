import { loadSatelliteInfo, loadSatelliteTile } from "../data";
import { visibleImageTiles, type ImageTile } from "./satelliteGeometry";
import type { Bounds, SatelliteInfo } from "./types";

const CACHE_LIMIT = 128; // 32 MiB of decoded RGBA pixels, plus small browser/ZIP overhead.
const CONCURRENCY = 4;

/**
 * Optional image base layer drawn from the game's own `pyramid.zip`. Its cache, requests, status and
 * lifecycle stay out of the map renderer. A missing archive disables the layer (the vector map stays
 * underneath as the fallback); a single unreadable tile is skipped without affecting the rest.
 */
export class SatelliteLayer {
  private info?: SatelliteInfo;
  private cache = new Map<string, ImageBitmap>();
  private pending = new Map<string, AbortController>();
  private broken = new Set<string>();
  private wanted: ImageTile[] = [];
  private disposed = false;
  private failed = false;
  private active = false;
  private lastStatus = "";

  constructor(
    private gameRoot: string,
    private redraw: () => void,
    private status: (text: string) => void,
  ) {}

  async load(): Promise<void> {
    try {
      const info = await loadSatelliteInfo(this.gameRoot);
      if (this.disposed) return;
      this.info = info;
      this.redraw();
    } catch (error) {
      if (!this.disposed) this.fail(error);
    }
  }

  setActive(active: boolean): void {
    this.active = active;
    if (!active) {
      this.wanted = [];
      for (const controller of this.pending.values()) controller.abort();
      this.report("");
    }
  }

  /** Returns false when unavailable so the renderer keeps the vector view intact. */
  draw(ctx: CanvasRenderingContext2D, viewport: Bounds, scale: number): boolean {
    if (this.failed) {
      this.report("Satellite unavailable · using the map view");
      return false;
    }
    if (!this.info) {
      this.report("Reading satellite imagery…");
      return false;
    }

    const tiles = visibleImageTiles(this.info, viewport, scale);
    const keys = new Set(tiles.map((tile) => tile.key));
    for (const [key, controller] of this.pending) {
      if (!keys.has(key)) controller.abort();
    }
    this.wanted = tiles;

    ctx.save();
    const bounds = this.info.bounds;
    ctx.beginPath();
    ctx.rect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    ctx.clip();
    for (const tile of tiles) {
      const image = this.cache.get(tile.key);
      if (!image) continue;
      // Refresh the tile's LRU position; evicted decoded images are explicitly released.
      this.cache.delete(tile.key);
      this.cache.set(tile.key, image);
      const { minX, minY, maxX, maxY } = tile.bounds;
      ctx.drawImage(image, minX, minY, maxX - minX, maxY - minY);
    }
    ctx.restore();

    const loading = tiles.some((tile) => !this.cache.has(tile.key) && !this.broken.has(tile.key));
    this.report(loading ? "Loading visible satellite tiles…" : "Satellite · game-supplied terrain imagery");
    this.pump();
    return true;
  }

  dispose(): void {
    this.disposed = true;
    for (const controller of this.pending.values()) controller.abort();
    for (const image of this.cache.values()) image.close();
    this.cache.clear();
    this.wanted = [];
  }

  /** Start fetching wanted tiles, up to CONCURRENCY at a time. */
  private pump(): void {
    if (this.disposed || this.failed || !this.active) return;
    for (const tile of this.wanted) {
      if (this.pending.size >= CONCURRENCY) break;
      if (this.cache.has(tile.key) || this.pending.has(tile.key) || this.broken.has(tile.key)) continue;
      this.fetchTile(tile);
    }
  }

  private fetchTile(tile: ImageTile): void {
    const controller = new AbortController();
    this.pending.set(tile.key, controller);
    void loadSatelliteTile(this.gameRoot, tile.level, tile.x, tile.y, controller.signal)
      .then((blob) => createImageBitmap(blob))
      .then((image) => {
        if (this.disposed || controller.signal.aborted) {
          image.close();
          return;
        }
        this.cache.set(tile.key, image);
        this.evictOverLimit();
      })
      .catch((error) => {
        if (this.disposed || controller.signal.aborted) return;
        // One bad tile stays blank (vector map shows through); it never disables the whole layer.
        this.broken.add(tile.key);
        console.warn(`Satellite tile ${tile.key} unavailable:`, error);
      })
      .finally(() => {
        this.pending.delete(tile.key);
        if (!this.disposed) {
          this.redraw();
          this.pump();
        }
      });
  }

  private evictOverLimit(): void {
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value!;
      this.cache.get(oldest)!.close();
      this.cache.delete(oldest);
    }
  }

  /** The archive or its metadata is unusable: switch the layer off and fall back to the map view. */
  private fail(error: unknown): void {
    this.failed = true;
    for (const controller of this.pending.values()) controller.abort();
    console.warn("Satellite unavailable:", error);
    if (this.active) this.report("Satellite unavailable · using the map view");
    this.redraw();
  }

  private report(text: string): void {
    if (text !== this.lastStatus) {
      this.lastStatus = text;
      this.status(text);
    }
  }
}
