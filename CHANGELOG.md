# Changelog

All notable user-facing changes will be recorded here. The project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) while it is pre-release.

## [Unreleased]

### Added

- Read-only discovery and parsing of a local Project Zomboid Steam installation.
- Game-derived vector map, building-category colors, water, roads, rail, and terrain.
- Town/area annotations, street names, landmarks, and game activity/business zones.
- Likely-loot categories for food, medical, tools/materials, security/services, fuel, and water.
- Possible vehicle spawn-zone layer.
- Search, X/Y jump, pointer coordinates, compiled-cell/chunk readout, and map controls.
- Manual current-position and destination markers with direct tile distance.
- Latest-save discovery and last-map-view centering with an explicit non-live-position notice.
- Architecture, map-data, roadmap, development, and visual-baseline documentation.
- One-click Windows development launcher.
- GitHub Actions verification and draft Windows release pipelines.
- NSIS installer packaging and a best-effort portable test archive.

### Changed

- Likely-loot filters now highlight matching zones and fade unrelated business zones so selection is visually clear.

### Known limitations

- Standard Steam library discovery only; no path picker yet.
- Reads the base English map/labels once at startup.
- No live player or party locations.
- No persisted custom markers or preferences.
- Loot and vehicle layers are possible zones, not live save contents.
