# Knox Atlas — architecture

Updated 2026-10-11 against `feature/core-evolution`. This describes the **0.2.0 development
branch**, not the released 0.1.1 app. Implementation status lives in [progress](progress.md);
milestone order lives in [roadmap](roadmap.md). Historical prototype notes remain in `legacy/docs/`.

## Principles

- Keep the installed game and saves read-only. App settings, generated previews, and caches belong
  to Knox Atlas, not the game directories.
- Separate source parsing, map drawing, and interface controls. Add small modules when needed,
  not a framework for every possible future provider.
- Label evidence honestly: installed-map layout, likely loot, last-saved position, and live position
  are different things.
- **Simple by default, deeper on demand.** The default atlas stays uncluttered (supplied images +
  useful overlays). Heavier capabilities are isolated, opt-in extras that never clutter or gate the
  default. See the [roadmap](roadmap.md) principles.
- **Helpful, not a cheat.** Help players plan, without revealing "exactly where everything is." The
  game's low-res supplied imagery is the intended detail; no high-res detailed world renderer.
- Keep the atlas useful without a save, network service, or game mod. Optional detail must fail
  independently with a visible explanation.
- Preserve existing user data and the familiar interface. Same product and application identifier;
  restoring old storage readers is a release requirement, not an accomplished migration.

## Current data flow

```text
Installed game → Rust core → Tauri commands ───────────────┐
                         → generated browser-dev JSON ────┤
                                                         ↓
                                                React data/state
                                                         ↓
                                                Canvas MapEngine
                                                         ↓
                                            selection → React card
```

The browser preview cannot read the installation itself. It uses locally generated JSON; this is
not a deployed web service. A future server could supply the same typed data, but no server crate
exists today.

| Boundary | Implemented responsibility |
| --- | --- |
| `crates/core/` | Install discovery/validation; vector map, streets, annotations, zones, vehicle pools, RoomDefs, categories, static loot tables; bounded `pyramid.zip` satellite-tile reader (`satellite.rs`); isolated save-position reader. |
| `src-tauri/` | Thin desktop adapter. Heavy async commands use `spawn_blocking`: snapshot, room POIs, room loot, satellite info, satellite tile (raw PNG bytes over binary IPC; one cached archive handle). Another command validates an install path. Save data is not exposed here yet. |
| `web/src/data.ts` | Selects Tauri invocation or browser loading (generated JSON + the dev-only satellite tile middleware in `web/dev/satellite.ts`). Snapshot errors reach the UI; POI/loot failures currently only log warnings. |
| `web/src/engine/` | Disposable canvas renderer: prepared geometry, viewport culling, pan/zoom, optional satellite base layer (`satelliteLayer.ts`, visible tiles only, LRU cache), labels, filtered POI dots, hit-testing, selection marker, pointer coordinates. Camera state currently belongs to the engine. |
| `web/src/components/`, `store.ts` | React controls/cards and Zustand visibility/filter state. Not a complete port of the released app's personal-map tools. |
| `legacy/` | Preserved 0.1.x implementation, images, distribution notes, and storage contracts. Reference, not the active build. |

Rust types serialize with camelCase; matching frontend types are maintained manually in
`web/src/engine/types.ts`. Contract/fixture tests are needed when extending the boundary.

## Map sources and layers

Two map sources should remain distinct:

1. **Overview:** `worldmap.xml`, streets, annotations, and the shipped raster pyramid
   (`pyramid.zip`, the Satellite base layer).
2. **Room geometry:** `.lotheader` rectangles and signed Z levels. The core already retains these;
   the frontend currently receives only categorized room-center POIs, not room outlines.

The satellite view uses ready-made installed imagery; it does not generate a detailed map. A
high-res `.lotpack`/sprite decoder is **not planned** (owner: too much like cheating), nor is 3D or
isometric rendering. The purpose is quick approximate place-finding and navigation, not
world/inventory simulation.

All resolve to world X/Y; floor Z is a separate dimension. The observed vector-cell size is 300,
compiled-cell size 256, and compiled chunk size 8. Keep these conversions source-specific and
validate against the selected game build; see [map data](map-data.md).

The next room-geometry contract should include source identity, deterministic room ID, floor,
rectangles, and categories. Keep loot indexed by raw room name, rather than copying item arrays to
every room. Building associations require parsing/validating the header's building section;
bounding-box overlap alone must not be advertised as authoritative building membership.

The intended base/overlay composition, basement behavior, and raster calibration are specified in
[map views and navigation](map-views-navigation.md). The satellite base layer is implemented: the
vector map stays underneath as the fallback, and labels/POIs share one world transform over either
base. No floor selector yet; current POI drawing and clicking mix floors.

## Categories and loot

