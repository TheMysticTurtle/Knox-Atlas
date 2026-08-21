//! `.lotheader` RoomDef reader — the real building/room identity (gun/book/bait shops, groceries,
//! pharmacies, …) the prototype could not see. Format reverse-engineered + validated; see
//! `docs/lotheader-format.md`. This is the "full detail" of the installed map.
//!
//! Binary layout (little-endian):
//! ```text
//! "LOTH" | u32 version | u32 tileCount | tileCount × (tileName "\n")
//! | i32 w | i32 h | i32 u0 | i32 u1 | i32 nRooms
//! per room: name "\n" | i32 floor(Z) | i32 nRects | nRects × (i32 x,y,w,h)
//!                     | i32 nObjects | nObjects × (i32 type,x,y)
//! ```
//! Cell size is 256 (NOT the 300 used by `worldmap.xml`): `worldX = cellX*256 + roomX`.

use std::fs;
use std::path::Path;

use serde::Serialize;

use crate::COMPILED_CELL_SIZE;
use crate::types::Bounds;

/// A room rectangle in absolute world-tile coordinates.
#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomRect {
    pub x: i32,
    pub y: i32,
    pub w: i32,
    pub h: i32,
}

/// One RoomDef: a named room on a floor, with one or more world-space rectangles.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RoomDef {
    /// Raw room-definition name (e.g. `gunstore`, `bookstore`, `kitchen`). Categorized in P0.
    pub name: String,
    /// Floor / Z level (0 = ground).
    pub floor: i32,
    /// Source compiled-cell indices (`cellX_cellY.lotheader`).
    pub cell_x: i32,
    pub cell_y: i32,
    /// Room rectangles in absolute world tiles.
    pub rects: Vec<RoomRect>,
}

impl RoomDef {
    /// Bounding box over all of this room's rectangles, in world tiles.
    pub fn bounds(&self) -> Bounds {
        let mut bounds = Bounds::empty();
        for rect in &self.rects {
            bounds.include(crate::types::Point {
                x: rect.x as f32,
                y: rect.y as f32,
            });
            bounds.include(crate::types::Point {
                x: (rect.x + rect.w) as f32,
                y: (rect.y + rect.h) as f32,
            });
        }
        bounds.finish()
    }
}

struct Cursor<'a> {
    bytes: &'a [u8],
    offset: usize,
    file: &'a str,
}

impl<'a> Cursor<'a> {
    fn truncated(&self, what: &str) -> String {
        format!("{}: truncated while reading {what} at offset {}", self.file, self.offset)
    }

    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let slice = self
            .bytes
            .get(self.offset..self.offset + n)
            .ok_or_else(|| self.truncated("bytes"))?;
        self.offset += n;
        Ok(slice)
    }

    fn u32(&mut self) -> Result<u32, String> {
        Ok(u32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    fn i32(&mut self) -> Result<i32, String> {
        Ok(i32::from_le_bytes(self.take(4)?.try_into().unwrap()))
    }

    /// Read a `\n`-terminated string (as the tile/room tables store them).
    fn string(&mut self) -> Result<String, String> {
        let end = self.bytes[self.offset..]
            .iter()
            .position(|&byte| byte == b'\n')
            .map(|rel| self.offset + rel)
            .ok_or_else(|| self.truncated("string"))?;
        let text = String::from_utf8_lossy(&self.bytes[self.offset..end]).into_owned();
        self.offset = end + 1;
        Ok(text)
    }
}

/// Parse one `.lotheader`'s RoomDefs into absolute-world-coordinate rooms.
pub fn parse_lot_header(bytes: &[u8], cell_x: i32, cell_y: i32, file: &str) -> Result<Vec<RoomDef>, String> {
    let mut cursor = Cursor { bytes, offset: 0, file };
    if cursor.take(4)? != b"LOTH" {
        return Err(format!("{file}: not a LOTH lotheader"));
    }
    let _version = cursor.u32()?;
    let tile_count = cursor.u32()?;
    for _ in 0..tile_count {
        cursor.string()?; // tile-name table (not needed for rooms)
    }
    let _w = cursor.i32()?;
    let _h = cursor.i32()?;
    let _u0 = cursor.i32()?;
    let _u1 = cursor.i32()?;
    let room_count = cursor.i32()?.max(0) as usize;

    let cell_origin_x = cell_x * COMPILED_CELL_SIZE as i32;
    let cell_origin_y = cell_y * COMPILED_CELL_SIZE as i32;
    let mut rooms = Vec::with_capacity(room_count);
    for _ in 0..room_count {
        let name = cursor.string()?;
        let floor = cursor.i32()?;
        let rect_count = cursor.i32()?.max(0) as usize;
        let mut rects = Vec::with_capacity(rect_count);
        for _ in 0..rect_count {
            let x = cursor.i32()?;
            let y = cursor.i32()?;
            let w = cursor.i32()?;
            let h = cursor.i32()?;
            rects.push(RoomRect {
                x: cell_origin_x + x,
                y: cell_origin_y + y,
                w,
                h,
            });
        }
        // Room objects (doors/spawns) — count then skip; not needed for POIs, but MUST be consumed
        // or every following room misaligns (the bug caught during the spike).
        let object_count = cursor.i32()?.max(0) as usize;
        cursor.take(object_count * 12)?;
        rooms.push(RoomDef {
            name,
            floor,
            cell_x,
            cell_y,
            rects,
        });
    }
    Ok(rooms)
}

/// Parse the cell indices from a `cellX_cellY.lotheader` file name.
fn cell_from_name(name: &str) -> Option<(i32, i32)> {
    let stem = name.strip_suffix(".lotheader")?;
    let (x, y) = stem.split_once('_')?;
    Some((x.parse().ok()?, y.parse().ok()?))
}

/// Read every `.lotheader` under a map directory into RoomDefs (absolute world coordinates).
pub fn load_rooms(map_dir: &Path) -> Result<Vec<RoomDef>, String> {
    let entries = fs::read_dir(map_dir)
        .map_err(|error| format!("Could not read map directory for room data: {error}"))?;
    let mut rooms = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.ends_with(".lotheader") {
            continue;
        }
        let Some((cell_x, cell_y)) = cell_from_name(name) else {
            continue;
        };
        let bytes = fs::read(&path)
            .map_err(|error| format!("Could not read {name}: {error}"))?;
        rooms.extend(parse_lot_header(&bytes, cell_x, cell_y, name)?);
    }
    Ok(rooms)
}
