# Knox Atlas — Architecture (Core Evolution)

Knox Atlas is a read-only **companion platform** for Project Zomboid: a desktop map that reads the
locally installed game (and, optionally, a save) and can publish a view-only web view for a whole
server to coordinate on. This document is the current design. It supersedes `legacy/docs/`.

## Guiding principles

1. **Best-practice, masterpiece-tier first.** Continuity (look/feel, saved settings) is pursued only
   where it does not compromise the design; conflicts are discussed, never silently resolved.
2. **Read-only, always.** Nothing is ever written to the game install or save directory.
3. **Honest inference (ADR-005, retained).** We show *likely* loot/positions and say so; filters
   *highlight*, they don't claim inventory truth.
4. **Evolution, not replacement.** Same repo, same Nexus identity, same Tauri identifier
   `com.pzcompanion.map`; existing users get an update.

## System shape (layers)

```
Rust `core`  ──reads──▶ typed data ──▶  Canvas engine  ──▶  React shell  ──▶  (optional) Server module
(game files,            (GameSnapshot,   (paints base map    (panels, filters,   (serves the same
 save, RoomDefs)         POIs, rooms)     + icons + labels)    state, cards)       React+engine to browsers)
```

- **Rust `core` (crates/core):** discovers the install, parses game-owned formats (vector map,
  streets, annotations, objects.lua zones, **RoomDefs from `.lotheader`**, and later the save),
  normalizes coordinates/names, returns plain serializable data. All game reads live here.
- **Canvas engine (web/, vanilla TS):** a custom canvas-2D renderer (ported from the prototype). Draws
  the **base layer** (vector map *or* satellite raster), then the **overlay** (POI icons, labels,
  user markers, measurement) — all pinned to world X/Y so they pan/zoom together. Handles pan/zoom,
  culling, label collision, hit-testing. Thousands of elements ⇒ canvas, not DOM.
- **React shell (web/, React + Vite + TS):** owns the UI chrome — filter panels, search, selection
  cards, saved-items, admin — and app **state**. React does *not* place map icons. It feeds the engine
  the active filters + view state (down) and receives hit-test/selection events (up) through a small
  shared store. Chosen for the user's proven Palbox stack + best AI/tooling support.
- **Server module (crates/server):** the share/serve logic, serving the **same React+engine bundle**.
  Two first-class deployments (see below).

## Data tiers (progressive detail — each optional, nothing gated)

1. **Baseline — everyone, no save required.** Map from installed game files **plus extracted RoomDef
   detail** (gun/book/video/bait shops, groceries, pharmacies, fishing…). The always-on default; a
   server player who isn't hosting still gets the full rich map.
2. **Enhanced — optional, point at any save dir.** Loot contents, vehicles, player positions.
   Single-player and server saves share the same on-disk structure, so the reader is save-agnostic;
   only a *remote client's* cache is thin (Tier 1 covers those players).
3. **Shared — optional, the sidecar.** Publish the view to others.

## Sidecar / share modes (one shared module, two first-class deployments)

1. **Embedded Share (desktop app).** For "I'll host on my own machine." A *Share* toggle spins up a
   small local HTTP/WS server + status window; others open a link (optional password) in a browser.
2. **Standalone headless server.** For 24/7 **dedicated servers** — the common case. A single
   self-contained binary the owner drops on the server box, pointed at the server's Zomboid save dir,
   run as a service. **Cross-platform, Linux-first.** No GUI.

**Easy admin visibility config is a hard requirement** (both): a simple config file and/or a small
admin page controls what players see (which loot tiers, positions on/off, per-view gates).

## Provider seams (small interfaces, added incrementally)

- **Detail provider:** overview vector → RoomDef → (later) save-level detail.
- **Live-position provider:** manual entry → save-poll (last-saved) → server feed (true live).

Reading arbitrary process memory is out of scope. Live per-second positions require the server feed.

## Repo structure

```
crates/
  core/     # shared Rust: coord model, types, parsers, RoomDef + save decoders (lib, unit-tested)
  server/   # (Phase P4) share module: view-only HTTP/WS, auth (link/pw), admin gates; embedded + standalone headless
src-tauri/  # Tauri v2 desktop app — the CLI marker crate; thin command layer over core; embeds server for Share
web/        # React + Vite + TS; the canvas engine lives here; builds to (a) Tauri webview (b) served bundle
legacy/     # quarantined prototype + its old docs (reference only)
docs/       # this design set
README.md, CHANGELOG.md, LICENSE, .github/
```
> Note: the Tauri desktop crate is `src-tauri/` (not `crates/desktop/`) because that folder name is
> the marker the Tauri CLI auto-detects; keeping the convention avoids tooling friction.

## Category model (multi-tag, non-exclusive)

A place (RoomDef-derived POI) carries a **set** of category tags, not one (a gun store = Weapons +
retail; police = Weapons + Civic). Filters **highlight & enlarge** matches and dim the rest — never
hide. Counts read as "places matching this filter," not a partition.

Two filter sections in the UI:
- **Map visibility** (base/navigation): custom markers, buildings by broad class, town & area names,
  street names, vehicle pools, satellite toggle, player locations.
- **Likely loot** (detailed multi-tag): Food & water, Alcohol, Weapons & ammo, Medical, Tools &
  materials, Skills & knowledge, Fishing & outdoors, Electronics, Clothing, Fuel & gas.

Clicking any dot reveals its *specific* room type. Full mapping: see `taxonomy.md`.

## Coordinate systems (critical — see map-data.md)

- `worldmap.xml` vector cells: **300** tiles. `worldX = cellX*300 + pointX`.
- `.lotheader`/`.lotpack` compiled cells: **256** tiles. `worldX = cellX*256 + roomX`. **Do not
  conflate these.** RoomDef coords use 256; this was cross-validated (see `lotheader-format.md`).

## Retained ADRs (from the prototype, still in force)

ADR-002 installed files are source of truth · ADR-005 visible inference · ADR-006 user state separate
(storage keys + `com.pzcompanion.map` identifier preserved with best-effort migration) · read-only
game boundary. New ADRs (RoomDef source, React shell, server module) are recorded in `roadmap.md`
decisions and here as they land.
