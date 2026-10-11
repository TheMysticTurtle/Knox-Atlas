//! Read-only access to the game's VERSION=1 terrain-image pyramid. No extraction or rendering.
//! Zoom directories are image resolutions, NOT building floors. Only constructed tile names are
//! accepted; callers cannot request arbitrary archive entries or filesystem paths.

use std::{collections::BTreeSet, fs::File, io::Read, path::Path};

use serde::Serialize;
use zip::ZipArchive;

use crate::{error::Result, Bounds, CoreError};

const MAX_TILE_BYTES: u64 = 1_048_576;
const TILE_SIZE: u32 = 256;
const SOURCE: &str = "pyramid.zip";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SatelliteInfo {
    pub bounds: Bounds,
    pub image_width: u32,
    pub image_height: u32,
    pub tile_size: u32,
    pub levels: Vec<u32>,
}

/// Keeps just the ZIP directory open; individual PNGs are decompressed on demand.
pub struct SatelliteSource {
    archive: ZipArchive<File>,
    info: SatelliteInfo,
}

impl SatelliteSource {
    /// `map_dir` is the installed map directory, chosen/validated by the desktop boundary.
    pub fn open(map_dir: &Path) -> Result<Self> {
        let file = File::open(map_dir.join(SOURCE)).map_err(|e| CoreError::io(SOURCE, e))?;
        let mut archive = ZipArchive::new(file).map_err(|e| invalid(e.to_string()))?;
        let text = read_entry(&mut archive, "pyramid.txt", 4096)?;
        let text = std::str::from_utf8(&text).map_err(|e| invalid(e.to_string()))?;
        let levels: BTreeSet<u32> = archive.file_names().filter_map(tile_level).collect();
        let info = parse_info(text, levels.into_iter().collect())?;
        // Check the declared layout against a real tile before advertising this source.
        let first = read_entry(&mut archive, "0/tile0x0.png", MAX_TILE_BYTES)?;
        validate_png(&first)?;
        Ok(Self { archive, info })
    }

    pub fn info(&self) -> &SatelliteInfo {
        &self.info
    }

    pub fn tile(&mut self, level: u32, x: u32, y: u32) -> Result<Vec<u8>> {
        if !self.info.levels.contains(&level) {
            return Err(invalid("Unsupported satellite zoom level"));
        }
        let span = TILE_SIZE * (1 << level);
        if x >= self.info.image_width.div_ceil(span) || y >= self.info.image_height.div_ceil(span) {
            return Err(invalid("Satellite tile is outside the image"));
        }
        let name = format!("{level}/tile{x}x{y}.png");
        let bytes = read_entry(&mut self.archive, &name, MAX_TILE_BYTES)?;
        validate_png(&bytes)?;
        Ok(bytes)
    }
}

fn invalid(reason: impl Into<String>) -> CoreError {
    CoreError::parse(SOURCE, reason)
}

fn tile_level(name: &str) -> Option<u32> {
    let (level, tile) = name.split_once('/')?;
    let level: u32 = level.parse().ok()?;
    let (x, y) = tile
        .strip_prefix("tile")?
        .strip_suffix(".png")?
        .split_once('x')?;
    x.parse::<u32>().ok()?;
    y.parse::<u32>().ok()?;
    (level <= 16).then_some(level)
}

fn read_entry(archive: &mut ZipArchive<File>, name: &str, limit: u64) -> Result<Vec<u8>> {
    let entry = archive.by_name(name).map_err(|e| invalid(e.to_string()))?;
    if entry.size() > limit {
        return Err(invalid(format!("{name} exceeds the supported size")));
    }
    let mut bytes = Vec::new();
    entry
        .take(limit + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| CoreError::io(name, e))?;
    if bytes.len() as u64 > limit {
        return Err(invalid("Satellite entry exceeds the supported size"));
    }
    Ok(bytes)
}

