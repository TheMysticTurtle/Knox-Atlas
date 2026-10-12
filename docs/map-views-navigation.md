# Lightweight map views, floors, and navigation

Updated 2026-10-11. Implementation brief; shipped parts are marked **(implemented)**.
Scope and order: [roadmap](roadmap.md). Source details: [map data](map-data.md).

## Goal and boundary

A local atlas for finding likely places and navigating to them quickly:
**supplied map images + extracted POIs/labels + filters + personal markers/paths.**

Map and “Satellite” are two flat base views beneath the same overlays. We do not generate a
detailed world, decode sprites/lotpack tiles, capture the game scene, or build a 3D renderer —
the game's low-res imagery is the intended detail ("helpful, not a cheat"; see the roadmap).
Static loot remains approximate; no exact inventory/drop-rate simulation is needed.

## Supplied image layers — verified locally

The installed map directory contains these ready-made image resources:

| Resource | Local evidence / purpose |
| --- | --- |
| `pyramid.zip` | `ISWorldMap.lua` and `ISMiniMap.lua` terrain-image functions select this pyramid. First image-base candidate. |
| `forest.pyramid.zip` | `ISMapDefinitions.lua` adds it as a forest overlay in the default map style. Optional if useful, not a prerequisite. |
| `spawnSelectImagePyramid.zip` | Spawn-selection image resource; inspect if it offers a preferable overview, not an extra floor dataset. |
| `worldmap.png` | Large standalone overview, 10234 × 8314. Not a reason to decode the entire image at every launch. |

`pyramid.zip` has directories 0–4 with 4,914 / 1,248 / 320 / 80 / 20 PNG tiles.
These are image resolutions for zooming, **not ground/upper/basement floors**.
Its metadata reports bounds/imageSize 19968 × 16128. Other supplied pyramids have different
bounds/image sizes; use their metadata and calibrate, do not assume one image-to-world transform.

Local game source references, under `media/lua/client/`:

- `ISUI/Maps/ISWorldMap.lua`: `showTerrainImage`.
- `ISUI/Maps/ISMiniMap.lua`: `showTerrainImage`.
- `ISUI/Maps/ISMapDefinitions.lua`: `initDefaultStyleV3`.
- `OptionScreens/MapSpawnSelect.lua`: `setImagePyramid`.

The terrain-image functions are guarded by `TERRAIN_IMAGE`; their presence establishes how these
resources are referenced, not that the option is enabled in every game build/UI.

## Small image-view implementation (implemented 2026-10-11)

1. Read metadata, tile dimensions, and zoom scaling from the selected install. — `satellite.rs`
   validates `pyramid.txt` (VERSION=1, bounds, image size, contiguous levels 0–16) and a real tile.
2. Check image/world alignment at a few distant known places and zooms. — Unit tests cover non-1:1
   and offset pyramids; the owner checked alignment visually (e.g. Fallas Lake: POIs on footprints,
   street labels on roads). The installed pyramid is 1 world tile per pixel at level 0.
3. Request visible tiles only; keep a modest bounded cache and drop obsolete work. — Up to 4
   concurrent requests; 128-tile LRU of decoded images; off-screen requests aborted.
4. Draw the same world-coordinate labels, filtered POIs, and saved items over either base.
5. Fall back to vector if imagery is missing/unsupported; keep the camera and annotations intact.
   — An unreadable archive disables the layer with a visible status; one bad tile is just skipped.

Normal map and Satellite should be a simple toggle. No mandatory extraction of a huge archive,
no generated whole-map assets, no server. Read approved tiles through the desktop boundary,
not unrestricted webview filesystem access. Browser preview fixtures remain local/unpublished.

## Floors — use the room data, not a new renderer

Optional selected-Z views use the RoomDefs already parsed from headers:

| Control | Behavior |
| --- | --- |
| Ground / Upper 1 / Basement 1 / … | Select available signed Z: 0 ground, positive above, negative below. |
| Selected level | Only that level's room outlines and POIs; no other-floor room interiors. |
| Level over ground | Keep the ground map/roads; overlay selected-level room areas where present. |

Expose room rectangles and a stable source identity in the typed room payload. Keep loot indexed
by raw room name, not duplicated per room. Do not drop unclassified rooms from a floor-plan dataset
merely because they are not useful loot dots.

