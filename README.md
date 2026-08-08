# Knox Atlas

Knox Atlas is a lightweight, read-only desktop companion map for Project Zomboid. It renders the vector map, streets, labels, building categories, and game-defined activity zones directly from the player's local installation.

![Knox Atlas map interface](docs/images/knox-atlas-ui-baseline.png)

The guiding idea is deliberately simple: show the map the installed game knows about without editing saves, injecting into the game, or maintaining a second hand-authored copy of Knox Country.

## Current capabilities

- Reads the installed Steam map and latest local save metadata.
- Renders the game-derived vector map on a responsive canvas.
- Shows towns, areas, street names, landmark labels, and business/activity zones.
- Uses Project Zomboid's own building-category colors.
- Filters broad, likely loot categories such as food, medical, tools, security, fuel, and water.
- Shows possible vehicle spawn zones.
- Searches names and jumps to exact X/Y coordinates.
- Displays world, compiled-cell, and chunk coordinates under the pointer.
- Supports manual “my position” and destination markers with direct tile distance.

“Likely loot” and vehicle layers describe game-defined zones, not the live contents of a save. Random generation, sandbox settings, looting, and world state still determine what is actually present.

## Run locally

Prerequisites: a Project Zomboid Steam installation, Node.js, npm, and the Rust toolchain.

```powershell
npm install
npm run tauri dev
```

Production checks:

```powershell
npm run build
cd src-tauri
cargo fmt --all -- --check
cargo test
```

The first native build takes longer because Cargo compiles Tauri and its dependencies. Later launches are much faster.

## Project status

This is an early working prototype. It currently discovers common Steam library paths automatically and reads data once at startup. It does **not** yet know the player's live position, watch files for changes, persist custom markers, or read other multiplayer players.

The last map center stored in `InGameMap.ini` is used only as a convenient opening view. It is explicitly not presented as the player's position.

## Documentation

- [Architecture](docs/architecture.md) — boundaries, data flow, rendering strategy, and design principles.
- [Map data notes](docs/map-data.md) — what the game files contain and how their coordinate systems relate.
- [Roadmap](docs/roadmap.md) — living backlog, priorities, and progress history.
- [Development guide](docs/development.md) — quick commands, branch conventions, checks, and maintainer notes.
- [Changelog](CHANGELOG.md) — user-visible progress by version.

## Principles

1. Read game data; never modify it.
2. Prefer the installed game as the source of truth.
3. Label inference as inference.
4. Keep dependencies and moving parts small.
5. Optimize only after measuring real map behavior.
6. Keep `main` runnable and document decisions near the code.

## Disclaimer

Knox Atlas is an unofficial community project. Project Zomboid and its game data are property of The Indie Stone. This repository does not redistribute the game's map files; it reads files from the user's own installation at runtime.
