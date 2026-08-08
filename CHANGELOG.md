# Changelog

All notable user-facing changes will be recorded here. The project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning.

## [Unreleased]

### Changed

- Reworked the README into a friendlier release, installation, security, and source-build guide.
- Added ready-to-paste Nexus Mods listing copy.
- Verification now runs on every pushed branch and pull request; the manual Windows release workflow repeats frontend and Rust checks before packaging.

## [0.1.0] - 2026-08-08

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
- Scalable category pictograms for business, loot, resource, and vehicle zones.
- Expandable per-type filters, including gas stations as both a business subtype and likely fuel source.
- Expandable building-color legend with individual building-type visibility.
- Larger interface, town, area, and street typography with overview-aware town label sizing.
- Focused drivable vehicle-pool filters for cars/SUVs, vans/shuttles, trucks/utility, and emergency/service vehicles.
- Expected spawn-pool quality and part-damage context from the game's vehicle distribution definitions; obvious wreck/traffic pools are excluded.
- Larger coordinate readout with one-click `X, Y` clipboard copy.
- Larger selected-point information card and a horizontal upper-left map-control strip.
- Persistent saved map center and zoom with a top-bar save action and target-button restore.
- Up to 100 locally persisted named markers with selectable colors, emphasized foreground rendering, focus, rename, remove, and collapsible-list actions.

### Changed

- Likely-loot filters now highlight matching zones and fade unrelated business zones so selection is visually clear.
- Town labels receive a final foreground pass so dense POI and vehicle markers cannot cover them.
- Main layer switches share one aligned control column, and map controls use larger SVG icons with hover/focus tooltips.
- Raw `building=yes` map metadata is labeled **Unclassified buildings** instead of appearing as a bogus `yes` category.
- The water filter says **Water zones** and explains that its count covers authored zone records while waterways remain part of the basemap.
- Coordinate copying now belongs to the stable clicked-location card instead of the continuously changing pointer HUD.
- Position and destination use distinct colored actions plus a route-status card with coordinates, clear controls, and direct distance.
- Selected-place actions now pair set/clear controls for position and destination, followed by marker and coordinate-copy actions.
- Layer descriptions now wrap to their full text while counts and switches remain aligned.

### Known limitations

- Standard Steam library discovery only; no path picker yet.
- Reads the base English map/labels once at startup.
- No live player or party locations.
- No persisted route points or filter preferences.
- Loot and vehicle layers are possible zones, not live save contents.
