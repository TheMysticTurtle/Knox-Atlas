# Knox Atlas — living roadmap

Updated **2026-10-11** (owner-agreed order). Milestones here are feature goals, not version numbers:
the branch declares 0.2.0; the released prototype is 0.1.1. Choose a release number when its scope
and upgrade behavior are verified. Evidence and status: [progress](progress.md). Image/floor/position
behavior: [map views and navigation](map-views-navigation.md).

## Product principle — simple by default, deeper on demand

Knox Atlas helps someone find a likely shop or resource, see where it is, and get there quickly. A
Nexus user (2026-10-06) called it "elegant in its simplicity" and very useful — **that simplicity is a
feature to protect.**

- The **default** atlas stays uncluttered: map / satellite view, useful labels, find-a-place filters,
  likely-loot cards, personal markers and paths, and road path plotting.
- Heavier capabilities are **optional extras**: isolated modules, off by default, behind a clear
  opt-in (a toggle, setting, or "build" button). A user who never opts in never sees them, and the
  default never depends on them or slows down because of them.
- Test for every addition: *does this make the default screen busier?* If yes, it belongs behind an
  opt-in or needs an owner decision.

Likely loot stays a useful hint, not an inventory simulation. No game mod, save, or server is needed
for the default atlas.

**Helpful, not a cheat (owner, 2026-10-11).** The atlas should help players plan — where's the
nearest gun store, which road gets me there — without turning into "here's exactly where everything
is." The game's own low-res satellite imagery is the intended level of detail: a nice cosmetic view
that is somewhat functional, but doesn't spoil exploration. Features that reveal precise contents or
layouts the player hasn't discovered need an owner decision before they're planned.

## Done — the foundation

- [x] Rust core reads the installed map: vector overview, streets, labels, vehicle pools, RoomDefs
      (`.lotheader`), multi-tag room categories, and expected loot per room type.
- [x] React + canvas map: pan/zoom, categorized POI dots, expandable sub-filters, click-for-loot
      cards, town/street/business label toggles.
- [x] **Satellite view** from the game's own `pyramid.zip` (visible tiles only, bounded cache, vector
      fallback). Alignment checked visually by the owner (2026-10-11).
- [x] Coordinate tools: X/Y jump box, hover readout (tile / cell / chunk), copy X/Y on cards.
- [x] **Saved places, paths, measuring, saved view** — restored on the released storage keys and
      shapes (2026-10-11). Click anything → Save place · Copy X/Y · Measure from here. Saved view =
      "Home" (toolbar: Full · Home · Set Home · Nav).
- [x] **🧭 Navigate** (2026-10-11) — "+ Add route", click the map to add stops in order (Start, 1,
      2…, End); routed along named streets; edit/reorder/remove stops; save as a path.

## Next — in order

1. [x] **Saved routes** (2026-10-11). "Save route" keeps the stops with the saved path (an optional field the
       released app ignores, so old data is unaffected); routes show with 🧭 in Your map and reopen
       in Nav to edit, extend or re-save.
2. [ ] **Roads from the map's road shapes.** Turn `worldmap.xml` road shapes into centerlines
       (paint onto the tile grid, thin to a skeleton, join to the named streets) so real side roads —
       winding ones included — are routable. Strips narrower than a car are dropped (footpaths);
       dirt trails sit behind **"Include backroads / shortcuts", off by default**. Parking lots are
       not a concern: only 1 of 3,370 road shapes is lot-sized. Computed once per map version
       (fingerprint) and cached; works on modded maps with nothing to maintain.
3. [ ] **Drag-to-reroute.** Grab the route anywhere and drag, Google-Maps style: the route re-plans
       through an unnumbered via handle (double-click removes it); vias are saved with the route.
4. [ ] **Search** (owner request). One search bar for room types ("gun store"), category groups
       ("weapons"), specific items ("chisel"), and towns/streets ("Main St") → highlight every
       location whose loot table lists it, dim the rest. Likely-loot hints, not actual contents.
       Needs the loot index uncapped first; houses excluded by default ("also in N houses").
5. [ ] **Released-app parity leftovers:** game-folder picker; prove a real packaged 0.1.1 → 0.2.0
       profile upgrade keeps saved items (not just dev storage).
6. [ ] **Polish queue** (each must keep the default simple): quick-find place toggles (police, gun /
       book / video stores, groceries, gas, schools…); highlight-and-dim focus instead of hiding;
       loot cards ordered by what players actually want; landmark/business-name accuracy;
       optional floor (Z) room outlines from existing RoomDefs.

**Release gate** before publishing this branch as an update: repair CI / workspace / packaging
paths, launch-test the desktop app, and pass the packaged upgrade test above. See
[development](development.md).

## Optional extras — opt-in, off by default, built after the core

In owner priority order:

1. **Live own-player coordinates.** A tiny companion mod — or an existing mod that *writes* X/Y/Z to a
   file — that the app watches. Single-player: just works. Multiplayer: the game replaces a client's
   mods with the server's list on join (observed in the owner's log, 2026-10-11), so the mod would
   need to be on the server's list. Zero-mod alternative: servers can enable the built-in
   `ShowCoordinates` option and players type their X/Y. Not mod-free otherwise (verified: MP client
   caches hold no player data). Deferred by the owner for now.
2. **Last-saved position** from single-player / self-hosted saves (`players.db` reader exists in core;
   updates on autosave only).
3. **Real item locations from a save — on hold, owner to confirm.** Actual container contents from a
   save the user can read. Requested earlier, but it may cross the "helpful, not a cheat" line above
   (it's precisely "here's exactly where everything is"); revisit with the owner before planning.
4. **Share / server view.** Publish the map to friends (embedded share or headless server). Needs its
   own privacy/permissions design first.

## Not planned

- **High-res detailed map decoder** (`.lotpack` render). Dropped by the owner 2026-10-11: high-res
  maps are "too much like cheating." The game's low-res satellite imagery is the intended detail.
- 3D / isometric rendering.
- Reading game memory, screen-scraping the minimap, or patching game files.
- Simulating loot generation or drop probabilities.

## Historical phase crosswalk

Old worklog entries use phase names; this is how they map now:

| Old phase | Current interpretation |
| --- | --- |
| Spike | Header investigation completed against the recorded corpus. |
| S | Scaffold/overview done; released personal-map tools still to port (Next #1). |
| P0 | Room categories/static loot done; accuracy and presentation in the polish queue. |
| P1 | Satellite base layer — done, from the game's supplied imagery. |
| P2 | Optional floor room outlines from existing RoomDefs (polish queue). |
| P3 | Save positions reader exists (optional extra #2); real save loot on hold (extra #3). |
| P4 | Share/server — optional extra #4. |
| "Option B" `.lotpack` decoder | Not planned — owner: too much like cheating. |

## Working agreement

Co-designed fork-by-fork: options, tradeoffs and a recommendation, then the owner decides. Small
milestone commits explaining why, what, and the checks run. Discuss changes to direction or scope
before making them; never re-scope in the docs alone.
