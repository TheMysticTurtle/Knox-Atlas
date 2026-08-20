# Project Zomboid map data notes

These notes summarize what was verified from a local Steam installation on 2026-08-08. They are observations, not a promise that future Project Zomboid builds will keep identical formats.

Observed Steam build ID: `24574865`.

## Relevant sources

The base-map directory discovered in the current installation is:

```text
ProjectZomboid/media/maps/Muldraugh, KY/
```

Despite the directory name, this is the shared base map used by the neighboring town definitions in the install.

| File | What it provides | Current use |
| --- | --- | --- |
| `map.info` | Map title, zoom defaults, compiled cell metadata, `fixed2x` | Read |
| `worldmap.xml` | Vector water, roads, rail, buildings, and terrain | Read |
| `worldmap-forest.xml` | Large forest/vegetation vector layer | Deferred |
| `streets.xml` | Named street polylines and widths | Read |
| `worldmap-annotations.lua` | Town, area, water, and landmark text placement | Read |
| `MapLabel.json` | English text for annotation keys | Read |
| `objects.lua` | Parking, activity, loot, and water zones | Read |
| `worldmap.xml.bin` | Compiled world-map form | Not needed while XML is available |
| `worldmap.png` / `pyramid.zip` | Raster overview/pyramid assets | Not needed by the vector renderer |
| `.lotheader`, `.lotpack`, and map `.bin` files | Compiled detailed tile/cell data used by the game world | Deferred; see the detailed-map feasibility study |

The game script `media/lua/client/ISUI/Maps/ISMapDefinitions.lua` was especially useful: it shows which sources the in-game map loads and records the in-game map color palette. Knox Atlas mirrors those category colors rather than inventing a competing map legend.

## Installation discovery

Knox Atlas first checks the normal Windows Steam roots and parses Steam's `steamapps/libraryfolders.vdf` to find additional libraries. A valid game root must contain both `projectzomboid.jar` and `media/maps`.

The Local game source card shows the root currently in use. A user may choose another `ProjectZomboid` folder through the native folder picker; Rust validates it before the path is remembered in app-owned storage. The folder remains read-only.

## App-owned companion data

The selected installation path, preferred camera view, custom markers, and saved measurements are
not Project Zomboid map or save records. They stay in Knox Atlas's WebView profile beneath
`%LOCALAPPDATA%\com.pzcompanion.map` for the current Windows account. This keeps user annotations
out of the installed map sources and makes the same records available to both installer and portable
builds.

Do not teach a map parser to read or write these records. Their versioned storage keys and migration
boundary are documented in [architecture.md](architecture.md); portable preservation and backup
notes live in [portable.md](portable.md).

## Save metadata

The app selects the most recently modified save directory beneath:

```text
%USERPROFILE%/Zomboid/Saves/
```

`InGameMap.ini` can contain:

- `WorldMap.CenterX`
- `WorldMap.CenterY`
- `WorldMap.Isometric`

The center is the last saved **map view**, not an authoritative player position. The UI must always keep that distinction visible.

Other observed save files include `map_symbols.bin`, `map_t.bin`, `vehicles.db`, and explored-map data. They are intentionally not parsed in the first version:

- `map_t.bin` is global mod/table data, not a dependable player-location source.
- `vehicles.db` describes saved world state but is not required for the lighter “possible vehicle zones” layer.
- Multiplayer client saves do not expose a simple trustworthy roster of live player coordinates.

## Detailed cells and floors

The inspected installation contains 4,065 `.lotheader` files and 4,065 `.lotpack` files totaling about 3.8 GB, plus thousands of map `.bin` files. Those sources carry the detailed tile world rather than the light overview geometry Knox Atlas currently reads. They make a selectable-floor view possible, but only through a new cell decoder and renderer; they are not ready-made images.

See [Detailed map and floor-level feasibility](detailed-map-feasibility.md) for the proposed incremental approach.

## Coordinate systems

Project Zomboid exposes related coordinate grids that should not be conflated.

### Absolute world coordinates

