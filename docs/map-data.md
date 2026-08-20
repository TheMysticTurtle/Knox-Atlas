# Project Zomboid map data — sources & coordinates

What Knox Atlas reads from the installed game, verified on a local Steam Build 42 install
(2026-08-19). Observations, not a promise future builds keep identical formats. All reads are
read-only.

Base-map directory (shared base for the neighboring towns despite the name):
```
ProjectZomboid/media/maps/Muldraugh, KY/
```

## Sources

| File | Provides | Used for |
|---|---|---|
| `map.info` | title, zoom defaults, compiled-cell metadata (`256`, chunk `8`) | read |
| `worldmap.xml` | vector water/roads/rail/buildings/terrain; **8 broad building classes** | read (base map) |
| `streets.xml` | named street polylines + widths | read |
| `worldmap-annotations.lua` + `MapLabel.json` | town/area/water/landmark labels | read |
| `objects.lua` | `ZombiesType` (zombie theme zones), `ParkingStall` (vehicles), `WaterZone`, `LootZone` | read |
| **`*.lotheader`** | **RoomDefs — real building/room identity (gun/book/bait/grocery/… )** | read (see `lotheader-format.md`) |
| `worldmap.png` (117 MB) + `pyramid.zip` (53 MB) | pre-rendered raster overview + multi-zoom tiles | **P1 satellite base layer** |
| `*.lotpack` (3.8 GB) | detailed tile pixels | deferred (textured 3D out of scope) |
| `media/lua/shared/VehicleZoneDefinition.lua` | zone→vehicle-script pools | read (vehicle pools) |

## What `ZombiesType` zones actually are (important correction)

They are **zombie population / outfit / loot-theme zones** ("cop zeds in police stations, chef zeds
in restaurant kitchens, bride & groom at a wedding"), *not* a business directory. The prototype
mislabeled all ~1,550 as "businesses," including pure theme zones (`Swimmer`, `Wedding`, `BaseballFan`,
`Offices`×385). In the evolution these become a **separate opt-in "zombie theme zones" layer**; real
businesses come from RoomDefs.

`objects.lua` `LootZone` records are only wealth tiers (`Rich`/`Poor`), not category types.

## Coordinate systems (do not conflate)

| Grid | Cell size | Conversion |
|---|---|---|
| `worldmap.xml` vector cells | **300** | `worldX = cellX*300 + pointX` |
| `.lotheader`/`.lotpack` compiled cells | **256** | `worldX = cellX*256 + roomX` |
| Compiled-cell index (display) | 256 | `floor(worldX/256)` |
| Chunk index (display) | 8 | `floor(worldX/8)` |

Both vector (300) and lotheader (256) resolve to the **same absolute world space**; they just use
different per-cell origins. Cross-validated via a `gunstore` RoomDef landing inside a
`RetailAndCommercial` worldmap footprint (see `lotheader-format.md`).

## Save data (Tiers 2–3)

Point the reader at any save dir under `%USERPROFILE%/Zomboid/Saves/`. SP, self-host, and dedicated
server saves share structure. A **remote multiplayer client's** cache is thin (empty `vehicles.db`,
tiny `map_symbols.bin`) — authoritative loot/vehicles/positions live on whoever hosts the world.
`InGameMap.ini` `WorldMap.CenterX/Y` is the last saved *map view*, not player position. Player
positions, container loot, and `vehicles.db` require a save decoder (P3) + a player-record spike.

## Update-risk order (on game updates)

1. `map.info` coordinate metadata. 2. Required files still present. 3. XML element/property names.
4. Annotation call shape + translation path. 5. `objects.lua` record shape/zone names.
6. **`.lotheader` magic/version/record layout** (`lotheader-format.md` checklist).
7. Installed-game parse test + visual alignment check. Keep version handling inside `crates/core`.
