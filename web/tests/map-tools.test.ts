import assert from "node:assert/strict";
import { test } from "node:test";
import { coordinateText, gridPoint, parseCoordinates, tilePoint } from "../src/engine/coordinates.ts";
import { visibleImageTiles } from "../src/engine/satelliteGeometry.ts";
import { openSatellite, parsePyramidInfo } from "../dev/satellite.ts";

const bounds = { minX: 0, minY: 0, maxX: 19968, maxY: 16128 };

test("world coordinates use containing tiles and compiled/chunk grids, including negatives", () => {
  assert.deepEqual(tilePoint({ x: 6080.9, y: 5309.2 }), { x: 6080, y: 5309 });
  assert.equal(coordinateText({ x: 6080.9, y: 5309.2 }), "6080, 5309");
  assert.deepEqual(gridPoint({ x: 6080, y: 5309 }, 256), { x: 23, y: 20 });
  assert.deepEqual(gridPoint({ x: 6080, y: 5309 }, 8), { x: 760, y: 663 });
  assert.deepEqual(gridPoint({ x: -0.1, y: -257 }, 256), { x: -1, y: -2 });
});

test("jump accepts finite in-bounds coordinates and rejects blank, invalid or outside input", () => {
  assert.deepEqual(parseCoordinates("6080", "5309", bounds), { x: 6080, y: 5309 });
  assert.deepEqual(parseCoordinates(" 0 ", "0", bounds), { x: 0, y: 0 });
  for (const [x, y] of [["", "12"], [" ", "1"], ["NaN", "1"], ["Infinity", "2"], ["1,000", "2"], ["-1", "10"], ["20000", "10"]]) {
    assert.equal(parseCoordinates(x, y, bounds), null);
  }
});

test("satellite zoom and tile placement use metadata, not the compiled-cell grid", () => {
  const info = parsePyramidInfo("VERSION=1\nbounds=0 0 19968 16128\nimageSize=19968 16128", [0, 1, 2, 3, 4]);
  const close = visibleImageTiles(info, { minX: 6000, minY: 5200, maxX: 6200, maxY: 5400 }, 1);
  assert.equal(close[0].level, 0);
  assert.deepEqual(close[0].bounds, { minX: 5888, minY: 5120, maxX: 6144, maxY: 5376 });
  const overview = visibleImageTiles(info, bounds, 0.04);
  assert.equal(overview.length, 20);
  assert.equal(overview[0].level, 4);
  assert.deepEqual(visibleImageTiles(info, { minX: -500, minY: -500, maxX: -1, maxY: -1 }, 1), []);
});

test("non-1:1 imagery and offset world bounds remain aligned at every resolution", () => {
  const info = parsePyramidInfo("VERSION=1\nbounds=100 200 1100 2200\nimageSize=500 1000", [0, 1]);
  const tiles = visibleImageTiles(info, info.bounds, 1);
  assert.deepEqual(tiles[0].bounds, { minX: 100, minY: 200, maxX: 612, maxY: 712 });
  assert.equal(tiles.length, 8);
});

test("preview rejects unsupported metadata", () => {
  for (const text of ["VERSION=2\nbounds=0 0 1 1\nimageSize=1 1", "VERSION=1\nbounds=NaN 0 1 1\nimageSize=1 1", "VERSION=1\nbounds=0 0 0 1\nimageSize=1 1", "VERSION=1\nbounds=0 0 1 1\nimageSize=0 1"])
    assert.throws(() => parsePyramidInfo(text, [0]));
  assert.throws(() => parsePyramidInfo("VERSION=1\nbounds=0 0 1 1\nimageSize=1 1", [0, 2]));
});

test("local preview can read the supplied archive when explicitly configured", { skip: !process.env.ATLAS_TEST_PYRAMID }, async () => {
  const source = await openSatellite(process.env.ATLAS_TEST_PYRAMID!);
  try {
    assert.equal(source.info.tileSize, 256);
    assert.equal(source.info.imageWidth, 19968);
    assert.deepEqual(source.info.levels, [0, 1, 2, 3, 4]);
    assert.equal(source.entries.size, 6583);
  } finally { source.zip.close(); }
});