Annotations and object zones use absolute X/Y world-square coordinates. These are the coordinates players commonly use to identify a location.

### World-map XML cells

Features in `worldmap.xml` are nested in `<cell x="…" y="…">` elements. Their points are local to that vector cell.

The verified conversion is:

```text
worldX = vectorCellX * 300 + pointX
worldY = vectorCellY * 300 + pointY
```

That conversion aligns vector features with absolute annotations, streets, and object zones in the installed map.

### Compiled cells and chunks

The current `map.info` describes compiled cells of `256 × 256` and chunks of `8 × 8` with `fixed2x=true`. Knox Atlas reports these indices separately:

```text
compiledCellX = floor(worldX / 256)
compiledCellY = floor(worldY / 256)
chunkX = floor(worldX / 8)
chunkY = floor(worldY / 8)
```

Do not silently replace the vector XML's 300-unit origin multiplier with the compiled 256-unit cell size. They describe different source structures in the observed Build 42 data.

## Labels and businesses

Official annotation text currently yields town/area labels and a smaller set of named landmarks. `streets.xml` supplies street names.

There is no single canonical “business directory.” The game does provide `ZombiesType` activity zones with useful names such as restaurant, police, pharmacy, auto repair, Spiffo's, GigaMart, Fossoil, and other brands/activities. Knox Atlas surfaces these as game zones and de-duplicates very close repeats.

This is approximate business context, not a promise that every polygon is a storefront or still contains loot.

## Likely loot categories

Broad categories are inferred from explicit zone names:

- Food: restaurants, diners, markets, cafés, and grocery brands.
- Medical: doctor, pharmacy, hospital, nursing home, and ambulance zones.
- Tools/materials: factories, construction, farms, logging, and related activities.
- Security/services: police, prison, military, and survivalist zones.
- Fuel: named gas-station brands.
- Water zones: 49 explicit `WaterZone` records in the current installed map. These are authored activity/resource zones, not an inventory of every usable shoreline, well, sink, or other water source. The basemap separately draws hundreds of water polygons from `worldmap.xml`.

The filter is useful for navigation, but container distributions and generated contents remain governed by the game, sandbox settings, and current save state.

The raw vector source also uses `building=yes` when a building has no more specific display category. Knox Atlas presents that value as **Unclassified buildings**; `yes` is not a gameplay building type.

## Vehicles

`ParkingStall` zones indicate possible parked or spawned vehicles. The game's `media/lua/shared/VehicleZoneDefinition.lua` maps those zone names to weighted vehicle scripts and sometimes supplies `baseVehicleQuality` and `chanceToPartDamage`.

Knox Atlas uses those definitions to expose focused, overlapping pool filters:

- Cars & SUVs
- Vans & shuttles
- Trucks & utility
- Emergency & service

Obvious wreck-only sources (`burnt`, traffic-jam, and junkyard pools) are excluded. A generic parking pool may legitimately appear in more than one group because it can spawn more than one vehicle body type.

The quality and damage values describe the **spawn distribution**, not the condition of a live vehicle. The selected-point detail uses language such as lower/standard/higher expected quality and retains the configured part-damage percentage.

The inspected multiplayer client's `vehicles.db` is a valid SQLite database with an `id`, world position, and serialized `data` blob schema, but it contains zero local vehicle rows because the server owns that state. Keys are separate serialized items in world/container state, so this client has no reliable vehicle-to-key coordinate relationship to draw. A key line requires a future single-player save decoder or an authorized server integration.

There are thousands of these zones, so the renderer enables them only at a useful zoom level and culls off-screen points.

## Update risk

On a new game update, verify in this order:

1. `map.info` coordinate metadata.
2. Required source files still exist.
3. XML element/property names used by the parsers.
4. Annotation call shape and translation path.
5. `objects.lua` record field order and zone names.
6. Installed-game parsing test and a visual alignment check.

Keep version-specific handling inside the Rust adapter. The renderer should continue to consume the same normalized `GameSnapshot` where practical.
