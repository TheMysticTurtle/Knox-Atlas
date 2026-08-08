# Development guide

This is the quick-reference page for future work.

## Repository layout

```text
.
├── src/
│   ├── main.ts          # UI, map state, search, canvas renderer
│   └── styles.css       # Application visual system and responsive layout
├── src-tauri/
│   ├── src/lib.rs       # Discovery, parsers, DTOs, Tauri command
│   ├── src/main.rs      # Native entry point
│   ├── Cargo.toml
│   └── tauri.conf.json
├── docs/
│   ├── architecture.md
│   ├── map-data.md
│   ├── roadmap.md
│   ├── development.md
│   └── images/
└── CHANGELOG.md
```

## Common commands

From the repository root:

```powershell
npm install
npm run tauri dev
npm run build
```

Rust checks:

```powershell
cd src-tauri
cargo fmt --all -- --check
cargo test
```

Run the installed-game parser check specifically:

```powershell
cd src-tauri
cargo test reads_an_installed_game_when_available -- --nocapture
```

That test exits successfully when Project Zomboid is absent, so portable fixture tests are still needed for strong CI coverage.

## Branch and commit conventions

- `main` is the integration branch and should remain runnable.
- Use `feature/<short-name>` for new behavior.
- Use `fix/<short-name>` for focused corrections.
- Use `docs/<short-name>` for documentation-only work.
- Prefer small conventional commits: `feat(scope): …`, `fix(scope): …`, `docs: …`, `test(scope): …`, `chore: …`.
- Do not mix formatting churn or unrelated cleanup into feature commits.

Before merging:

```powershell
npm run build
cd src-tauri
cargo fmt --all -- --check
cargo test
git diff --check
```

## Adding a new game source

1. Record the source and coordinate assumptions in [map-data.md](map-data.md).
2. Parse and normalize it in `src-tauri/src/lib.rs`.
3. Return source-neutral data in `GameSnapshot`; do not leak parser-specific markup into the UI.
4. Add a small fixture test for the source shape.
5. Prepare/cull geometry once in TypeScript.
6. Use honest user-facing language if the source is probabilistic.

## Adding a filter

1. Add a typed filter key and default.
2. Add one filter definition with label, description, color, and count.
3. Decide whether it hides, highlights, or changes label density. Make the effect visually obvious.
4. Keep dense layers zoom-gated and viewport-culled.
5. Check it with the general business/building layers both on and off.

Parent layer switches own their child state: switching a parent changes every child, while changing a child updates the parent checkbox to checked, unchecked, or indeterminate. Keep the normalized IDs in `prepareSubfilters` aligned with the visibility predicates used by the canvas renderer.

## Maintainer notes

- `worldmap.xml` geometry is converted from vector-cell-local coordinates using a 300-unit cell origin.
- UI cell/chunk readouts use the compiled sizes reported by the current map metadata: 256 and 8.
- Never call the save's last map center a player position.
- `ZombiesType` and `ParkingStall` are probabilistic context, not live inventories or vehicles.
- Vehicle body groups and expected quality come from `VehicleZoneDefinition.lua`; never relabel them as a spawned model or actual condition.
- Multiplayer client `vehicles.db` may be empty because the server owns vehicle state. Key locations are not part of the parking-zone source.
- `Path2D` objects and bounds are built once in `prepareData`; avoid rebuilding them during pan/zoom.
- All canvas redraws should go through `queueRender`.
- Labels are screen-space text with simple collision boxes; avoid adding thousands of permanent DOM markers.
- Map POI pictograms are drawn directly on canvas; sidebar icons are small inline SVGs using the same stable category vocabulary.
- The local app currently reads English `MapLabel.json`. Localization is a future adapter concern.
- Keep game-owned and app-owned data physically separate.

## Visual baseline

The current working baseline is [knox-atlas-ui-baseline.png](images/knox-atlas-ui-baseline.png). Replace or add a new dated baseline only after a deliberate visual change, not for every small commit.

## Debug checklist

### Blank or missing map

1. Confirm the Steam install was discovered.
2. Confirm `media/maps/Muldraugh, KY/worldmap.xml` exists.
3. Run the installed-game parser test.
4. Check the Tauri dev console for the source-specific parser error.

### Geometry does not align with labels

1. Check `map.info` for changed sizing/fixed2x metadata.
2. Verify the vector XML cell-origin conversion independently from compiled cell readouts.
3. Compare one known annotation, street, object zone, and building in the same location.

### Dense or slow layer

1. Confirm viewport bounding-box culling is applied.
2. Add a sensible minimum zoom for that layer.
3. Reuse prepared paths/anchors.
4. Profile before adding caching, workers, or a database.
