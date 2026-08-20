# Progress, worklog & backlog

Living working-notes doc so any session (or contributor) can pick up. Three sections: **Current
state**, **Backlog/TODO**, **Worklog** (dated audit trail — mirrors the commit history in prose:
what/issues/tested/found/fixed). Newest worklog entry on top.

---

## Current state — 2026-08-19

**Branch:** `feature/core-evolution` (replaces the abandoned `feature/business-loot-categories`).
**Phase:** S (scaffold + parity). Prototype quarantined; fresh docs written; spike done; **workspace
skeleton stands up and builds end-to-end** (core + Tauri desktop + React web). Next: port the parsers
into `core` and the canvas engine into `web/`, then hit the parity gate.

> **▶ RESUME HERE (next session):** Everything is committed; working tree clean; on
> `feature/core-evolution` (2 commits: `22db614` quarantine+docs+spike, `30959dd` skeleton). Next task
> is the **parity port** (Phase S backlog below):
> 1. Port Rust parsers `legacy/src-tauri/src/lib.rs` → `crates/core` modules; re-expose typed `GameSnapshot`.
> 2. Port the canvas engine `legacy/src/main.ts` → `web/`; build the React shell (filters/search/
>    selection/markers/measure) wired through the Zustand store.
> 3. Parity gate: new app renders today's map from real game files; launch `tauri dev` window; diff vs `legacy/`.
>
> **Open question to settle first (owner was asked, then went to bed):** roll straight through the whole
> parity port and checkpoint at parity, OR pause after step 1 (Rust `core`) so the owner can eyeball the
> data boundary before the frontend? Default if unspecified: pause after step 1 for a look.

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
- [ ] Port parsers from `legacy/src-tauri/src/lib.rs` → `core` modules: worldmap.xml, streets.xml,
      annotations+MapLabel, objects.lua zones, VehicleZoneDefinition, install discovery/validation,
      `friendly_name`, category colors mirrored from `ISMapDefinitions`. Re-expose typed `GameSnapshot`.
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
