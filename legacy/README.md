# legacy/ — quarantined prototype (reference only)

This folder holds the **original Knox Atlas prototype** (the `0.1.x` single-canvas Tauri app that
shipped on Nexus Mods) and **its original docs**. It is kept as a reference implementation during the
Core Evolution — **do not build on it, extend it, or treat its docs as current.**

Why it's here: the prototype's *shape* (one ~1,900-line `main.ts`, one ~1,075-line `lib.rs`, inline
DOM strings, desktop-only) was right for a read-only overview viewer but wrong for the platform Knox
Atlas is evolving into. We port the proven *knowledge* out of here into the new `crates/core` +
`web/` structure; we do not carry over the structure. See `/docs` (root) for the current design.

Contents (all frozen):
- `src/` — original TypeScript app (canvas engine + hand-rolled UI, intertwined).
- `src-tauri/` — original Rust adapter (all parsers inline in `lib.rs`).
- `docs/` — original architecture/roadmap/map-data notes. **Superseded** by root `/docs`.
- `index.html`, `package.json`, `vite.config.ts`, `tsconfig.json`, `packaging/`, launcher — old build.

What was proven and worth porting (now documented fresh in root `/docs`):
- Coordinate conversions, category colors mirrored from `ISMapDefinitions`, the XML/Lua parsers,
  `friendly_name`, vehicle-zone pooling, storage keys (ADR-006), Steam-install discovery.

Preserved in git history regardless of this folder.
