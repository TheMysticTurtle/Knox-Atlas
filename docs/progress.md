# Progress, worklog & backlog

Living working-notes doc so any session (or contributor) can pick up. Three sections: **Current
state**, **Backlog/TODO**, **Worklog** (dated audit trail — mirrors the commit history in prose:
what/issues/tested/found/fixed). Newest worklog entry on top.

---

## Current state — 2026-08-19

**Branch:** `feature/core-evolution` (replaces the abandoned `feature/business-loot-categories`).
**Phase:** S (scaffold + parity), just started. Prototype quarantined; fresh docs written; spike done.

Design is fully agreed and captured in `architecture.md` / `roadmap.md` / `taxonomy.md`. The
`.lotheader` RoomDef format is validated (`lotheader-format.md`). Reference decoder:
`docs/reference/lot_enum.py`. Work is committed as milestones (owner asked for a clean audit trail).

---

## Backlog / TODO

### Phase S — scaffold + parity (current)
- [ ] Root workspace `Cargo.toml` (verify current Tauri v2 workspace conventions vs official docs first).
- [ ] `crates/core`: coord model (256 lotheader / 300 vector), types (`GameSnapshot`, `Poi`, …).
- [ ] Port parsers from `legacy/src-tauri/src/lib.rs` → `core` modules: worldmap.xml, streets.xml,
      annotations+MapLabel, objects.lua zones, VehicleZoneDefinition, install discovery/validation,
      `friendly_name`, category colors mirrored from `ISMapDefinitions`.
- [ ] `crates/desktop`: Tauri v2 binary; thin command layer over `core`; preserve id
      `com.pzcompanion.map`.
- [ ] `web/`: React + Vite + TS scaffold; pick state approach (Zustand vs context) during scaffold.
- [ ] Port canvas engine from `legacy/src/main.ts` as a framework-agnostic module (base + overlay,
      pan/zoom, culling, label collision, hit-testing).
- [ ] React shell around the engine: filter panel, search, selection card, saved markers/paths,
      measure; small shared store (filters/view down, hit-test/selection up).
- [ ] Preserve ADR-006 storage keys (read existing markers/paths/view); migration only if design
      diverges (discuss if it would compromise design).
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