Apply Z consistently to drawing, filters/counts, clicking, and cards. Ground imagery remains ground
imagery: it does not turn into a furnished basement or roof-free interior. The overlay is explicitly
**room outlines**, not exact walls, stairs, furniture, or a passability map.

Keep surrounding ground visible in context mode; selected-level areas occupy only their room
footprints. Selecting an entire building across floors would need verified building associations,
which are not parsed yet; that is not required to draw basic selected-Z room overlays.

Preserve legacy markers/paths without Z as general map annotations. Keep town labels and custom
markers readable above clutter. Test overlapping X/Y rooms on different Z, multi-rectangle rooms,
negative levels, missing level data, and preserved saved annotations.

Only show authored levels present in the source. “No room data here” does not mean “no basement
exists”; random/save-generated spaces are outside the baseline's evidence.

## Optional own-player marker (optional extra — deferred by the owner)

**Findings 2026-10-11:** there is no mod-free live source. Multiplayer client caches hold no player
data (only game time, radio state, and map symbols); logs record a position only when a player joins;
single-player/hosted `players.db` updates on autosave only. The owner's console log shows that on
joining a server the client loads **the server's mod list**, and the player's own mods did not load.
So a local-only bridge mod would likely need to be on the server's list in multiplayer.
`ShowCoordinates` is a built-in server option, not a mod; with it enabled, players can read their
X/Y in-game and type it into the atlas, which works with no mods at all.

The official API exposes a local actor through
[LuaManager.GlobalObject](https://projectzomboid.com/modding/zombie/Lua/LuaManager.GlobalObject.html),
coordinates through [IsoPlayer](https://projectzomboid.com/modding/zombie/characters/IsoPlayer.html),
and a file writer. This supports investigating a small opt-in client export, independent of any
server map. Target-build behavior and the allowed output path still need an in-game test.

Export only version/session/world/character identity, timestamp/sequence, and X/Y/Z at a modest
cadence (initial experiment about once per second). Handle partial reads, logout/world changes,
and stale updates. Do not expose other players/inventory or patch game files automatically.

Show Live / Stale / Last saved / Unavailable distinctly. Follow is optional; panning pauses it,
Recenter resumes it. Show the player's floor without forcing the inspected floor to change.
No bridge/no valid source must leave the atlas fully usable.

## Navigation and “might be here” hints

- Search/filter for a likely place, click to inspect coordinates/items, then mark it.
- Draw a path along visible roads and save it. Distances are tile-length segment totals.
- **🧭 Navigate (implemented 2026-10-11, owner design):** the Nav toolbar button opens a panel;
  "+ Add route", then each map click appends the next stop (Start, 1, 2…, End). Stops can be edited
  (X/Y or a saved place), reordered and removed. The atlas routes
  along the road network and draws the route with its distance and street sequence, savable as a
  path. It needs no live position. Data: `streets.xml` centerlines (the `worldmap.xml` roads are
  filled areas chopped at cell borders, unsuitable as a graph). Measured 2026-10-11: 1,098 streets
  form 823 pieces with exact joins, 15 at 6-tile snapping, and **4 at 12-tile snapping (largest =
  99.5% of streets)**. Centerlines lie within 15 tiles of 97% of primary, 90% of secondary, and 81%
  of tertiary road areas, but only **4% of dirt trails**, so routes follow named streets. Crossings
  are treated as junctions (a rare overpass could be wrong). Off-road ends get a short dashed
  connector to the nearest street; unreachable ends are reported honestly. A street may also join
  itself where it loops back (Scenic Grove Road ends 3 tiles from its own start).
- **Drag-to-reroute (implemented 2026-10-11):** drag the line to add a bend (snapped to the nearest
  street, unnumbered, saved with the route); drag stops/bends; double-click/right-click removes.
- **Dropped (owner, 2026-10-11) — roads from road shapes:** the 832 road shapes with no named street on them (482 trails,
  193 side roads/driveways, 146 secondary, 11 primary; ~80% curvy) will be skeletonized into
  centerlines and joined to the network. Width filter drops footpaths; dirt trails are opt-in
  ("Include backroads / shortcuts", off by default). Parking lots are essentially absent from road
  data (1 of 3,370 shapes is lot-sized).
- An optional player dot could later help someone follow that route.

Static room loot does not guarantee anything remains after players visit. Helpful approximate
location hints are the point; exact world simulation is not.
