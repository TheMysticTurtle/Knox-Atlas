# Roadmap and progress

This is the living backlog. Keep it brief, ordered, and honest. Move completed work into the history rather than leaving stale checked boxes everywhere.

## Now — make the prototype dependable

- [x] Parse the installed base vector map, streets, labels, and useful zones.
- [x] Read current Steam build metadata and latest-save map view.
- [x] Render a polished, responsive canvas map.
- [x] Add towns/areas, streets, business, building, likely-loot, and vehicle filters.
- [x] Add search, coordinate jump/readout, manual position/destination, and direct distance.
- [x] Make selected likely-loot categories visually distinct from the general business layer.
- [x] Document the map sources, coordinate systems, architectural choices, workflow, and limitations.
- [x] Add a one-click Windows development launcher and GitHub verification/release workflows.
- [x] Add scalable POI icons, larger map/menu typography, a building legend, and hierarchical subfilters.
- [x] Focus the vehicle layer on drivable spawn pools and surface expected pool quality/damage metadata.
- [x] Enlarge the coordinate HUD and add one-click coordinate copying.
- [x] Enlarge click-detail cards and align map controls in the upper-left.
- [x] Keep town labels above markers, align layer switches, and add larger tooltipped map controls.
- [x] Replace raw `building=yes` metadata with an honest unclassified-building label and clarify water-zone counts.
- [x] Move coordinate copying to stable clicked-place details and add explicit position/destination status and clear controls.
- [ ] Add small fixture-based parser tests that can run without a local game installation.
- [ ] Add an app-level smoke test for snapshot-to-first-render behavior.

## Next — practical daily-use improvements

- [ ] Add a reload-data action so a user can refresh without restarting.
- [ ] Persist layer preferences and manual markers in app-owned storage.
- [x] Add a clear building-color legend with per-type visibility controls.
- [ ] Let the user choose a non-standard game/save path when discovery fails.
- [ ] Improve business-name normalization and category coverage from real-world feedback.
- [ ] Add an explicit map/update compatibility warning when required source shapes change.
- [ ] Investigate save-backed claimed safehouses and randomized survivor houses; never infer them from ordinary residential polygons.
- [ ] Run the GitHub packaging workflow and smoke-test its NSIS and portable artifacts on a second machine.

## Later — mod and multiplayer support

- [ ] Discover enabled map mods and resolve their declared map dependencies/order.
- [ ] Read mod-provided world map, street, annotation, and object sources through the same adapter boundary.
- [ ] Design an optional tiny client mod that exports only the local player's position.
- [ ] Evaluate server-authorized party positions with privacy and permission controls.
- [ ] Evaluate authorized live vehicle condition and vehicle-to-key locations for single-player/server providers.
- [ ] Consider saved custom marker collections and import/export.

## Deliberately deferred

- Exact live container inventories.
- Reading process memory.
- Editing Project Zomboid saves.
- A hosted/shared browser map until the local companion map is polished and dependable.
- Full road routing before the map has suitable navigation topology.
- A database/cache layer before startup and render profiling justifies one.

## Progress history

### 2026-08-08

- Inspected the installed Project Zomboid map definitions, vector sources, annotations, translation labels, object zones, Steam manifest, and latest local save metadata.
- Confirmed the distinction between 300-unit vector cell origins and 256-unit compiled map cells in the installed Build 42 data.
- Chose a read-only Tauri companion and custom canvas renderer.
- Added the local map/save adapter in `451a261` (`feat(data): read local Project Zomboid map sources`).
- Added the first working interactive atlas and visual baseline in `ec22f08` (`feat(map): add interactive local atlas interface`).
- Corrected likely-loot filter emphasis in `8432027` (`fix(filters): make loot categories visually distinct`).
- Added the initial project handbook and replaced the scaffold README.
- Added scalable POI controls, subtype filters, drivable vehicle-pool context, larger coordinate/detail text, and copyable coordinates.
- Polished map hierarchy and controls: town labels stay above markers, switches align, map buttons are larger and self-describing, and ambiguous source labels are explained.

## Definition of done for a feature

A feature is done when:

1. Its user-facing behavior works with real installed data.
2. Empty/error cases are understandable and do not touch game files.
3. `npm run build`, Rust formatting, and Rust tests pass.
4. Relevant limitations or decisions are documented.
5. The commit is focused and `main` remains runnable.
