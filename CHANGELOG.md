# Changelog

All notable user-facing changes will be recorded here. The project follows the spirit of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and uses semantic versioning.

## [Unreleased]

## [0.1.1] - 2026-08-08

### Added

- Added PolyForm Strict 1.0.0 source-available licensing and included the license with Windows packages.
- Added a clickable Local game source card that displays the active installation and opens a native folder picker for alternate `ProjectZomboid` folders.
- Added Steam `libraryfolders.vdf` discovery so non-default Steam libraries are found without manual configuration.
- Added multi-point distance measurement with running segment totals, undo/clear controls, and up to 50 locally persisted named, colored paths.
- Added portable-use documentation covering Microsoft WebView2 checks, per-user saved-item persistence, updates, removal, and best-effort backup.
- Added Nexus/Vortex instructions for registering the portable executable as a Vortex dashboard tool without deploying it into Project Zomboid.

### Changed

- Reworked the README into a friendlier release, installation, security, and source-build guide.
- Added ready-to-paste Nexus Mods listing copy.
- Verification now runs on every pushed branch and pull request; the manual Windows release workflow repeats frontend and Rust checks before packaging.
- Replaced the two-point position/destination controls with a dedicated click-to-measure workflow.
- Increased the smallest layer, status, source, saved-item, coordinate, and map-credit text.
- Replaced the release overview screenshot and added focused marker/path, filter, and game-source examples.
- Updated project and package versions to `0.1.1`.

### Known limitations

- Markers and saved paths persist for the current Windows account, but built-in export/import is not yet available for transfers to another computer.
- Vortex integration is manual Dashboard tool registration; Knox Atlas is not a deployable Project Zomboid mod.

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
