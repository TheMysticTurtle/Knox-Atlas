# Knox Atlas

> A modern, read-only companion map that renders the Project Zomboid map already installed on your computer.

![Knox Atlas map interface](docs/images/knox-atlas-ui-baseline.png)

Knox Atlas turns Project Zomboid's own vector map, labels, streets, building metadata, and activity zones into a fast desktop atlas. It is designed for finding towns, roads, businesses, likely resources, and useful coordinates without modifying the game or maintaining a separate hand-authored copy of Knox Country.

The current goal is intentionally focused: make the local map excellent, dependable, and pleasant to use.

## Features

### Explore the installed map

- Reads map data directly from a local Project Zomboid Steam installation.
- Draws water, terrain, roads, railways, and thousands of building footprints on a responsive canvas.
- Shows official town, area, water, landmark, and street labels.
- Keeps major town names readable above dense POI and vehicle markers.
- Uses game-world X/Y coordinates throughout—no geographic-coordinate conversion required.

### Find useful places

- Search towns, streets, landmarks, businesses, and activity zones by name.
- Toggle businesses and likely-loot hints for food, medical supplies, tools/materials, security/services, fuel, and authored water zones.
- Expand a layer to select only the subtypes you care about, such as gas stations or medical locations.
- View Project Zomboid's building-color categories with individual visibility controls.
- Inspect possible drivable vehicle pools for cars/SUVs, vans/shuttles, trucks/utility vehicles, and emergency/service vehicles.

### Navigate with coordinates

- Jump directly to an X/Y coordinate.
- Read world, compiled-cell, and chunk coordinates under the pointer.
- Click any point to open stable X/Y, cell, and chunk details, then copy that selected coordinate with one click.
- Place distinct **YOU**, destination, and selected-coordinate markers; clear either route marker from the route status card.
- See direct tile distance between the manual position and destination.

### Desktop-friendly UI

- Sleek, scalable interface built for a second monitor or quick alt-tab use.
- Clear category icons, aligned switches, expandable filters, readable coordinate/detail cards, and tooltipped map controls.
- One-click Windows development launcher.
- NSIS installer packaging plus GitHub verification and release workflows.

## What the map is—and is not—telling you

Knox Atlas keeps source certainty visible instead of pretending every hint is live save data.

| Layer | Meaning |
| --- | --- |
| Basemap, streets, and official labels | Parsed directly from the installed game files. |
| Building colors | Game-authored display categories. `building=yes` means no specific category and is shown as **Unclassified buildings**. |
| Businesses and likely loot | Broad hints inferred from game-authored activity and loot zones. Actual contents are not guaranteed. |
| Water-zone count | Explicit `WaterZone` records—not every riverbank, well, sink, or usable water tile. Waterways remain visible in the basemap. |
| Vehicle pools | Places where drivable vehicles may spawn, with game-defined pool metadata when available—not confirmed live vehicles. |
| Latest save location | The last saved in-game map view used as a convenient starting camera, not the player's live position. |

Random generation, sandbox settings, mods, player activity, and the current save determine what is actually present in the world.

## Quick start

### Windows preview

With the development prerequisites installed, double-click:

```text
Launch Knox Atlas.cmd
```

The launcher starts the Vite frontend and Tauri desktop shell together in one console.

### Development

Prerequisites:

- Project Zomboid installed through Steam
- Node.js and npm
- Rust toolchain
- Windows WebView2 runtime for the Tauri shell

```powershell
npm install
npm run tauri dev
```

### Verify a change

```powershell
npm run check
cd src-tauri
cargo fmt --all -- --check
cargo test
```

### Build the Windows installer

```powershell
npm run desktop:build
```

The NSIS installer is written beneath `src-tauri/target/release/bundle/nsis/`. The release workflow also prepares a best-effort portable archive for testers.

## How it works

```text
Installed Project Zomboid map + latest save metadata
                       │
                       ▼
              Rust discovery/parsers
                       │
                 typed GameSnapshot
                       │
                       ▼
           TypeScript canvas map + filters
                       │
                       ▼
                 Tauri desktop app
```

The Rust side owns file discovery and source-specific parsing. The TypeScript side owns view state, prepared geometry, label collision, search, filters, and interaction. The game installation and save directories are always read-only.

## Current scope

Knox Atlas currently targets the base English map in common Steam library locations and reads its data once at startup. It does not yet:

- track the live player or other multiplayer players;
- identify randomized survivor houses or claimed safehouses from authoritative save data;
- show live container inventories, vehicle condition, or vehicle-key locations;
- discover every non-standard Steam library or enabled map mod;
- persist custom markers and filter preferences.

Those limitations are deliberate. A feature moves into the map only when its source and certainty can be represented honestly.

## Documentation

- [Architecture](docs/architecture.md) — boundaries, data flow, renderer decisions, and design principles.
- [Map data notes](docs/map-data.md) — source files, coordinate systems, inference rules, and known limits.
- [Roadmap and progress](docs/roadmap.md) — living backlog and implementation history.
- [Development guide](docs/development.md) — commands, branch conventions, checks, and maintainer notes.
- [Windows distribution](docs/distribution.md) — launcher, installer, portable preview, and release workflow.
- [Changelog](CHANGELOG.md) — user-visible changes during the pre-release period.

## Design principles

1. Read game data; never modify it.
2. Treat the installed game as the source of truth.
3. Clearly distinguish exact data from inference.
4. Keep dependencies and moving parts small.
5. Optimize measured map behavior, not imagined scale.
6. Keep `main` runnable and decisions documented near the code.

## Disclaimer

Knox Atlas is an unofficial community project. Project Zomboid and its game data are property of The Indie Stone. This repository does not redistribute the game's map files; it reads them from the user's own installation at runtime.
