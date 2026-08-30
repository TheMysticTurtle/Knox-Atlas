# Progress, worklog & backlog

Living working-notes doc so any session (or contributor) can pick up. Three sections: **Current
state**, **Backlog/TODO**, **Worklog** (dated audit trail — mirrors the commit history in prose:
what/issues/tested/found/fixed). Newest worklog entry on top.

---

## Current state — 2026-08-21

**Branch:** `feature/core-evolution` (replaces the abandoned `feature/business-loot-categories`).
**Phase:** S (scaffold + parity). Prototype quarantined; fresh docs written; spike done; **workspace
skeleton stands up and builds end-to-end** (core + Tauri desktop + React web); **Rust `core` parsers
ported + tested** (parity step 1). Next: port the canvas engine into `web/` + build the React shell,
then hit the parity gate.

> **▶ RESUME HERE:** On `feature/core-evolution`. **Data-first plan:** finish the Rust data engine
> (map full detail + save detail) before any UI.
> - ✅ Overview parsers ported + tested. ✅ **RoomDef reader** (`rooms.rs`) — full map detail, tested
>   against all 4,065 installed lotheaders.
> - ✅ **RoomDef categorizer** (`category.rs`) — multi-tag; 73% of real rooms categorized.
> - ✅ **Distributions loot** (`distributions.rs`) — expected loot per room type, install-only,
>   verified (police→guns, pharmacy→meds, bookstore→books). Ranking = honest raw weight; headline
>   presentation (group-by-container) deferred to UX phase.
> - **Default-map DATA engine is now essentially complete** (overview + RoomDefs + categories + loot).
> - ⏳ **NEXT: satellite** raster + base-map **renderer** (canvas engine → React shell). Owner owns UX flow.
> - Parked (future, maybe-dropped): save reader (positions ✅ built), live positions (server mod),
>   server sidecar, `.lotpack` detailed-map decoder (→ furniture search). Kept isolated / additive.
> - ✅ Code beauty pass done: typed `CoreError`, async `load_game_snapshot`, rustfmt + clippy(-D warnings) clean.

Design is fully agreed and captured in `architecture.md` / `roadmap.md` / `taxonomy.md`. The
`.lotheader` RoomDef format is validated (`lotheader-format.md`). Reference decoder:
`docs/reference/lot_enum.py`. Work is committed as milestones (owner asked for a clean audit trail).

---

## Backlog / TODO

### Phase S — scaffold + parity (current)
- [x] Root workspace `Cargo.toml` (members `crates/core`, `src-tauri`). Tauri v2 conventions verified vs official docs.
- [x] `crates/core`: coord constants (256 lotheader / 300 vector) + `version()` smoke + guard test. Types/parsers still to port.
- [x] `src-tauri` (kept default name, not `crates/desktop`, = Tauri CLI marker): Tauri v2 app, `core_version` command, id `com.pzcompanion.map` + prototype icons/capabilities preserved.
- [x] `web/`: React 19 + Vite 7 + TS scaffold; Zustand store; placeholder App (paper-map palette).
- [x] Port parsers from `legacy/src-tauri/src/lib.rs` → `core` modules (types, util, worldmap,
      streets, annotations, vehicles, zones, install, snapshot); re-expose typed `GameSnapshot` +
      `load_snapshot_from` + `validated_game_root`; wire the two Tauri commands. Verbatim logic (parity).
- [ ] Port canvas engine from `legacy/src/main.ts` as a framework-agnostic module (base + overlay,
      pan/zoom, culling, label collision, hit-testing).
- [ ] React shell around the engine: filter panel, search, selection card, saved markers/paths,
      measure; wire via the Zustand store (filters/view down, hit-test/selection up).
- [ ] Preserve ADR-006 storage keys (read existing markers/paths/view); migration only if design
      diverges (discuss if it would compromise design).
- [ ] Verify `tauri dev` launches a window rendering the app (integration; nail beforeDevCommand cwd).
- [ ] **Parity gate:** new app reproduces today's overview map (features/streets/labels/vehicle
      zones/markers/measure/storage); still builds/packages. Diff vs `legacy/`.

### Future phases (summary — detail in roadmap.md)
- [ ] **P0** RoomDef parser in `core`; multi-tag categories; Orientation→Map visibility; theme-zone
      opt-in layer; bigger text; finalize full 586-name → category mapping; accuracy pass.
