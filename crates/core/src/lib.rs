//! Knox Atlas shared core.
//!
//! Reads the locally installed Project Zomboid game (and, later, a save) read-only and returns
//! normalized, serializable data for the desktop app and the share server. Parsers are ported from
//! the quarantined prototype (`legacy/src-tauri/src/lib.rs`) into focused modules during Phase S.
//!
//! Coordinate model — do NOT conflate these two cell grids (see `docs/map-data.md`):
//! - `worldmap.xml` vector cells are **300** tiles: `worldX = cellX * WORLD_MAP_CELL_SIZE + pointX`.
//! - `.lotheader` / compiled cells are **256** tiles: `worldX = cellX * COMPILED_CELL_SIZE + roomX`.

/// Vector `worldmap.xml` cell size, in world tiles.
pub const WORLD_MAP_CELL_SIZE: f32 = 300.0;
/// Compiled cell size (`.lotheader`/`.lotpack` + compiled-cell indexing), in world tiles.
pub const COMPILED_CELL_SIZE: u32 = 256;
/// Chunk size, in world tiles.
pub const CHUNK_SIZE: u32 = 8;

/// Crate version, surfaced as a smoke-test command by the desktop shell during scaffolding.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vector_and_compiled_cell_sizes_are_distinct() {
        // Guards the documented trap: the 300-tile vector grid must never be silently swapped for
        // the 256-tile compiled grid used by RoomDef coordinates.
        assert_eq!(WORLD_MAP_CELL_SIZE as u32, 300);
        assert_eq!(COMPILED_CELL_SIZE, 256);
        assert_ne!(WORLD_MAP_CELL_SIZE as u32, COMPILED_CELL_SIZE);
    }
}
