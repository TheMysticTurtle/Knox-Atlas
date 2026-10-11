import { gridPoint, tilePoint } from "../engine/coordinates";
import type { Point } from "../engine/types";

/**
 * World tile X/Y plus the compiled cell (256 tiles) and chunk (8 tiles) it falls in. These are the
 * game's own grids — not the separate 300-tile vector source grid used by worldmap.xml.
 */
export function CoordinateReadout({
  point,
  cellSize,
  chunkSize,
}: {
  point: Point;
  cellSize: number;
  chunkSize: number;
}) {
  const tile = tilePoint(point);
  const cell = gridPoint(point, cellSize);
  const chunk = gridPoint(point, chunkSize);
  return (
    <div className="coordinate-readout">
      <span>
        <small>X</small> {tile.x}
      </span>
      <span>
        <small>Y</small> {tile.y}
      </span>
      <span className="grid-coordinate">
        <small>CELL</small> {cell.x}, {cell.y}
      </span>
      <span className="grid-coordinate">
        <small>CHUNK</small> {chunk.x}, {chunk.y}
      </span>
    </div>
  );
}