- [ ] **P1** Satellite base-layer toggle (`worldmap.png`/`pyramid.zip`).
- [ ] **P2** Floor/Z-level selector from RoomDef floor+rects.
- [ ] **P3** Save reader (loot/vehicles/positions) + player-record spike + `vehicles.db` schema check.
- [ ] **P4** Share module: embedded Share + Linux-first headless server; admin visibility config;
      threat/privacy design doc first.

### Parking lot / open questions
- [ ] Get the friend's-base "auto repair" X/Y from owner → decode that cell, confirm actual RoomDefs
      (gun store vs auto vs police). Accuracy item raised in the very first request.
- [ ] Update `.github` CI workflows + root `README.md` once the new build produces artifacts (left
      describing the prototype intentionally for now).
- [ ] Reuse Nexus banner/social images (preserved in `legacy/docs/images/`) when refreshing the page.
- [ ] Confirm `crates/server` framework (axum assumed) at P4.

---

## Worklog

### 2026-08-21 — Filter panel (top-level categories) + engine filtering
- **Did:** `store.ts` (Zustand) — enabled-categories state (Homes off by default). `FilterPanel`
  (React) — Likely-loot section: category rows with colour swatch, label, live POI count, checkbox,
  All/None. `App` lifts data loading + computes per-category counts; `MapStage` takes props + syncs the
  engine with data and filter state. Engine `setEnabledCategories` → `drawPois` shows only enabled
  categories (and colours a dot by its first *enabled* category). Left-sidebar layout + styling.
  Engine auto-fits to the window until the user pans/zooms (fixes resize).
- **Tested:** `tsc --noEmit` clean. Verified live: panel renders with correct counts (Weapons 215,
  Medical 567, Food 9,698, …); filters wired to the engine.
- **Food question (owner):** stores vs houses is easy — room name tells us (grocery/restaurant =
  store; kitchen/diningroom = house). Sub-toggles (Food → Groceries / Restaurants / Home kitchens)
  are the **next step** and the real de-flood. Perishable/non-perishable needs item-script parsing →
  a click-a-room loot-detail feature later.
- **Next:** sub-toggles (Food split first) · click-a-dot → expected loot popup · labels · Map-visibility
  section (buildings/towns/streets/satellite).

### 2026-08-21 — Renderer stood up: base map + categorized POI dots (live)
- **Decision (owner):** Option A now (ship the intel map on the vector/raster base) → Option B
  (`.lotpack` textured floors) as the flagship sequel. Confirmed overlays are world-coordinate and
  reuse across every base layer (vector/raster/`.lotpack`) in the one engine, so A→B is additive.
- **Did:**
  - `web/`: framework-agnostic `MapEngine` (canvas) — base map (terrain/water/roads/rail/buildings,
    colour-coded), pan/zoom, viewport culling, retina. `data.ts` loads from Tauri (invoke) or static
    JSON (browser/dev). `MapStage` (React) + POI dot layer coloured by category with a zoom threshold.
  - `crates/core`: `poi.rs` — `MapPoi` + `load_room_pois` (categorized rooms, Homes-only excluded →
    13,149 POIs) + display-name prettifier. Tauri commands `load_room_pois`/`load_room_loot` (async).
  - `examples/dump_snapshot.rs` → writes `web/public/{snapshot,pois,loot}.json` for browser dev
    (gitignored; regenerate with the example).
- **Tested:** `tsc --noEmit` clean, `cargo build` clean. Verified live in a browser: base map + 13,149
  POI dots render on a town at world-accurate positions.
- **Observation:** Food (every house kitchen/dining) floods the dots — the case for the **filter
  panel** (next), which isolates categories so gun/book/pharmacy pop out. Then click-for-loot, labels,
  satellite toggle.
- **Note:** vite dev server left running on :1420 for preview.

