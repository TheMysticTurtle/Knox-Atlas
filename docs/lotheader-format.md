# `.lotheader` format — observed reference

Updated 2026-10-10. The format was investigated against the installed Build 42 corpus on
2026-08-19 and ported to **`crates/core/src/rooms.rs` on 2026-08-21**. The Python spike remains
at `docs/reference/lot_enum.py` for comparison; Rust is the active implementation.

RoomDefs supply authored room names, rectangles, and signed Z, not complete rendered interiors.
The observed header corpus totals about 39 MB across 4,065 files. The much larger `.lotpack`
data encodes tile/object references and needs sprite assets to become imagery.

## Observed layout (little-endian)

```text
"LOTH"                         # 4-byte magic
u32 version                    # observed 1; current Rust reader does not reject other versions
u32 tileCount
tileCount × (tileName + "\n")    # newline-terminated tile-name strings

i32 w                          # observed 8
i32 h                          # observed 8
i32 u0                         # semantics not established
i32 u1                         # semantics not established
i32 nRooms

per room:
    name + "\n"                # room-definition name
    i32 floor                  # signed Z: ground 0; retain negative levels
    i32 nRects
    nRects × (i32 x, y, w, h)
    i32 nObjects
    nObjects × (i32 type, x, y) # 12 bytes each; semantics not fully decoded

# A following building section is not parsed by the current room reader.
```

The object list must be consumed even when no object information is exposed. Treating its count
as one padding integer caused 2,716 misparses and 29 hard EOF errors in the initial spike.
Skipping the actual `nObjects * 12` bytes resolved that corpus's errors.

Do not advertise these skipped objects as decoded doors/spawns, or the following section as
validated building associations. Both need separate semantic verification.

## Coordinates

```text
worldX = cellX * 256 + roomRectX
worldY = cellY * 256 + roomRectY
```

Cell indices come from `cellX_cellY.lotheader`. A room may have several rectangles; preserve them
rather than replacing the floor plan with one bounding box. Current POIs use the bounding-box
center, which may not lie inside an irregular room.

A known gun-store room aligned inside its vector RetailAndCommercial footprint with this model;
the 300-cell model was 126 tiles off. Vector XML itself still uses 300-cell origins. These are
source-specific grids in the same absolute world space, not interchangeable constants.

## Historical corpus result — 2026-08-19

- 4,065 files, zero parse errors after consuming the object list.
- 90,827 rooms across 765 cells containing rooms.
- 586 distinct room-definition names.

These counts belong to that installation/run. They do not guarantee future builds/mod maps parse
or classify identically, and a current CI machine without the game does not reproduce the corpus.

## Current reader limitations

- Magic and ordinary truncated reads are checked, but the version is read and ignored.
- Negative room/rectangle/object counts are coerced to zero; allocations/count arithmetic need
  explicit bounds and invalid-count errors before broad untrusted/modded-source support.
- Strings are decoded lossily; unknown names are not a parser failure but may not be categorized.
- Tile-name table and object records are consumed but discarded; building section is not parsed.
- RoomDef has source cell coordinates and rectangles; MapPoi drops these and has no stable ID.
- Frontend geometry delivery, negative-floor filtering, and basement coverage checks are pending.

## Verification checklist

1. Add minimal synthetic fixtures for valid headers, truncation, unknown versions, invalid counts,
   multi-rect rooms, upper floors, and negative Z. No proprietary game files in fixtures.
2. Reject unsupported versions explicitly rather than parsing by coincidence.
3. Run optional installed-corpus checks and record build/source/stats.
4. Check several room outlines against known world locations, not only a centroid.
5. For floor work, verify a known authored basement in-game; absent negative-Z records do not prove
   that no basement exists in a save.
6. Decode/verify building associations before claiming selectable building membership.