Room categories are multi-tag: a kitchen can be Food + Homes, a garage Tools + Homes.
There are no Retail or Civic category tags. Unknown names can remain unclassified.

Subcategory filters **hide unmatched dots**. Search **highlights and dims**: matches are drawn at
any zoom (even if filtered out) in their usual colours — "likely" ringed, "possible" as plain dots —
while everything else dims (`engine/search.ts` + `MapEngine.setHighlight`). Counts describe matching rooms, not unique
businesses. Homes-only rooms are currently omitted from the POI payload.

Static loot is inferred from installed Lua distributions. It is not live inventory. The current
approximate extractor merges by maximum raw weight and keeps every item per room type (the card
shows 24). Item search splits "likely" (top 50 in a room type) from "possible"; container/source
context is still not retained. Details and known classification gaps: [taxonomy](taxonomy.md).

## User state and upgrade contract

Keep `com.pzcompanion.map` and these released keys:

- `knox-atlas.custom-markers.v1`
- `knox-atlas.saved-paths.v1`
- `knox-atlas.saved-map-view.v1`
- `knox-atlas.game-install.v1`

The first three are read and written by `web/src/savedStorage.ts` with the released shapes, limits
and validation (unit-tested against 0.1.x-format data); `savedStore.ts` persists on every change.
Both apps use Tauri v2 with the same identifier and default scheme, so the WebView origin — and
therefore the storage — should match. The game-install key is not restored yet (folder picker
pending). The engine draws saved items but never touches storage. Do not delete or reset an
existing profile to make development work. Packaged upgrade testing must demonstrate
marker/path/view/install preservation. Browser development storage and packaged WebView storage
are not interchangeable; matching identifiers alone does not prove a migration.

Newer keys (not in 0.1.x, so they never disturb released data): `knox-atlas.your-map.v1` (Your map
groups + collapsed sections), `knox-atlas.saved-filters.v1` (saved search filters — stored as the
search key, re-matched against current data), `knox-atlas.view-options.v1` (View toggles) and
`knox-atlas.loot-filters.v1` (loot filter choices, stored as on + off so filters added later get
their default). Place/route/path records gain optional `group`/`hidden`/`stops` fields only when set.

New floor-aware records should accept legacy records without Z as general map annotations.
Add export/import and a documented backup path before calling the state truly transferable.

## Optional position data

The baseline does not depend on position data.

- **Manual location:** useful without interfacing with the game; still to be restored.
- **Last-saved position:** core reads SQLite player/vehicle coordinates, but the desktop does not
  expose them. The current `immutable=1` connection is not a copied snapshot and is unsuitable as
  a claimed safe reader of changing live databases. Fix and test consistency/error handling first.
- **Live own-player position (optional extra, deferred by the owner):** a small opt-in Lua mod (or an
  existing mod that writes X/Y/Z to a file) for the companion to watch. No mod-free source exists:
  multiplayer client caches hold no player data. The owner's log (2026-10-11) shows that joining a
  server replaces the client's mods with the server's list, so in MP the mod would need to be on the
  server's list. Zero-mod alternative: the built-in `ShowCoordinates` server option + manual entry.
- **Other players:** separate consent, server-policy, and multiplayer visibility concerns; deferred.

No arbitrary process-memory reads, minimap screen scraping, or pretending that map-camera
coordinates are player coordinates. Source/timestamp/staleness must travel with positions.

## Sharing (optional extra)

Embedded desktop sharing and a standalone headless server remain possible opt-in deployments, not
prerequisites for the default atlas. Do not add `crates/server`, authentication, or an admin UI until that
feature is selected. First design what data may be exposed, who can see positions, how consent
works, and how private install/save paths are removed from browser payloads.

## Decisions and status

| Decision | Status |
| --- | --- |
| Installed files are the source for the baseline atlas; game/save reads are isolated in Rust. | Implemented. |
| React shell + framework-independent canvas engine; thin Tauri adapter. | Implemented, parity incomplete. |
| Separate inferred loot from actual inventory. | Implemented concept; presentation needs refinement. |
| Preserve app identity, released keys, and saved items. | Places/paths/view keys restored (2026-10-11); install key + packaged upgrade test pending. |
| Satellite is an overview base-layer swap from the game's `pyramid.zip`. | Implemented; alignment checked by owner 2026-10-11. |
| No high-res `.lotpack` decoder ("too much like cheating"). | Decided 2026-10-11. |
| Optional floor outlines/filtering from existing room data; no textured renderer. | Planned (polish queue). |
| Road path plotting along the road network, from a chosen start — no live position required. | Planned; next after saved points/paths. |
| Own-player live position via an opt-in mod. | Optional extra; deferred. |
| Shared multiplayer map. | Optional extra; needs privacy design first. |