### 2026-08-21 — Code beauty pass + B42-scene alignment check
- **B42 alignment research:** every B42 map tool reverse-engineers the same files we do
  (`.lotheader`/`worldmap.xml`/map objects — Unjammer's exporter, pzmap2dzi, CalvyPZ/PZmap); newest
  ones advertise our exact feature set ("All Floors & Basements, Loot Search, GPS Routing"). Our
  *structured* data (room→category→expected-loot as queryable data) is arguably ahead. One real
  difference: the community renders the *detailed* map (`.lotpack`+textures) offline into Deep-Zoom
  tiles (Leaflet slippy map); we chose lighter live vector + the game's own raster. Conscious
  tradeoff; the detailed look = the deferred `.lotpack` decoder (pzmap2dzi is the proven blueprint).
- **Beauty pass (best practice):**
  - Typed errors: new `crates/core/error.rs` → `CoreError` (thiserror) with variants InstallNotFound /
    InvalidInstall / Io{context,source} / Parse{file,reason}; migrated the whole core off
    stringly-typed `Result<_, String>`. Tauri commands flatten `CoreError` → user string at the boundary.
  - `load_game_snapshot` is now **async** (runs the heavy parse via `spawn_blocking`; WebView never blocks).
  - `cargo fmt` applied repo-wide; `cargo clippy --workspace --all-targets -D warnings` → clean;
    refreshed the `lib.rs` module doc to describe the real provider set (not "parity port").
- **Tested:** `cargo test --workspace` → 11/11. `cargo fmt --check` clean. clippy clean with -D warnings.

### 2026-08-21 — Distributions parser: expected loot per room type (crown jewel)
- **Did:** `crates/core/distributions.rs` — parses the game's loot tables (`ProceduralDistributions`,
  `SuburbsDistributions`, `Distributions`.lua) into `room type → ranked expected items`. Depth-based
  brace scanner (robust to the files' mixed tab/space indentation), items extracted from `items={"X",
  weight,…}` pairs + followed procedural `procList` refs. Install-only; powers the "click a room → see
  likely loot" feature (and the owner's roof-off room-boundary idea, which is fully doable with data
  we already have: room rects + floor + category + this).
- **Tested:** `cargo test -p knox-atlas-core` → 11/11. Data-correctness (not ranking) verified against
  the real game: policegunstorage → firearms, pharmacy → medicine, bookstore → books.
- **Ranking finding (honest):** a single flat ranking always misrepresents a room, because rooms
  genuinely mix container types (a police gun room really has a filing cabinet + evidence + gun
  locker). Tried weight×idf "distinctiveness": great for unique rooms (bookstore→books, bakery→dough)
  but it *buried* common-but-characteristic loot (pharmacy→sunglasses instead of meds; guns sank under
  police-specific gear). Reverted to honest raw-weight order + keep the full item list. **Headline
  presentation (group loot by container/source) is a UX-phase refinement — owner's wheelhouse.**
- **Future goal noted (owner):** searchable static furniture/decoration across the map → needs the
  deferred `.lotpack` decoder (furniture isn't in the light data); architecture confirmed to accept it
  as an additive module (the "tiles" detail-provider rung).

### 2026-08-21 — Re-prioritize to default-map data; RoomDef categorizer
- **Direction (owner):** focus on extracting *default-map* (install-only) data first → then satellite
  → save reading is a *future* goal and may be dropped (save formats break every update + mods; the
  isolated-provider design means we can park/drop it with zero impact on the map engine). Big untapped
  install source found: `Distributions.lua` × `ProceduralDistributions.lua` = **expected loot per room
  type** (gun store → guns/ammo), no save needed — the crown jewel, next up.
- **Did:** `crates/core/category.rs` — `Category` enum (Food/Alcohol/Weapons/Medical/Tools/Knowledge/
  Fishing/Electronics/Clothing/Fuel/Homes) + `categorize_room(name)` multi-tag classifier grounded in
  the real 586-name vocabulary. Careful edge handling (barn ≠ bar; house kitchen = Food + Homes;
  unknown/modded rooms → no category rather than a wrong guess).
- **Tested:** `cargo test -p knox-atlas-core` → 9/9 (incl. multi-tag + edge cases). Coverage over the
  real install: **66,331 / 90,827 rooms categorized (73%)** — Homes 61.6k, Food 9.7k, Tools 1.1k,
  Medical 567, Knowledge 565, Clothing 356, Alcohol 282, Weapons 215, Fuel 168, Electronics 86,
  Fishing 83. Uncategorized 27% are correctly-generic rooms (empty/office/lobby/elevator/storage).

### 2026-08-21 — Save reader: positions layer (players + vehicles)
- **Test data:** owner hosted a local server save `servertest` (Saves/Multiplayer/servertest) — a
  *hosted* save, so authoritative data is on this disk (unlike the thin remote-client caches):
  non-empty `players.db` (networkPlayers) + `vehicles.db` (5 vehicles) + `map/` loot chunks.
- **Did:** added `rusqlite` (bundled — no system SQLite dep) to core; `crates/core/save.rs` reads
  `players.db` (localPlayers = SP / networkPlayers = hosted) and `vehicles.db` read-only via an
  **immutable snapshot** (reads even if the game holds the file). Types `PlayerPosition` /
  `VehiclePosition` / `SaveDetail`; `load_save_detail(save_dir)` (source-agnostic) + `default_save_dir()`.
- **Tested:** `cargo test -p knox-atlas-core` → 8/8. New test read the real save: player
  "Rodney Remmington" (GeckoMage) @ (7342, 5982) z0 + 5 vehicles @ ~(6080–7414, 5398–6032) — matches
  the raw SQLite exactly. `cargo build` (workspace, incl. Tauri) → clean.
- **Layered plan (by difficulty):** ✅ positions → ⏳ vehicle/player `data` blobs (type/condition/keys,
  Java-serialized) → ⏳ container loot (`map/<x>/<y>` binary chunks). PZ generates world data lazily as
  chunks are seen; flushed to disk on autosave / quit-to-menu.

### 2026-08-21 — Data-first re-sequence + RoomDef reader in the engine
- **Decision (owner):** build the complete Rust data **engine** first — read the installed map with
  FULL detail (RoomDefs) + read a save with all detail extracted, best-practice — *then* the UI.
  Frontend parity port is deferred behind the data engine. Best-practice = tiered/separate providers
  (not one growing blob); typed-errors + async-command cleanup is a dedicated whole-`core` pass to run
  when wiring providers (kept consistent, not half-migrated).
- **Did:** Ported the validated `.lotheader` RoomDef decoder (was `docs/reference/lot_enum.py`) into
  Rust `crates/core/rooms.rs`: safe cursor-based parser (no panics on truncation), `RoomDef`/`RoomRect`
  types (absolute world coords via the 256-cell conversion), `parse_lot_header` + `load_rooms(map_dir)`.
  Exposed from the crate. This is a **separate provider** (not folded into `GameSnapshot`).
- **Tested:** `cargo test -p knox-atlas-core` → 7/7 pass; new
  `reads_lotheader_roomdefs_from_installed_game_when_available` parses ALL 4,065 installed lotheaders
  cleanly → 80k+ rooms, 400+ distinct names, contains gunstore/bookstore/grocery/pharmacy/fishingstorage
  with sane world coords. `cargo build` (workspace) → clean.
- **Save reader — BLOCKED on test data:** only local saves are thin multiplayer *client* caches
  (empty vehicles.db; server owns loot/vehicles/positions). Need a real save (single-player, or the
  owner's dedicated-server save dir) to build + verify "all detail". Awaiting owner's choice.

### 2026-08-21 — Phase S: Rust `core` parser port (parity step 1)
- **Did:** Ported the monolithic `legacy/src-tauri/src/lib.rs` into 9 focused `crates/core` modules
  (`types`, `util`, `worldmap`, `streets`, `annotations`, `vehicles`, `zones`, `install`, `snapshot`)
  — **verbatim logic**, only reorganized. Public API: `GameSnapshot` (+ nested types),
  `load_snapshot_from`, `validated_game_root`. Rewrote `src-tauri/src/lib.rs` to wire the two real
  commands (`load_game_snapshot`, `validate_game_install_path`), dropping the scaffold smoke command.
- **Tested:** `cargo test -p knox-atlas-core` → 6/6 pass, incl. `reads_an_installed_game_when_available`
  which parses the REAL installed game (asserts features > 1000, streets/labels non-empty, vehicle
  pools present with types + expected quality, no wreck/traffic pools). `cargo build -p knox-atlas`
  (Tauri crate) → compiles clean, no warnings.
- **Note:** carried a `TODO` in `zones.rs` — these `ZombiesType` "businesses" are actually zombie
  theme zones; P0 replaces them with `.lotheader` RoomDefs and demotes them to an opt-in layer.
- **Pause point (per handoff default):** stopping before the frontend so the owner can eyeball the
  data boundary (two commands + `GameSnapshot` shape) before step 2.

### 2026-08-19 — Phase S: workspace skeleton stands up & builds
- **Did:** Verified Tauri v2 workspace conventions vs official docs (src-tauri is the CLI marker;
  frontend can live in its own folder via `frontendDist`). Created the Cargo workspace: `crates/core`
  (coord constants + `version()` + guard test) and `src-tauri` (Tauri v2 app depending on core,
  `core_version` command, reusing the `com.pzcompanion.map` id + prototype icons/capabilities). Stood
  up `web/` (React 19 + Vite 7 + TS + Zustand store + placeholder App). Reconciled docs (desktop crate
  is `src-tauri`, not `crates/desktop`).
- **Tested (toolchain present: cargo 1.97, node 24, npm 11):**
  - `cargo test -p knox-atlas-core` → builds; 1/1 test passes (cell-size guard).
  - `web`: `npm install` (75 pkgs, 0 vulns) + `npm run build` (`tsc --noEmit` + `vite build`) → clean, dist emitted.
  - `cargo build -p knox-atlas` (Tauri v2 + plugins + core) → compiles clean in ~48s. tauri.conf.json
    + icons validated by tauri-codegen.
- **Not yet verified:** live `tauri dev` window (integration) — deferred to parity, once the ported
  engine renders something worth seeing; will nail beforeDevCommand cwd then.
- **Decision:** desktop crate kept as `src-tauri/` (Tauri CLI marker convention) over the planned
  `crates/desktop/` — avoids tooling friction. Docs updated to match.

### 2026-08-19 — Phase S groundwork: quarantine + fresh docs
- **Did:** Cut branch `feature/core-evolution`. `git mv` old `src/`, `src-tauri/`, `docs/`, build
  files → `legacy/` (history preserved). Wrote fresh `docs/` (architecture, roadmap, map-data,
  taxonomy, lotheader-format, progress) + `legacy/README.md` quarantine marker. Preserved reference
  decoder at `docs/reference/lot_enum.py`. Saved cross-session memory (repo location, evolution plan,
  lotheader format).
- **Tested/verified:** `git status` shows renames (R) not deletes — history intact. `.gitignore`
  confirmed to exclude `node_modules`/`dist`/`*.log`; only intended docs staged as new.
- **Notes:** Root left with old `.github` CI + `README` on purpose (update when new build exists).

### 2026-08-19 — RoomDef data spike (validated)
- **Did:** Reverse-engineered the `.lotheader` binary format from raw bytes; wrote a Python decoder
  (`docs/reference/lot_enum.py`); enumerated the full RoomDef vocabulary.
- **Issue found & fixed:** first model treated the post-rects field as a single padding int → **2,716
  misparses + 29 hard EOF errors**, detected via garbage room names in cells where that field was
  nonzero. Root cause: each room has a **second list — `nObjects` × 12-byte (type,x,y)** — after its
  rectangles. Consuming it correctly → **0 parse errors** across all 4,065 files.
- **Key finding:** lotheader cells are **256 tiles, not 300** (the exact `map-data.md` trap).
  Cross-validated: a `gunstore` RoomDef's 256-model coord lands *inside* (dist 0.0) a
  `RetailAndCommercial` worldmap footprint; 300 was 126 tiles off.
- **Result:** 90,827 rooms, 765 cells with rooms, 586 distinct room types. Every requested category
  present (gun/hunting/auto/grocery/pharmacy/bookstore/movierental/fishing/tools/…).

---

## Environment notes

- **Repo location (easy to lose):** `Documents/Claude/Projects/PalworldEditor/Project Zomboid
  Interactive Map` (misfiled under PalworldEditor). Public repo, Nexus Mods (~87 downloads), Tauri v2.
- Game install: `C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid` (Build 42).
- Python for spikes: `/c/Python314/python` (`python3` alias is the broken Windows Store stub).
- **Commit discipline (owner's ask):** commit milestones along the way; each message details WHY /
  WHAT / issues hit / what was tested / what was found / how it was fixed. Clean audit trail.

## Working agreement

Co-designed, fork-by-fork: options + tradeoffs + recommendation → owner decides. Best-practice first;
no corner-cutting justified by effort/size. Preserve look/feel + saved settings where it doesn't
compromise the design (discuss conflicts, never silently drop).
