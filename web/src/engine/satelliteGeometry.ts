import type { Bounds, SatelliteInfo } from "./types";

export type ImageTile = { key: string; level: number; x: number; y: number; bounds: Bounds };

/**
 * The pyramid tiles covering a viewport. Picks the closest supplied resolution, then converts pixel
 * tiles to world bounds independently on each axis — so pyramids that are not one pixel per world
 * tile (or not square) still align.
 */
export function visibleImageTiles(info: SatelliteInfo, viewport: Bounds, scale: number): ImageTile[] {
  const worldPerPixelX = (info.bounds.maxX - info.bounds.minX) / info.imageWidth;
  const worldPerPixelY = (info.bounds.maxY - info.bounds.minY) / info.imageHeight;
  const ideal = Math.max(
    0,
    Math.floor(Math.log2(1 / (scale * Math.max(worldPerPixelX, worldPerPixelY)))),
  );
  const level = info.levels.reduce(
    (best, n) => (Math.abs(n - ideal) < Math.abs(best - ideal) ? n : best),
    info.levels[0],
  );

  const pixels = info.tileSize * 2 ** level;
  const spanX = pixels * worldPerPixelX;
  const spanY = pixels * worldPerPixelY;
  const columns = Math.ceil(info.imageWidth / pixels);
  const rows = Math.ceil(info.imageHeight / pixels);
  const firstX = Math.max(0, Math.floor((viewport.minX - info.bounds.minX) / spanX));
  const firstY = Math.max(0, Math.floor((viewport.minY - info.bounds.minY) / spanY));
  const lastX = Math.min(columns - 1, Math.floor((viewport.maxX - info.bounds.minX) / spanX));
  const lastY = Math.min(rows - 1, Math.floor((viewport.maxY - info.bounds.minY) / spanY));

  const tiles: ImageTile[] = [];
  for (let y = firstY; y <= lastY; y++) {
    for (let x = firstX; x <= lastX; x++) {
      const minX = info.bounds.minX + x * spanX;
      const minY = info.bounds.minY + y * spanY;
      tiles.push({
        key: `${level}/${x}/${y}`,
        level,
        x,
        y,
        bounds: { minX, minY, maxX: minX + spanX, maxY: minY + spanY },
      });
    }
  }
  return tiles;
}