fn validate_png(bytes: &[u8]) -> Result<()> {
    if bytes.len() < 24 || &bytes[..8] != b"\x89PNG\r\n\x1a\n" || &bytes[12..16] != b"IHDR" {
        return Err(invalid("Satellite tile is not a PNG"));
    }
    let width = u32::from_be_bytes(bytes[16..20].try_into().unwrap());
    let height = u32::from_be_bytes(bytes[20..24].try_into().unwrap());
    if width != TILE_SIZE || height != TILE_SIZE {
        return Err(invalid(
            "Only 256-pixel satellite tiles are currently supported",
        ));
    }
    Ok(())
}

fn parse_info(text: &str, levels: Vec<u32>) -> Result<SatelliteInfo> {
    let value = |key: &str| text.lines().find_map(|line| line.trim().strip_prefix(key));
    if value("VERSION=") != Some("1") {
        return Err(invalid("Unsupported satellite metadata version"));
    }
    let numbers = |key| -> Result<Vec<f32>> {
        value(key)
            .ok_or_else(|| invalid(format!("Missing {key}")))?
            .split_whitespace()
            .map(|n| {
                n.parse::<f32>()
                    .map_err(|_| invalid("Invalid image bounds"))
            })
            .collect()
    };
    let bounds = numbers("bounds=")?;
    let size = numbers("imageSize=")?;
    if bounds.len() != 4
        || size.len() != 2
        || bounds.iter().chain(&size).any(|n| !n.is_finite())
        || bounds[2] <= bounds[0]
        || bounds[3] <= bounds[1]
        || size
            .iter()
            .any(|n| *n <= 0.0 || *n > 131_072.0 || n.fract() != 0.0)
        || levels.is_empty()
        || levels
            .iter()
            .enumerate()
            .any(|(i, level)| *level != i as u32)
        || levels.last().is_some_and(|level| *level > 16)
    {
        return Err(invalid("Invalid satellite dimensions or zoom levels"));
    }
    Ok(SatelliteInfo {
        bounds: Bounds {
            min_x: bounds[0],
            min_y: bounds[1],
            max_x: bounds[2],
            max_y: bounds[3],
        },
        image_width: size[0] as u32,
        image_height: size[1] as u32,
        tile_size: TILE_SIZE,
        levels,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_world_bounds_separately_from_pixel_dimensions() {
        let info = parse_info(
            "VERSION=1\nbounds=100 200 1100 2200\nimageSize=500 1000\n",
            vec![0, 1],
        )
        .unwrap();
        assert_eq!(info.bounds.min_x, 100.0);
        assert_eq!(info.bounds.max_y, 2200.0);
        assert_eq!(info.image_width, 500);
        assert_eq!(info.tile_size, 256);
    }

    #[test]
    fn rejects_invalid_metadata_and_entry_names() {
        for text in [
            "VERSION=2\nbounds=0 0 1 1\nimageSize=1 1",
            "VERSION=1\nbounds=NaN 0 1 1\nimageSize=1 1",
            "VERSION=1\nbounds=0 0 0 1\nimageSize=1 1",
            "VERSION=1\nbounds=0 0 1 1\nimageSize=0 1",
        ] {
            assert!(parse_info(text, vec![0]).is_err());
        }
        assert!(parse_info("VERSION=1\nbounds=0 0 1 1\nimageSize=1 1", vec![0, 2]).is_err());
        assert_eq!(tile_level("4/tile2x1.png"), Some(4));
        assert_eq!(tile_level("../tile2x1.png"), None);
        assert_eq!(tile_level("0/../../secret.png"), None);
        assert_eq!(tile_level("17/tile0x0.png"), None);
        assert!(validate_png(b"not an image").is_err());
    }

    #[test]
    fn reads_local_tiles_when_game_is_available() {
        let Some(root) = crate::install::find_game_root() else {
            return;
        };
        let map_dir = root.join("media/maps/Muldraugh, KY");
        if !map_dir.join(SOURCE).is_file() {
            return;
        }
        let mut source = SatelliteSource::open(&map_dir).unwrap();
        assert_eq!(source.info().levels, vec![0, 1, 2, 3, 4]);
        assert!(source.tile(4, 1, 1).unwrap().len() > 24);
        assert!(source.tile(4, 100, 0).is_err());
        assert!(source.tile(100, 0, 0).is_err());
    }
}
