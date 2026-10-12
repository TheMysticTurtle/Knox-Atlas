# Project Zomboid map data — sources and limits

Updated 2026-10-11 against the active code and local Steam installation. Build 42 observations
below are **not universal format guarantees**. The selected build and source map must be recorded
when reproducing a mismatch. Game/save access is read-only.

Current base source is hard-coded to:

```text
ProjectZomboid/media/maps/Muldraugh, KY/
```

This contains the neighboring towns too. Automatically composing arbitrary map mods is not yet
implemented. Install discovery can find configured Steam libraries; selecting an alternate path
is supported in core/Tauri but not yet restored in the active UI.

## Sources

| Source | Information | Active use / limitation |
| --- | --- | --- |
| `map.info` | Map title, defaults, compiled-cell/chunk metadata | Parsed for snapshot metadata. |
| `worldmap.xml` | Vector terrain, water, roads, rail, building footprints/classes | Rendered overview. Building colors are not room functions. |
| `streets.xml` | Named polylines and widths | Street labels; not yet a verified routing graph (road path plotting is planned — see roadmap). |
| `worldmap-annotations.lua`, `MapLabel.json` | Town, area, water, landmark labels | Rendered labels. Landmark text is not a complete business-name directory. |
| `objects.lua` | Theme zones, parking/vehicle zones, water zones, wealth-tier loot zones | Parsed into snapshot; room POIs currently drive the visible dot layer instead. |
| `*.lotheader` | Tile-name table, named room rectangles, floor Z; later building section | Rust room parsing implemented. Frontend receives room-center POIs, not rectangles/building membership. |
| `ProceduralDistributions.lua`, `SuburbsDistributions.lua`, `Distributions.lua` | Static container/room loot definitions | Approximate room-to-items index; not live loot or exact probabilities. |
| `pyramid.zip` | Multi-resolution terrain imagery: levels 0–4 of 256-px PNG tiles, 1 world tile per pixel at level 0 (bounds 0–19968 × 0–16128) | **Satellite base layer** — read on demand, visible tiles only. |
| `worldmap.png`, `forest.pyramid.zip`, `spawnSelectImagePyramid.zip` | Other ready-made overview/forest/spawn-screen imagery | Inspected; not used. |
| `*.lotpack` + sprite assets | Encoded tile/object references and the assets needed to draw them | Not used, and a detailed decoder is **not planned** (owner: too much like cheating). These files are not tile pixels. |
| `VehicleZoneDefinition.lua` | Vehicle spawn-script pools and distribution context | Parsed into snapshot; active vehicle UI/overlay pending. |
| Save `players.db`, `vehicles.db` | Last-saved player/vehicle coordinates | Isolated core reader; not connected to desktop; live-read safety needs repair. |
| `InGameMap.ini` | Last-saved map camera | Snapshot metadata, **not player location**. Engine currently fits the full map on startup. |

## Coordinate systems

| Source grid | Observed cell/chunk size | World-space conversion |
| --- | --- | --- |
| Vector XML cells | 300 tiles | `worldX = cellX * 300 + pointX` |
| Compiled RoomDefs | 256 tiles | `worldX = cellX * 256 + roomX` |
| Compiled cell readout | 256 tiles | `floor(worldX / 256)` |
| Compiled chunk readout | 8 tiles | `floor(worldX / 8)` |

X/Y conversions from each grid land in the same absolute world space. Do not multiply vector cells
by the compiled cell size. Alignment was checked with a known gun-store room inside its vector
retail footprint; see [header format](lotheader-format.md).

Z is signed and separate: 0 ground, positive above, negative below. Keep negative values through
parsing, transport, filtering, and clicks. Show available floors from the data, not a hard-coded
maximum. Current core stores Z; current UI draws POIs from all floors together.

## Raster inspection — 2026-10-10

Read-only inspection of the local map directory found:

- `worldmap.png`: 10234 × 8314 pixels; 122,727,192 bytes.
- `pyramid.zip`: 52,984,481 bytes, level directories with `tile<X>x<Y>.png` entries.
- `pyramid.txt`: `VERSION=1`, `bounds=0 0 19968 16128`, `imageSize=19968 16128`.
- `pyramid.zip` directories 0–4 hold zoom resolutions, not floors:
  4,914 / 1,248 / 320 / 80 / 20 PNG entries.
