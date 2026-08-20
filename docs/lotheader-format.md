# `.lotheader` format — validated reference

Reverse-engineered and validated against the installed Build 42 game on 2026-08-19. This is the
source of Knox Atlas's real building/room identity (gun shops, bookstores, groceries, etc.). Port the
reference decoder (was `scratchpad/lot_enum.py`) into `crates/core`.

## Why this file matters

Room/business identity is **not** in `objects.lua` (those `ZombiesType` zones are zombie
population/outfit/loot-theme zones). It lives in the **RoomDef** records inside `.lotheader` files.
These total **~39 MB** across 4,065 files — *not* the 3.8 GB `.lotpack` tile-pixel data (which stays
deferred). The prototype docs conflated the two.

## Binary layout (little-endian)

```
"LOTH"                      # 4-byte magic
u32 version                # observed = 1
u32 tileCount
tileCount × ( tileName + "\n" )     # newline-terminated ASCII tile-name table

i32 w                      # observed 8 (grid dims; not needed for POIs)
i32 h                      # observed 8
i32 u0                     # unknown (0 in samples)
i32 u1                     # unknown
i32 nRooms

per room (× nRooms):
    name + "\n"            # newline-terminated ASCII room-definition name
    i32 floor              # Z level (0 = ground, 1 = second floor, ...)
    i32 nRects
    nRects × ( i32 x, i32 y, i32 w, i32 h )     # 16 bytes each; room rectangles
    i32 nObjects
    nObjects × ( i32 type, i32 x, i32 y )       # 12 bytes each; room objects (doors/spawns/etc.)

# (a building section referencing room indices follows; not needed for POIs)
```

**Gotcha that bit the spike:** each room has a **second list (`nObjects`, 12-byte elements)** after
its rectangles. Missing it (treating it as a single padding int) silently misaligns every room after
the first non-empty one. With it handled: all 4,065 files parse with **0 errors**.

## Coordinate conversion — CELL SIZE IS 256

```
worldX = cellX * 256 + roomRectX
worldY = cellY * 256 + roomRectY
```
`cellX`, `cellY` come from the filename `cellX_cellY.lotheader`.

**Cross-validated:** a `gunstore` room's 256-model world coordinate lands *exactly inside*
(distance 0.0) a `worldmap.xml` building footprint tagged `RetailAndCommercial`; the 300-model was
126 tiles off, near an unrelated `Industrial` footprint. Note `worldmap.xml` keeps its own **300**
cell size — the two sources use different per-cell origins but agree in absolute world space.

## Corpus stats (validated run)

- 4,065 `.lotheader` files, **0 parse errors**.
- **90,827 rooms** across **765 cells** that contain rooms.
- **586 distinct room-definition names.**

## Verification checklist (when porting to Rust / on game updates)

1. Magic `LOTH`, version still 1.
2. All installed lotheaders parse with 0 errors (whole-corpus test).
3. A known `gunstore` room's 256-coord falls inside a `RetailAndCommercial` worldmap footprint.
4. Z levels look sane (ground/upper); room-type vocabulary matches `taxonomy.md`.
