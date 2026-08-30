//! Map POIs derived from RoomDefs + categories — the "findable places" layer the map draws as dots.
//!
//! Loot is intentionally NOT embedded per POI (that would repeat big lists across ~10k points);
//! the frontend looks it up by `raw_name` in the separate room→loot table ([`crate::load_distributions`]).

use std::path::Path;

use serde::Serialize;

use crate::category::{Category, categorize_room};
use crate::error::Result;
use crate::rooms::load_rooms;

/// A findable place on the map: a categorized room at its centre, on a given floor.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapPoi {
    /// Friendly display name (e.g. `"Gun store"`).
    pub name: String,
    /// Raw RoomDef name (e.g. `"gunstore"`) — the key into the room→loot table.
    pub raw_name: String,
    pub categories: Vec<Category>,
    pub x: f32,
    pub y: f32,
    /// Floor / Z level (0 = ground).
    pub floor: i32,
}

/// Findable places: every categorized room as a POI at its centre. Pure-residential rooms
/// (`Homes`-only, e.g. bedrooms) and uncategorized rooms are omitted from the dot layer — they would
/// flood the map and are better served by a dedicated Homes toggle later. `game_root` is the
/// ProjectZomboid folder.
pub fn load_room_pois(game_root: &Path) -> Result<Vec<MapPoi>> {
    let map_dir = game_root.join("media").join("maps").join("Muldraugh, KY");
    let rooms = load_rooms(&map_dir)?;
    let mut pois = Vec::with_capacity(rooms.len() / 4);
    for room in rooms {
        let categories = categorize_room(&room.name);
        if categories.iter().all(|category| *category == Category::Homes) {
            continue; // skips empty (uncategorized) and Homes-only rooms
        }
        let bounds = room.bounds();
        pois.push(MapPoi {
            name: display_name(&room.name),
            x: (bounds.min_x + bounds.max_x) / 2.0,
            y: (bounds.min_y + bounds.max_y) / 2.0,
            floor: room.floor,
            raw_name: room.name,
            categories,
        });
    }
    Ok(pois)
}

/// Prettify a RoomDef name for display: split a trailing kind word off and capitalize.
/// `gunstore` → `Gun store`, `fishingstorage` → `Fishing storage`, `restaurantkitchen` → `Restaurant kitchen`.
fn display_name(raw: &str) -> String {
    const SUFFIXES: [&str; 8] = [
        "storage", "store", "kitchen", "office", "dining", "room", "hall", "shop",
    ];
    let spaced = SUFFIXES
        .iter()
        .find_map(|suffix| {
            let stem = raw.strip_suffix(suffix)?;
            (!stem.is_empty()).then(|| format!("{stem} {suffix}"))
        })
        .unwrap_or_else(|| raw.to_string());

    let mut chars = spaced.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    }
}
