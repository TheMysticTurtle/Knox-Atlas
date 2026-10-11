# Development and session handoff

Updated 2026-10-11 for `feature/core-evolution`, package version 0.2.0.
Start with [progress](progress.md), then [roadmap](roadmap.md). Read [architecture](architecture.md)
and [map data](map-data.md) before extending a parser or coordinate contract.

## Layout and prerequisites

- Cargo workspace at root: `crates/core` + `src-tauri`; workspace output is root `target/`.
- Frontend package/lockfile: `web/package.json` + `web/package-lock.json`, not root.
- Rust stable; Node 22 or a compatible installed toolchain; Windows desktop builds additionally
  need the MSVC C++ build tools and WebView2.
- Browser development needs generated data from a local game installation. The shipped app reads
  through Tauri; a normal browser cannot directly read those game files.
- `legacy/` is reference material; its launch/build scripts target the old layout.

## Browser development — from repository root

```powershell
npm --prefix web ci
cargo run -p knox-atlas-core --example dump_snapshot
npm --prefix web run dev
```

Open `http://localhost:1420`. The example writes
`web/public/snapshot.json`, `pois.json`, and `loot.json` itself.
**Do not redirect stdout into snapshot.json**: stdout contains status messages, not the snapshot.

The Satellite view also works in browser development: a dev-only Vite middleware
(`web/dev/satellite.ts`) serves tiles from the `pyramid.zip` of the install recorded in
`snapshot.json`. It answers only localhost, same-origin GET requests for validated tile names, and
it is not part of a production build. The desktop app reads tiles through Rust instead.

Regenerate after source/parser changes; the browser otherwise shows old data. These files are
gitignored, contain game-derived data and local install/save metadata, and must not be casually
committed or published. Remove/exclude development fixtures from release frontend assets.

## Checks — from repository root

```powershell
cargo fmt --all -- --check
cargo test --locked --workspace
cargo clippy --locked --workspace --all-targets -- -D warnings
```

Frontend type check with the installed dependencies:

```powershell
Push-Location web
node node_modules/typescript/bin/tsc --noEmit
Pop-Location
```

Frontend unit tests (coordinates, satellite tile geometry, pyramid metadata):
`npm --prefix web test`. The real-archive test is skipped unless you point it at an installed
pyramid:

```powershell
$env:ATLAS_TEST_PYRAMID = "C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid/media/maps/Muldraugh, KY/pyramid.zip"
npm --prefix web test
```

Frontend bundle check: `npm --prefix web run build` (also runs type checking).
Core-only offline check when dependencies are cached:
`cargo test --locked --offline -p knox-atlas-core`.

Some installed-game/save tests return without exercising their assertions if the source is absent.
A green CI run therefore does not prove installed-data parsing. Add small synthetic fixtures for
binary bounds/Z, Lua extraction cases, category/sub-bucket mapping, and SQLite schemas, then keep
full local corpus checks as a separate recorded integration step.

Last audited results and failures are in [progress](progress.md); never carry a historical
“all clean” statement forward without rerunning the relevant checks.

## Desktop and packaging — verification still required

`src-tauri/tauri.conf.json` uses `frontendDist: ../web/dist` and hooks containing
`npm --prefix ../web`. The hook working directory must be verified/repaired for the chosen CLI
invocation before treating desktop launch/build instructions as reliable. A successful browser
preview or Rust compile is not a packaged-app test.

After that integration check, the workspace's normal Windows outputs should be beneath:

```text
target/release/knox-atlas.exe
target/release/bundle/nsis/
```

Confirm actual generated filenames rather than hard-coding a stale package location. Portable
notes currently live at `legacy/packaging/PORTABLE-NOTES.txt`; active packaging needs reviewed
current notes and a license file. Keep the executable and included support files together.

Current CI/release workflows still target the prototype:

- Root `npm ci` and `npm run check` are invalid for the current layout; use `web` and its actual
  scripts, plus `cache-dependency-path: web/package-lock.json`.
- Root Cargo workspace owns `target`; update Rust cache and installer/executable paths accordingly.
- Test with `cargo test --workspace`; testing only the desktop manifest does not run core
  dependency unit tests.
- Verify Tauri action project/hook paths and fail if expected installer/portable assets are missing.
- Update old release text/screenshots/storage claims to match the finished active app.
- Keep verification on push/PR. Release packaging remains manual `workflow_dispatch`, not triggered
  by documentation pushes.

Do not publish this branch as a feature-complete update until these gates and V1 upgrade tests pass.

## Existing user data

Retain `com.pzcompanion.map` and the four legacy storage keys listed in
[architecture](architecture.md). The active app has not restored the readers yet.

Packaged installer/portable user state previously lived in the account's
`%LOCALAPPDATA%\com.pzcompanion.map` profile, not beside the EXE. Browser/dev origins may be
separate. Back up the closed-app profile before migration testing; never delete it as a “fix.”
Test an actual 0.1.1 profile upgrade, not just a new marker in an empty development profile.

Historical user guides: [portable](../legacy/docs/portable.md),
[Vortex](../legacy/docs/vortex.md), [distribution](../legacy/docs/distribution.md).
They describe the released layout/behavior; review them before promoting them to active docs.
Official runtime download:
[Microsoft WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

## Session checklist

1. Read this file, progress, roadmap, and applicable repository instructions; inspect branch/status.
2. Preserve unrelated local edits and untracked launchers. Do not overwrite user-owned work.
3. Choose one bounded deliverable and its acceptance checks. Inspect real source contracts first.
4. Update Rust/TS payloads together; do not encode coordinates or game-version logic in UI panels.
5. Keep unsupported/missing/failed optional data distinguishable and visibly labeled.
6. Verify proportionally; record command, outcome, skipped source tests, and untested integration.
7. Update progress and relevant source/design notes. Roadmap owns task order; progress owns evidence.
8. Commit requested milestones with purpose and checks. Push/release or broaden permissions only
   when authorized. Respect a rejection rather than finding a workaround.

Useful local source: standard Steam game root
`C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid`.
Do not treat historical corpus counts or personal save contents as portable fixtures.
