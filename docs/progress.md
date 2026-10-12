# Progress and session handoff

Last updated **2026-10-11**, branch `feature/core-evolution`. The active package version is 0.2.0;
released 0.1.1 lives in the preserved prototype history.

**Start here next session.** [Roadmap](roadmap.md) owns product principles and task order;
[architecture](architecture.md) owns boundaries; [development](development.md) owns commands and
release blockers; [map views/navigation](map-views-navigation.md) owns imagery/floor/routing/position
behavior.

> **▶ RESUME HERE:** Navigate (saved routes, re-routes), Your map groups with eye toggles, and
> **🔍 Search with saved filters** are built, committed and pushed (`feature/core-evolution`).
> Settings (View toggles, loot filters) are remembered. **Next: ask the owner** — candidates:
> game-folder picker + a real packaged 0.1.1 → 0.2.0 upgrade test (release gate), or the polish
> queue (quick-finds, loot-card ordering, landmark names, floor outlines).
> Also: game-folder picker; desktop upgrade test against a real 0.1.1 profile; polish queue.
>
> Principles: **simple by default** (extras opt-in) and **helpful, not a cheat** (no high-res decoder;
> real save item locations on hold pending owner). Live coordinates deferred by the owner.

## Current implementation

| Area | Status |
| --- | --- |
| Core parsing | Install discovery; overview/streets/labels/zones/vehicle pools; RoomDefs; categories; approximate static loot; satellite `pyramid.zip` reader. |
| UI/engine | React + canvas overview, pan/zoom, room dots, expandable sub-filters, click-for-loot, label/view toggles, **satellite base layer**, zoom/fit buttons, X/Y jump, hover coordinate readout, Copy X/Y. |
| Selection | Any map click (saved place, room dot, or bare ground) opens a popup: Save place / Edit place, Copy X/Y, Measure from here; room dots add categories + likely loot. X/Y jump selects the point. Esc closes. |
| Your map | Saved places (name + 7 colours, rename/delete), measuring tool (undo/clear/save as path), saved paths, saved view = **Home** (toolbar Set Home / Home; map opens there). Toolbar buttons are labelled (Full, Home, Set Home, Nav). "YOUR MAP" list in the left panel, hidden when empty. |
| Room identity | Generic room type, center, categories, Z; no stable frontend room ID, rectangles, or verified building membership. |
| Filters | Hide nonmatching dots; first matching sub-bucket wins; home kitchens/Homes default off. Floors are mixed. |
| “Business names” | Annotation/landmark labels, not an individual business-name directory. |
| Search | 🔍 toolbar button → box to its right (stays open): results as you type (towns, streets, places, loot categories/groups, loot items). Towns/streets fly; the rest highlight (likely ringed; "All" adds possible as plain dots; rest dims). + Save → saved filters (eye, All on/off, persisted). Item colour = category of the places it's mostly found in. |
| Settings | View toggles and loot filter choices remembered between launches. Satellite status shown only on failure. |
| Personal-map parity | Places/paths/measure/saved view restored. Search, game-folder picker, and vehicle overlay not yet ported. |
| Storage | `savedStorage.ts` reads/writes the released keys and shapes with the released validation (unit-tested with 0.1.1-format data). Same Tauri v2 runtime + identifier → same WebView origin, so existing items should load; **not yet proven** with a real packaged upgrade. Browser dev storage is separate from the desktop app's. |
| Floors | Not implemented (polish queue). Satellite pyramid levels are zoom resolutions, not floors. |
| Navigate | 🧭 Nav toolbar button → panel: "+ Add route", then each map click appends a stop (Start, 1, 2…, End) and re-routes; stops editable (X/Y, 🎯 click a new spot — a saved place's marker names the stop), reorderable (↑↓), removable; **drag the line** to add a bend (unnumbered, snapped to the street; drag to move; double-click/right-click removes); drag stop pills too; one total distance; **Save route** (line + stops + bends) → Your map → Routes reopens it for editing (Save changes updates it). Routes follow `streets.xml` named-street centerlines (`engine/roadGraph.ts`: crossings split, ends snapped within 12 tiles incl. a street onto its own far stretch; A*). Unnamed side roads/trails not yet routable (Next #2). |
| Save detail | Isolated SQLite coordinate reader; no desktop command/UI. Live-read consistency unresolved. |
| Live player/server | Optional extras; not implemented. No mod-free live position exists (see map views doc). |
| Distribution | CI/release scripts still target old root npm and `src-tauri/target` layout. Not release-ready. |

Local generated preview sample: **15,405 POIs**, **502 loot room types**, 3,225 distinct items. Loot
lists are uncapped (were 60; 197 hit it); the card shows 24. Do not claim a complete item index,
room-wide probabilities, or actual inventory.

## Latest verification — 2026-10-11

| Check | Result |
| --- | --- |
| `cargo fmt --all -- --check` | Clean. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Clean. |
| `cargo test --workspace` | 14 passed (includes 3 satellite tests; installed-game tests ran against the local install). |
| `npx tsc --noEmit` (web) | Clean. |
| `npm --prefix web test` with `ATLAS_TEST_PYRAMID` set | 17 passed, 0 skipped (real `pyramid.zip` read; 11 saved-storage/geometry tests incl. 0.1.1-format data). |
| Owner UI check (saved places/paths/measure/view) | "It looks good" (browser dev build). |
| `vite build` (web) | Builds. |
| Dev server `/__atlas_satellite` | `/info` 200; tile 4/1/1 200 PNG; out-of-range tile 404. |
| Owner visual check | Satellite aligned: POIs on building footprints, street labels on roads (Fallas Lake). |
| Desktop `tauri dev` launch, installer/portable upgrade | **Not run.** Still required before release. |

Installed-data tests can silently skip when sources are absent; add synthetic fixtures before
treating CI coverage as sufficient.

## Living TODO

### Next (owner order)
- [x] Restore saved places/paths/measuring/saved view on the legacy storage keys (2026-10-11).
- [x] 🧭 Navigate: add-as-you-click stops, street-centerline routing, save as path (2026-10-11).
- [x] Saved routes (reopen/edit favourite routes from Your map) (2026-10-11).
- [x] ~~Routable roads from road shapes~~ — dropped by the owner (2026-10-11): routing on named streets is good enough.
- [x] Drag-to-reroute (unnumbered bends, snapped to streets, saved with routes) (2026-10-11).
- [x] Your map groups: one tier per section, show/hide per item/group/section, collapsible (2026-10-11).
- [x] Search: towns/streets, places, loot categories/groups, loot items; saved filters (2026-10-11).
- [ ] Game-folder picker (released-app parity).
- [ ] Polish: quick-finds, highlight-and-dim, loot ordering, landmark names, floor outlines.

### Release gate
- [ ] Correct frontend/workspace CI commands, cache paths, release outputs, and package notes.
- [ ] Verify Tauri hook working directory; confirm packaged assets exclude generated local JSON.
- [ ] Give POI/loot providers visible loading/failure/empty states (they only warn in console).
- [ ] Add header version/count/negative-Z fixtures and Lua/category/sub-bucket tests.
- [ ] Fix specificity gaps: `policegunstorage` falls under Gun stores; `bookstorage` under Other.
- [ ] Launch-test desktop; clean install, restart/persistence, real 0.1.1 profile upgrade.

### Optional extras (opt-in, later)
- [ ] Live own-player coordinates via a small companion mod (MP: needs to be on the server's list).
- [ ] Last-saved position from SP/hosted saves (reader exists; needs consistent reads + UI).
- [ ] Share/server view (privacy design first).
- [ ] Real save item locations — **on hold**, owner to confirm (may cross "not a cheat").

### Parked
- [ ] Container/source-aware loot index (lists are uncapped since 2026-10-11; source context isn't kept).
- [ ] Export/import for portable transfer of saved items.
- [ ] Owner's friend's-base auto-repair coordinates: inspect actual rooms when supplied.

## Worklog

Newest first. Older entries are history: their claims ("full item list," "immutable snapshot,"
"never hide," satellite depending on a detailed decoder, old check results) are superseded by later
entries and the current docs. The 2026-10-11 entry supersedes the 2026-10-10 "out of scope" framing.

### 2026-10-11 — 🔍 Search with saved filters; eye toggles; remembered settings

- **Owner design (several rounds):** search lives in the left toolbar and opens to the right; it stays
  open showing the current search; **+ Save** makes it a saved filter (and clears it from the box,
  so its eye takes over — owner hit this); **Saved ▾** has eyes plus All on / All off. Stacking
  searches as a separate bar was tried and rejected ("I don't like that bar just sitting there").
  No new colours: matches keep their category colours; an item's dot is the category of the places
  it's mostly found in. The 🔍 button is highlighted only while open. Flexible by design: searching
  a street flies there without touching saved filters, so you can find a buddy, Nav there, and
  still see loot to stop at on the way back.
- **Data:** the Rust loot reader no longer caps lists at 60 items (it silently hid items from ~200
  room types). loot.json 0.7 → 1.9 MB.
- **Relevance (owner-approved after testing):** uncapped, "hammer" matched 10,237 of 15,405 places
  (every kitchen/garage has some tiny chance). Rule: an item is **likely** in a room type when it's
  in that room's top 50 by weight (ties included), else **possible**; the game's generic `all` table
  (containers in any room) makes it possible anywhere. Hammer → 762 likely + 9,475 possible. With
  "All" on the map shows two tiers: likely ringed, possible as plain dots (owner's spec). Items that
  spawn nowhere else read "only in N places" and offer no All box (a greyed box read as a bug).
- **Code:** `engine/search.ts` (pure, tested: index over labels/streets/POIs/categories/sub-groups/loot;
  ranking exact → starts-with → word-start → contains, ties by place count; `matchTiers`),
  `MapEngine.setHighlight(Map<poi, likely|possible>)` (matches at any zoom, rest dimmed, hit-testable),
  `SearchBar` (box, results, current search, Save, Saved filters), saved filters in `savedStore`
  (`knox-atlas.saved-filters.v1`, stored by search key and re-matched against current data).
- **Also this round (owner asks):** Your map checkboxes → **eye** toggles (solid / faint / half for
  partly; shared `Eye` component); the satellite status box removed except on failure; **View toggles
  and loot filters remembered** between launches (`settingsStorage.ts`; filters stored as on + off so
  filters added later get their default).
- **Tested:** `tsc` clean; 58 web tests (search ×10 incl. real-map checks — index ~40 ms, query < 1 ms;
  settings ×5; saved filters; likely/possible tiers; "anywhere" items; category colours); Rust 14/14,
  clippy and fmt clean; vite build. Owner click-tested each round in the browser build.

### 2026-10-11 — Your map groups + show/hide; "re-routes" wording

- **Owner ask:** places (and routes) as a dropdown you can make groups in, with visibility per item or
  group, "so people can see just what they want to see". Owner chose **one tier** of groups ("if
  people really want multi tier they can ask for it").
- **Design:** sections Places / Routes / Paths, each with user groups (one tier). Items carry optional
  `group` / `hidden` fields (released app ignores them; records stay minimal — fields only when set).
  New key `knox-atlas.your-map.v1` holds the group list (id, name, section, collapsed) and collapsed
  sections. Visibility is stored per item; section/group checkboxes are derived tri-state bulk
  toggles (Google-Earth style). Hidden items stay listed (dimmed) but aren't drawn or clickable.
  Deleting a group keeps its items (ungrouped); items filed in a missing group show as ungrouped.
- **UI:** `YourMapSection` rewritten around a generic section/group/entry list (disclosure,
  tri-state checkbox, inline name field for create/rename, hover ✎/×). Group picker in every save
  form (Save place / Edit place, Save route, Save as path), shown once the section has groups.
- **Owner-reported bug & fix:** a saved route showed its dragged bends as stops ("5 stops"). Storage
  was right (bends tagged `via`, restored as draggable handles on reopen); the list counted every
  entry. Now: "2 stops · 1 re-route · 1,840 tiles".
- **Wording (owner):** "bends" isn't intuitive → on screen they're **re-routes**: "2 re-routes · Click
  and drag route to edit · Double-click a re-route to delete it". Code keeps `via`/bend.
- **Tested:** `tsc` clean; 43 web tests (new: group/hidden flags round-trip while legacy records gain
  neither; layout parsing keeps valid unique groups and drops junk; re-route wording); vite build.
  Owner: "it's all working great".

### 2026-10-11 — Drag-to-reroute; side-road routing dropped

- **Owner decisions:** drop routable side roads/backroads (the side streets and small dirt roads the
  owner used already route fine); add Google-Maps-style dragging; show one total distance (the
  "by road + off-road" split confused). Search next, as its own top-center button.
- **Design:** a bend is a `via` stop in the stop list between the numbered stops of the leg it
  shapes — routed through, never numbered or listed, saved with the route (≤ 35, separate from the
  25 numbered stops). Bend rules live in pure `engine/stops.ts` (labels skip bends; reordering drops
  bends between the swapped stops; removing drops bends left dangling). Bends snap onto the nearest
  street (`snapToRoad`) so a reroute never detours off-road.
- **Engine:** a press on a stop pill/bend drags it; a press on the route line adds a bend on the
  first move (a plain click still selects); otherwise pan. Double-click/right-click removes a bend.
  Move cursor over draggable route parts.
- **Owner-reported issue & fix:** pressing a route dot opened the "map point" popup. Presses on
  stops/bends are now grabs only. Hover hit-testing was made cheap at the same time: at most once per
  animation frame, per-leg world-bounds pre-filter, world-space distance (no per-point screen
  conversion).
- **Tested:** `tsc` clean; 40 web tests (new: bend rules ×5, bends round-trip through storage, bends
  alone aren't a route, road snapping); vite build. Owner dragged routes in the browser build.

### 2026-10-11 — Saved routes + 🎯 re-pick

- **Owner asks:** save routes so people can reopen favourites; then (after testing) replace the ★
  saved-place dropdown on each stop with a button to click a new spot ("crosshair").
- **Design:** a route is a regular saved path (released format, so 0.1.1 still reads/draws the line)
  plus an optional `stops` field (≤ 25; `LIMITS.routeStops`). Invalid stops degrade to a plain line.
  Reopening re-routes from the stops, so saved routes benefit from future routing upgrades. Your map
  lists **Routes** (🧭) separately from measured **Paths**; clicking a route opens it in Nav
  (`openRouteId`), where Save changes updates it in place; its saved copy is hidden while open.
- **🎯 re-pick:** `movingStop` in `mapUiStore`; the next map click relocates that stop (clicking a
  saved place's marker names the stop after it); Esc / 🎯 again cancels; crosshair cursor.
- **Tested:** `tsc` clean; 32 web tests (new: routes keep stops while plain/legacy paths load
  unchanged with no `stops` field; broken stops degrade to a line; released limits pinned
  separately from the new one); vite build. Owner click-tested Nav, saved routes and 🎯; drag isn't
  built yet (planned).

### 2026-10-11 — 🧭 Navigate: road routing through your stops

- **Owner design (iterated in two rounds):** a separate Nav button (not buttons on every popup). After
  testing v1 (A/B + ⌖ pick + insert-before-B), the owner asked for the natural order instead:
  **"+ Add route", then every map click appends the next stop** (Start, 1, 2…, End), with stops
  editable/reorderable/removable and Save as path. Toolbar buttons got labels: Full, Home, Set Home,
  Nav (saved view renamed "Home"). Owner chose to keep simple add-stop over click-on-line insert.
- **Data research:** `worldmap.xml` roads are filled areas chopped at cell borders (unroutable);
  `streets.xml` has 1,098 named centerlines. Exact vertex joins give 823 pieces; snapping ends within
  12 tiles gives 4 pieces with 99.5% of streets connected. Centerlines cover 97% primary / 90%
  secondary / 81% tertiary road shapes, 4% of trails.
- **Engine:** `engine/roadGraph.ts` (pure, tested): crossings split into junctions; street ends
  snapped onto the nearest street within 12 tiles; A* with a straight-line heuristic; off-road legs to
  the nearest street; multi-stop trips (`planTrip`), polyline for saving (`tripPolyline` +
  Douglas–Peucker `simplifyPath` to the 250-point path limit). Built lazily on first Nav use and
  cached per street list. Real data: 6,106 nodes / 6,969 edges in ~27 ms; a route in < 1 ms.
- **Bug found by the owner (screenshot) & fixed:** a route looped all the way round Scenic Grove
  Trailer Park instead of taking a 3-tile connector. Cause: Scenic Grove Road is ONE street that loops
  and ends 3 tiles from its own earlier stretch; the builder only snapped ends onto *other* streets.
  Fix: a street may join itself when the two stretches are ≥ 36 tiles apart along it (crossings
  too). Regression test reproduces it (490 → ~100 tiles); real trip now 237 tiles via Scenic Grove
  Road → Long Needle Road.
- **UI:** `NavigatePanel` (+ Add route / Done / + Add stops / Clear; stop rows with X/Y, ★ saved
  place, ↑ ↓, ×; distance by road + off-road, street sequence, Save as path), stop pills on the map
  (Start teal, End red, numbered between), solid blue route + dashed off-road legs, crosshair cursor
  while adding, Esc stops adding.
- **Tested:** `tsc` clean; 30 web tests (13 routing incl. the self-loop regression, multi-stop
  trips, unreachable legs, labels, simplification, and a real Muldraugh → West Point route: 4,220
  tiles via Dixie Highway (Route 31W)); vite build. Owner tested v1 in the browser; the redesign is
  verified by tests and awaits the owner's click-through.
- **Next decided:** saved routes → roads from road shapes (side roads in; footpaths out; backroads
  opt-in, off by default; cached per map fingerprint) → drag-to-reroute → search.

### 2026-10-11 — Saved places, paths, measuring and saved view restored

- **Owner direction:** clicking the map (anything) opens a popup with **Save point · Copy X/Y ·
  Measure from here**; navigation is a **separate toolbar button** with an A/B panel (next). "Your
  map" list lives in the left panel (owner didn't object to the recommendation).
- **Research first:** read the released implementation (`legacy/src/main.ts`): storage keys,
  record shapes, limits (100 places / 50 paths / 250 points / 40-char names), validation, and the
  marker/path drawing style. Confirmed legacy and new both use Tauri v2 with identifier
  `com.pzcompanion.map` and no custom scheme → same WebView origin, so the same keys load existing
  items. The owner's PC has a real 0.1.1 profile (`%LOCALAPPDATA%\com.pzcompanion.map`) for a later
  upgrade test (back it up first).
- **Design:** the engine reports clicks (`onClick(Selection)`: saved place → room POI → ground)
  and draws what it's given (`setAnnotations`, `setSelection`, `focus`, `get/setCamera`); React
  decides what a click means (`mapUiStore`: selection, measuring, fly-to requests). Saved data is in
  `savedStorage.ts` (pure, self-contained parse/serialize of the released format) + `savedStore.ts`
  (Zustand, persists on every change). Shared `geometry.ts`; toolbar extracted to `MapToolbar.tsx`.
- **UI:** `SelectionCard` (Save place / Edit place + Delete, Copy X/Y, Measure from here; a place
  saved on a store keeps the store's loot), `NameColorForm` (name + colour swatches), `MeasurePanel`
  (points, distance, Undo/Clear/Save as path/Done, Esc), `YourMapSection` (places + paths, fly-to,
  delete), toolbar ★ save view / ⌂ return. Map opens at the saved view. Released marker look.
- **Tested:** `tsc` clean; 17 web tests (11 new: released keys/limits, 0.1.1-format markers and
  paths, invalid/corrupt data, caps, view range, id/label format, palette parity, geometry); vite
  build. Owner clicked through it in the browser build: "it looks good".
- **Not yet proven:** a real packaged 0.1.1 → 0.2.0 upgrade (desktop run against the existing profile).

### 2026-10-11 — Satellite + coordinates reviewed, tidied, committed; direction reset

- **Context:** on 2026-10-10 another assistant (GPT/Codex) worked on branch
  `codex/satellite-coordinates`: satellite view, coordinate tools, and a doc audit, all left
  uncommitted. This session reviewed it in full before keeping it.
- **Review verdict:** net positive. Satellite is a self-contained layer (`satelliteLayer.ts`) plugged
  into the engine with one draw call; the Rust reader and dev middleware are bounded and validated
  (size limits, PNG header checks, constructed entry names only, localhost-only dev endpoint). Engine
  architecture unchanged (+~120 lines). The doc audit correctly flagged real parity/CI gaps.
- **Issues found & fixed:**
  - Dense multi-statement lines and mis-indented pointer handling → reformatted to house style
    (`satelliteLayer.ts`, `satelliteGeometry.ts`, `mapEngine.ts`, `MapStage.tsx`,
    `SelectionCard.tsx`, `CoordinateReadout.tsx`, `ViewSection.tsx`, `styles.css`,
    `web/dev/satellite.ts`). Duplicate `.selection-card` CSS override folded into the base rule.
  - **One unreadable tile disabled satellite for the whole session** → now just that tile is skipped
    (`broken` set); only a bad archive or metadata disables the layer.
  - **Behaviour (owner default):** clicking empty map clears the selection again instead of opening
    a "Map coordinates" card. Coordinates stay available via the hover readout, the X/Y jump (which
    marks + opens a card), and Copy X/Y. Engine callback simplified to
    `onSelect(Selection | null)`. Town labels always draw (kept from Codex).
  - Docs said satellite was "disabled" and fmt "failed" → corrected against the real state.
  - `legacy/package-lock.json` showed as modified with no content diff (line endings) → reverted to
    keep `legacy/` untouched.
- **Direction (owner, 2026-10-11):** the Codex docs had declared the decoder/server/save extras
  "outside current scope". Owner corrected this to **simple by default, deeper on demand**: extras are
  opt-in. After seeing the satellite, the owner then **dropped the high-res decoder** as "too much
  like cheating". The low-res imagery is the intended "cosmetic, somewhat functional" detail. Real
  save item locations are on hold pending owner confirmation. New order: saved points/paths → road
  path plotting without live position → polish. Live coordinates deferred.
- **Research:** the Overwolf "Project Zomboid Map" app uses a one-click bridge mod for live position
  (prior art). On this machine: MP client cache (`Saves/Multiplayer/<server>`) holds only game time,
  radio state, and map symbols, with no player data; `coop-console.txt` logs position only on join.
  The owner's `console.txt` shows the server's 13 mods loading on connect and the owner's personal
  Java mods not loading, so a local-only bridge would likely be dropped in MP. `ShowCoordinates` is a
  built-in server option.
- **Tested:** see "Latest verification — 2026-10-11" above (fmt/clippy/14 Rust tests/tsc/6 web tests
  incl. real archive/vite build/dev endpoints). Owner checked satellite alignment visually.
- **Docs:** roadmap rewritten around the principles; architecture, map views, map data, development,
  README, and CHANGELOG corrected with targeted edits.

### 2026-10-10 — Scope clarification: keep the atlas lightweight

- **Owner clarified:** use the game's supplied image view under existing labels/POIs/filters;
  help users find likely supplies/places and navigate quickly. No detailed 3D/rendering pipeline.
- **Evidence:** local `pyramid.zip`, forest pyramid, and spawn-selection pyramid are present.
  Map/minimap Lua terrain-image functions reference `pyramid.zip`; default map styling references
  the forest layer. Numbered image directories are zoom resolutions, not building floors.
- **Plan corrected:** V1 uses supplied image tiles and existing room-floor data; V2 improves the
  same atlas rather than decoding lotpack/sprites. Optional own-player tracking stays independent.
- **User feedback:** owner shared a Nexus comment dated 2026-10-06 praising usefulness and
  “Elegant in its simplicity!” Owner reports roughly 300–500 downloads across GitHub/Nexus;
  counts/overlap were not independently verified. Preserve simplicity and released saved data.
- **Changes:** README, architecture, roadmap, map-source notes, implementation brief, progress,
  and unreleased changelog aligned to this scope. No runtime or game-file changes.

### 2026-10-10 — Documentation accuracy and V1/V2 map direction (superseded scope)

- **Request:** reconcile documents with implemented code; plan usable map/image views, selected
  floors and underground levels, ground-context overlays, and possible own-player navigation.
- **Corrected:** README commands/links/release-versus-branch claims; architecture flow/status;
  roadmap's completed versus pending work; taxonomy semantics/garages; header port/version/count
  limits; loot truncation and SQLite live-read assumptions.
- **Added:** development/handoff guide and bounded map-view/navigation implementation brief.
  Preserved earlier worklog rather than silently rewriting its history.
- **Research:** inspected local overview PNG dimensions and ZIP metadata read-only. Official
  game APIs support investigating a small client-position export; external layered renderers
  support detailed-map feasibility, not an implementation/support claim for this app.
- **Direction:** V1 = restored practical tools + overview raster + room-outline floors; V2 =
  validated local detailed tiles/interiors. Optional own-player bridge need not wait for a server.
  Automatic road routes and multiplayer sharing are separate, deferred capabilities.
- **Verification:** latest audit results above; documentation links/diff checked after edits.
  No game files, user profile, runtime sources, workflows, or launchers changed.

### 2026-08-21 — Garage/shed categorization fix
- **Owner caught:** garages/sheds had no markers. They were filed Homes-only (garage) / uncategorized
  (shed), so excluded from POIs — but they hold real loot (tools, car parts, gardening).
- **Fix:** `category.rs` adds `garage`/`shed` to Tools (garages become Tools+Homes → surface as Tools
  POIs; sheds → Tools). `subcategories.ts` adds a **Garages & sheds** sub-bucket under Tools.
  Regenerated dev data: POIs 13,149 → **15,405**. Core tests 11/11, web tsc clean.

### 2026-08-21 — Labels + View section (towns / streets / buildings)
- **Did:** Engine renders town/area/water labels + street-name labels (rotated, along the longest
  segment, with collision avoidance) + business/landmark labels (at zoom). `ViewOptions` +
  `setView`; buildings layer can be toggled off. `viewStore` (Zustand) + `ViewSection` (React) — a
  **VIEW** section at the top of the panel: Buildings / Town & area names / Street names / Business
  names, plus a disabled **Satellite** toggle (arrives with the `.lotpack` decoder). Wired via MapStage.
- **Tested:** `tsc --noEmit` clean. Verified live: town/area labels render on the map; owner confirms
  street names look good.
- **Owner note:** stop burning tool calls driving the preview — owner tests locally.

### 2026-08-21 — Click-a-dot → expected loot (selection card)
- **Did:** Engine hit-tests the nearest visible POI on click (14px radius, respects the active sub
  filter + zoom threshold) → `onSelectPoi` callback. `SelectionCard` (React) shows the room's name,
  category chips, floor, expected loot (item names prettified `Base.CannedBeans`→`Canned Beans`, top
  24) + world coords. `App` loads the loot table; `MapStage` holds selection state + renders the card.
- **Tested:** `tsc --noEmit` clean. Verified the click→loot data path live: Gun store → 9mmClip /
  RifleCase / BulletVest / Whetstone; Book store → reference/textbooks/paperbacks; Pharmacy → (meds in
  the 24-item list). Pixel-perfect dot-click screenshot not captured (preview-pane scaling throws off
  blind zooms) — pipeline confirmed via JS.
- **Known:** pharmacy's top items are incidentals (raw-weight order) — the loot *presentation* ordering
  (group-by-container / distinctiveness) is still the deferred UX refinement.
- **Next (wrap-up):** labels · item search · View / Quick-finds / World-utilities sections; then the
  `.lotpack` decoder.

### 2026-08-21 — Loot sub-toggles (hierarchical filters) + decoder plan
- **Direction (owner):** wrap up the intel map into a working state, THEN build the local `.lotpack`
  decoder — a tool users run on-demand (behind a button) that renders satellite/floors/object-locations
  from THEIR install (mod-compatible, nothing huge to ship/maintain). Referencing the open-source
  decoders (pzmap2dzi, vanilla-map exporters). Effort isn't a concern; owner does direction, not code.
- **Did:** `engine/subcategories.ts` — per-category sub-buckets keyed by room-def name (Food →
  Groceries/Restaurants/Bakeries/Butchers/Home kitchens; Weapons → Gun stores/Hunting/Military/Police;
  etc.) + `poiSubIds`/`subBucketsFor`/`allSubIds`. `store.ts` reworked to `enabled: Set<"cat:sub">`
  (Home kitchens + Homes off by default). `FilterPanel` — expandable categories with indeterminate
  parent checkboxes + sub-toggle rows + live counts. Engine filters POIs by enabled sub-id (colours by
  first enabled sub's category). App computes per-sub counts.
- **Tested:** `tsc --noEmit` clean. Verified live: Food expands to Groceries 283 / Restaurants 802 /
  Bakeries 62 / Butchers 32 / Home kitchens (off); parent shows indeterminate; toggles drive the map.
- **Next (wrap-up):** item search ("chisel" → spawn locations) · labels · Map-visibility + Quick-finds
  + World-utilities sections · then the `.lotpack` decoder (objects first, textured render second).

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

## Environment and working notes

- Repository is under `Documents/Claude/Projects/PalworldEditor/Project Zomboid Interactive Map`;
  the enclosing PalworldEditor folder is historical, not a dependency.
- Local game root: `C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid`.
- Reference spike: `docs/reference/lot_enum.py`; active decoder: `crates/core/src/rooms.rs`.
- User-owned untracked `Launch Knox Atlas.bat` was present during the audit; preserve it.
- Active versions: core, desktop Cargo, frontend package, Tauri config all declare 0.2.0.
- Commit milestones with purpose, changed behavior, issues/findings, and checks. Do not infer
  authorization to push or publish from a documentation/review request.
- Keep decisions simple and evidence-backed. Ask about meaningful direction/permission changes,
  and do not bypass a rejected action.
