# Knox Atlas — Roadmap

Phased, incremental. **Parity before features.** Each phase keeps the desktop app shippable to Nexus.

| Phase | Deliverable | Status |
|---|---|---|
| **Spike** | Reverse-engineer + validate `.lotheader` RoomDef format; confirm 256 cell size; enumerate vocabulary | ✅ done (see `lotheader-format.md`) |
| **S — Scaffold + parity** | Branch `feature/core-evolution`; quarantine prototype → `legacy/`; stand up Cargo workspace (`crates/core`, `crates/desktop`) + `web/` (React+Vite+TS + ported canvas engine); render **today's overview map at parity** (features, streets, labels, vehicle zones, markers, measure, storage; same identifier/keys). Gate: visual + behavioral parity, still builds/packages. | ▶ in progress |
| **P0 — Real categories** | RoomDef parser in `core`; multi-tag categories (gun/hunting/auto/grocery/food/alcohol/medical/books-video-knowledge/fishing/tools/electronics/clothing/fuel); rename Orientation→**Map visibility**; split zombie-theme zones into opt-in layer; **bigger text**; accuracy pass. | pending |
| **P1 — Satellite view** | Flat top-down "map vs satellite" toggle: engine paints shipped `worldmap.png` / `pyramid.zip` raster as the base layer (no `.lotpack` decode). | pending |
| **P2 — Floors/levels** | Z-level selector from RoomDef floor + rects (floor-plan room outlines; textures deferred). | pending |
| **P3 — Save detail** | Source-agnostic save reader: container loot, `vehicles.db`, **player position** (last-saved). Small player-record spike first. Read-only snapshot handling for live/mid-write chunks. | pending |
| **P4 — Share + dedicated server** | Two first-class deployments of the share module: embedded *Share* in desktop **and** standalone Linux-first headless server. View-only web app: link + optional password, easy admin visibility config, opt-in position sharing. Own threat/privacy design doc first. | pending |

**Out of scope:** textured isometric 3D rendering (`.lotpack` + texturepacks) — user prefers flat
map/satellite; largest effort for least navigational clarity.

## Key design decisions (log)

- **Fresh core, in-place evolution** of the existing repo (not a new repo); prototype quarantined to
  `legacy/`. Same Nexus identity + Tauri id `com.pzcompanion.map`.
- **One product**, not Lite/Plus. Only split = binaries from one shared core (desktop + optional
  headless server). Premium tier, if ever, gated within — no second product.
- **React + Vite + TS** shell; **custom canvas-2D** map engine (ported). Engine draws base + icons;
  React owns chrome + state; thin bridge between.
- **Satellite = base-layer swap** (raster vs vector); overlay/filters unchanged.
- **Multi-tag categories**; filters highlight/enlarge, never hide.
- **Bars → Alcohol**; home garages → Homes; Auto = mechanic/parts/dealership.
- **Player locations**: readable last-saved from a real save (SP/host/server-owner); true-live needs
  P4 server feed; remote client has none locally. Toggle greyed until pointed at a save.
- **RoomDef `.lotheader` (39 MB, 256-cell)** is the real business/loot source — not `objects.lua`
  ZombiesType zones (those are zombie theme zones, kept as a separate opt-in layer).

## Collaboration cadence

Co-designed. At each meaningful fork: options + tradeoffs + a recommendation → user decides. No large
unilateral moves. The living plan lives at the session plan file; decisions are folded back into these
docs as they're made.