- `forest.pyramid.zip`: 11,409,738 bytes; bounds/imageSize 19800 × 15900.
- `spawnSelectImagePyramid.zip`: 165,691,664 bytes; bounds 19800 × 16085,
  imageSize 10234 × 8314, linear min/mag filters.

Local `ISWorldMap.lua` and `ISMiniMap.lua` terrain-image functions select `pyramid.zip`;
`ISMapDefinitions.lua` default-style code adds `forest.pyramid.zip`.
The terrain-image functions are guarded by `TERRAIN_IMAGE`; code references are not a claim the
option is enabled in every build. These supplied resources are the lightweight image-view source.

These dimensions differ; stretching the standalone PNG to arbitrary vector bounds is not a
validated transform. First inspect tile sizes/level scaling and confirm metadata interpretation
against several distant landmarks. Prefer visible pyramid tiles to decoding a huge single image.
The overview does not contain separable interior floors. Implementation/acceptance details:
[map views and navigation](map-views-navigation.md).

## Room meaning versus theme zones

A RoomDef such as `gunstore` or `pharmacy` describes an authored room function. Several rooms
can belong to one business, and a type is not a storefront name. The core's building-section
association is not yet parsed.

`ZombiesType` records describe zombie population/outfit themes, not a business directory.
`Swimmer` and `Wedding` must not be labeled businesses. A separate opt-in theme layer is planned.
`LootZone` wealth labels such as Rich/Poor are not lists of loot categories. Explicit water-zone
counts are not a count of all water access: rivers remain base-map geometry.

## Static loot extraction

The current parser scans braces and extracts item pairs/procedural references with regex; it does
not execute Lua or fully parse Lua string/comment semantics. It merges duplicates by **maximum
weight**, sorts descending, and keeps **every item** (uncapped since 2026-10-11, so item search
can't silently miss places). The selection card displays the top 24.

A local generated sample has 502 room-type loot lists (longest 1,682 items; 3,225 distinct items).
Search treats an item as **likely** in a room type when it is among that room's top 50 by weight,
otherwise **possible**; the game's generic `all` table (containers in any room) makes an item
possible anywhere. This is a sample, not a promised count for every build. Weight is neither percentage chance nor a reliable ranking
across different container/procedural definitions. Container rolls, procedural constraints,
sandbox settings, and mod overrides are not modeled completely.

Container/source context is still not retained (only the merged room-type list). Before probability
claims: implement and validate the underlying semantics.
Unknown/new data should yield a warning or an explicit unknown, not a fabricated result.

## Save and runtime boundaries

Core currently queries player X/Y/Z and vehicle X/Y from SQLite. It does not decode vehicle type,
condition, keys, player inventory, or container chunk contents. Host/server-owned saves generally
contain more authoritative records than a remote client's cache; inspect actual schema/data rather
than assume all clients have every player.

The current `immutable=1` connection is **not** a copied snapshot. SQLite treats that option as an
unchanging file and disables change detection/locking; it can give incorrect results if the file
changes. Do not expose it as a safe live reader. Replace it with a tested read-only consistency
strategy that handles busy databases and WAL state, or require a genuinely stable snapshot.
Opening errors currently collapse to an empty result and must be distinguished from missing data.
See [SQLite URI documentation](https://www.sqlite.org/uri.html).

A local live-player export is a separate optional source; it does not imply access to server loot
or other players. Installed layout also does not reflect player-built/destroyed structures or
every random basement. Keep freshness and provenance visible.

## Game-update checklist

1. Record game build, map source, and enabled map/mod order if applicable.
2. Check required files and coordinate metadata; do not silently reuse the wrong conversion.
3. Validate XML/property/annotation and Lua record shapes.
4. Check header magic/version/count bounds; current parser still lacks a version rejection guard.
5. Run game-independent parser fixtures, then the optional installed-game corpus checks.
6. Check raster/room alignment at ground, upper floor, and negative Z where data exists.
7. Invalidate derived caches and make unsupported optional layers visibly unavailable.
