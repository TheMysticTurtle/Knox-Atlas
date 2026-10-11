import type { Bounds, Point } from "./types";

/** World-tile coordinate helpers shared by pointer HUD, selection and jump input. */
export function tilePoint(point: Point): Point {
  return { x: Math.floor(point.x), y: Math.floor(point.y) };
}

export function coordinateText(point: Point): string {
  const { x, y } = tilePoint(point);
  return `${x}, ${y}`;
}

export function gridPoint(point: Point, size: number): Point {
  return { x: Math.floor(point.x / size), y: Math.floor(point.y / size) };
}

export function parseCoordinates(x: string, y: string, bounds: Bounds): Point | null {
  if (!x.trim() || !y.trim()) return null;
  const point = { x: Number(x), y: Number(y) };
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  return point.x >= bounds.minX && point.x <= bounds.maxX && point.y >= bounds.minY && point.y <= bounds.maxY
    ? tilePoint(point) : null;
}
