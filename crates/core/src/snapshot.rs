//! Assembles the normalized `GameSnapshot` the app consumes. One entry point: `load_snapshot_from`.

use std::path::{Path, PathBuf};

use crate::annotations::parse_annotations;
use crate::error::{CoreError, Result};
use crate::install::{
    find_game_root, newest_save, read_key_value, steam_build_id, validated_game_root,
};
use crate::streets::parse_streets;
use crate::types::{Bounds, GameSnapshot, Point, SaveInfo, SnapshotCounts};
use crate::worldmap::parse_world_map;
use crate::zones::parse_pois;
use crate::{CHUNK_SIZE, COMPILED_CELL_SIZE};

/// Load and normalize the full snapshot. `selected_root` overrides Steam discovery when the user
/// picked an install folder; `None` auto-discovers.
pub fn load_snapshot_from(selected_root: Option<&Path>) -> Result<GameSnapshot> {
    let game_root = match selected_root {
        Some(path) => validated_game_root(path)?,
        None => find_game_root().ok_or(CoreError::InstallNotFound)?,
    };
    let map_root = game_root.join("media").join("maps").join("Muldraugh, KY");
    let mut bounds = Bounds::empty();
    let features = parse_world_map(&map_root.join("worldmap.xml"), &mut bounds)?;
    let streets = parse_streets(&map_root.join("streets.xml"), &mut bounds)?;
    let labels = parse_annotations(
        &map_root.join("worldmap-annotations.lua"),
        &game_root
            .join("media")
            .join("lua")
            .join("shared")
            .join("Translate")
            .join("EN")
            .join("MapLabel.json"),
        &mut bounds,
    )?;
    let pois = parse_pois(
        &map_root.join("objects.lua"),
        &game_root
            .join("media")
            .join("lua")
            .join("shared")
            .join("VehicleZoneDefinition.lua"),
        &mut bounds,
    )?;
    let map_info = read_key_value(&map_root.join("map.info"));
    let mut warnings = Vec::new();

    let user_root = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .map(|path| path.join("Zomboid").join("Saves"));
    let save = user_root
        .as_deref()
        .and_then(newest_save)
        .map(|(path, group)| {
            let settings = read_key_value(&path.join("InGameMap.ini"));
            let center = settings
                .get("WorldMap.CenterX")
                .and_then(|x| x.parse::<f32>().ok())
                .zip(
                    settings
                        .get("WorldMap.CenterY")
                        .and_then(|y| y.parse::<f32>().ok()),
                )
                .map(|(x, y)| Point { x, y });
            SaveInfo {
                name: path
                    .file_name()
                    .map(|name| name.to_string_lossy().into_owned())
                    .unwrap_or_else(|| "Latest save".into()),
                group,
                center,
                isometric: settings
                    .get("WorldMap.Isometric")
                    .is_some_and(|value| value.eq_ignore_ascii_case("true")),
            }
        });

    if save.is_none() {
        warnings.push("No local save was found; using the map's default starting view.".into());
    }
    let initial_center = save
        .as_ref()
        .and_then(|save| save.center)
        .unwrap_or_else(|| Point {
            x: map_info
                .get("zoomX")
                .and_then(|value| value.parse().ok())
                .unwrap_or((bounds.min_x + bounds.max_x) / 2.0),
            y: map_info
                .get("zoomY")
                .and_then(|value| value.parse().ok())
                .unwrap_or((bounds.min_y + bounds.max_y) / 2.0),
        });
    let counts = SnapshotCounts {
        buildings: features
            .iter()
            .filter(|feature| feature.kind == "building")
            .count(),
        streets: streets.len(),
        labels: labels.len(),
        businesses: pois.iter().filter(|poi| poi.kind == "business").count(),
        vehicle_zones: pois.iter().filter(|poi| poi.kind == "vehicle").count(),
        loot_zones: pois.iter().filter(|poi| poi.kind == "loot").count(),
    };

    Ok(GameSnapshot {
        game_title: map_info
            .get("title")
            .cloned()
            .unwrap_or_else(|| "Project Zomboid".into()),
        steam_build_id: steam_build_id(&game_root),
        install_path: game_root.to_string_lossy().into_owned(),
        map_directory: map_root.to_string_lossy().into_owned(),
        compiled_cell_size: COMPILED_CELL_SIZE,
        chunk_size: CHUNK_SIZE,
        bounds: bounds.finish(),
        initial_center,
        save,
        features,
        streets,
        labels,
        pois,
        counts,
        warnings,
    })
}
