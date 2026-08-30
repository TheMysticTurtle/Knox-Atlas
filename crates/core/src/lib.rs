//! Knox Atlas shared core.
//!
//! Reads the locally installed Project Zomboid game read-only (and, optionally, a save) and returns
//! normalized, serializable data for the desktop app and the share server. Everything is split into
//! focused, independently-callable providers so heavy or optional data never loads as one blob:
//! - **Installed map** (no save needed): [`load_snapshot_from`] (overview geometry/streets/labels/
//!   zones), [`load_rooms`] (`.lotheader` RoomDefs) + [`categorize_room`], and [`load_distributions`]
//!   (the game's own expected loot per room type).
//! - **Save** (isolated so it can never compromise the map engine): [`load_save_detail`].
//!
//! Errors are typed ([`CoreError`]). The core does not write to the game install or a save.
//!
//! Coordinate model — do NOT conflate these two cell grids (see `docs/map-data.md`):
//! - `worldmap.xml` vector cells are **300** tiles: `worldX = cellX * WORLD_MAP_CELL_SIZE + pointX`.
//! - `.lotheader` / compiled cells are **256** tiles: `worldX = cellX * COMPILED_CELL_SIZE + roomX`.

mod annotations;
mod category;
mod distributions;
mod error;
mod install;
mod rooms;
mod save;
mod snapshot;
mod streets;
mod types;
mod util;
mod vehicles;
mod worldmap;
mod zones;

pub use category::{categorize_room, Category};
pub use distributions::{load_distributions, LootItem, RoomLoot};
pub use error::CoreError;
pub use install::validated_game_root;
pub use rooms::{load_rooms, parse_lot_header, RoomDef, RoomRect};
pub use save::{default_save_dir, load_save_detail, PlayerPosition, SaveDetail, VehiclePosition};
pub use snapshot::load_snapshot_from;
pub use types::{
    Bounds, GameSnapshot, MapFeature, MapLabel, Poi, Point, SaveInfo, SnapshotCounts, Street,
};

/// Vector `worldmap.xml` cell size, in world tiles.
pub const WORLD_MAP_CELL_SIZE: f32 = 300.0;
/// Compiled cell size (`.lotheader`/`.lotpack` + compiled-cell indexing), in world tiles.
pub const COMPILED_CELL_SIZE: u32 = 256;
/// Chunk size, in world tiles.
pub const CHUNK_SIZE: u32 = 8;

/// Crate version, surfaced by the desktop shell for diagnostics.
pub fn version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;

    use crate::install::find_game_root;
    use crate::vehicles::is_drivable_vehicle_zone;
    use crate::worldmap::classify_feature;
    use crate::zones::{friendly_name, poi_category};
    use crate::{
        categorize_room, default_save_dir, load_distributions, load_rooms, load_save_detail,
        load_snapshot_from, Category, GameSnapshot, COMPILED_CELL_SIZE, WORLD_MAP_CELL_SIZE,
    };
    use std::collections::HashSet;

    fn load_snapshot() -> Result<GameSnapshot, crate::CoreError> {
        load_snapshot_from(None)
    }

    #[test]
    fn vector_and_compiled_cell_sizes_are_distinct() {
        // Guards the documented trap: the 300-tile vector grid must never be silently swapped for
        // the 256-tile compiled grid used by RoomDef coordinates.
        assert_eq!(WORLD_MAP_CELL_SIZE as u32, 300);
        assert_eq!(COMPILED_CELL_SIZE, 256);
        assert_ne!(WORLD_MAP_CELL_SIZE as u32, COMPILED_CELL_SIZE);
    }

    #[test]
    fn names_unspecified_buildings_instead_of_leaking_boolean_metadata() {
        let properties = HashMap::from([("building".to_string(), "yes".to_string())]);
        assert_eq!(
            classify_feature(&properties),
            Some(("building".to_string(), "Unclassified".to_string()))
        );
    }

    #[test]
    fn classifies_game_zones_into_honest_broad_categories() {
        assert_eq!(poi_category("Spiffo"), "food");
        assert_eq!(poi_category("Pharmacist"), "medical");
        assert_eq!(poi_category("ConstructionSite"), "tools");
        assert_eq!(poi_category("Police"), "security");
        assert_eq!(poi_category("Fossoil"), "fuel");
    }

    #[test]
    fn makes_internal_zone_names_readable() {
        assert_eq!(friendly_name("CarRepair"), "Auto repair");
        assert_eq!(friendly_name("PizzaWhirled"), "Pizza Whirled");
        assert_eq!(friendly_name("FancyHotel"), "Fancy Hotel");
    }

    #[test]
    fn excludes_obvious_wreck_and_traffic_vehicle_pools() {
        assert!(!is_drivable_vehicle_zone("burnt"));
        assert!(!is_drivable_vehicle_zone("rtrafficjamw"));
        assert!(!is_drivable_vehicle_zone("junkyard"));
        assert!(is_drivable_vehicle_zone(""));
        assert!(is_drivable_vehicle_zone("police"));
        assert!(is_drivable_vehicle_zone("sport"));
    }

    #[test]
    fn loads_expected_loot_per_room_type_when_available() {
        let Some(root) = find_game_root() else {
            return;
        };
        let loot = load_distributions(&root).expect("distribution tables should parse");
        assert!(
            loot.len() > 100,
            "expected many room types, got {}",
            loot.len()
        );

        // Data correctness: each room's complete loot set must contain its characteristic items
        // (whatever the display order). This is the game's own tables, so it is authoritative.
        let has_any = |room: &str, needles: &[&str]| {
            loot.get(room).is_some_and(|items| {
                items.iter().any(|i| {
                    let name = i.item.to_ascii_lowercase();
                    needles.iter().any(|needle| name.contains(needle))
                })
            })
        };
        assert!(
            has_any(
                "policegunstorage",
                &["pistol", "shotgun", "revolver", "rifle", "ammo"]
            ),
            "police gun storage should contain firearms"
        );
        assert!(
            has_any(
                "pharmacy",
                &[
                    "pills",
                    "antibiotic",
                    "bandage",
                    "disinfectant",
                    "painkiller"
                ]
            ),
            "pharmacy should contain medicine: {:?}",
            loot.get("pharmacy")
                .map(|v| v.iter().map(|i| &i.item).collect::<Vec<_>>())
        );
        assert!(
            has_any("bookstore", &["book", "paperback", "magazine"]),
            "bookstore should contain reading material"
        );
        for room in [
            "policegunstorage",
            "gunstore",
            "pharmacy",
            "bookstore",
            "bakery",
        ] {
            if let Some(items) = loot.get(room) {
                let top: Vec<&str> = items.iter().take(8).map(|i| i.item.as_str()).collect();
                eprintln!("{room} → {top:?}");
            }
        }
    }

    #[test]
    fn categorizes_room_definitions_multi_tag() {
        use Category::*;
        let cat = categorize_room;
        // Single, unambiguous mappings.
        assert_eq!(cat("gunstore"), vec![Weapons]);
        assert_eq!(cat("gunstorestorage"), vec![Weapons]);
        assert_eq!(cat("policegunstorage"), vec![Weapons]);
        assert_eq!(cat("bookstore"), vec![Knowledge]);
        assert_eq!(cat("pharmacy"), vec![Medical]);
        assert_eq!(cat("toolstore"), vec![Tools]);
        assert_eq!(cat("fishingstorage"), vec![Fishing]);
        assert_eq!(cat("electronicsstore"), vec![Electronics]);
        assert_eq!(cat("clothesstore"), vec![Clothing]);
        assert_eq!(cat("gasstore"), vec![Fuel]);
        assert_eq!(cat("bedroom"), vec![Homes]);
        assert_eq!(cat("grocery"), vec![Food]);

        // Multi-tag: a house kitchen is both a home and a food source.
        assert_eq!(cat("kitchen"), vec![Food, Homes]);
        // A restaurant kitchen is food but not a home.
        assert_eq!(cat("restaurantkitchen"), vec![Food]);
        // Alcohol venue…
        assert_eq!(cat("bar"), vec![Alcohol]);
        assert!(cat("liquorstore").contains(&Alcohol));
        // …but a barn is not a bar.
        assert!(!cat("barn").contains(&Alcohol));
        assert!(cat("barn").is_empty());
        // Unknown / modded rooms return nothing rather than a wrong guess.
        assert!(cat("totallymadeuproom").is_empty());
    }

    #[test]
    fn categorizer_covers_the_installed_room_vocabulary_when_available() {
        let Some(root) = find_game_root() else {
            return;
        };
        let map_dir = root.join("media").join("maps").join("Muldraugh, KY");
        let rooms = load_rooms(&map_dir).expect("rooms parse");

        let mut categorized = 0usize;
        let mut per_category: std::collections::HashMap<Category, usize> =
            std::collections::HashMap::new();
        let mut uncategorized_names: std::collections::HashMap<&str, usize> =
            std::collections::HashMap::new();
        for room in &rooms {
            let cats = categorize_room(&room.name);
            if cats.is_empty() {
                *uncategorized_names.entry(room.name.as_str()).or_default() += 1;
            } else {
                categorized += 1;
            }
            for category in cats {
                *per_category.entry(category).or_default() += 1;
            }
        }

        eprintln!("categorized {}/{} room instances", categorized, rooms.len());
        let mut by_count: Vec<_> = per_category.into_iter().collect();
        by_count.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
        for (category, n) in by_count {
            eprintln!("  {category:?}: {n}");
        }
        let mut top_uncat: Vec<_> = uncategorized_names.into_iter().collect();
        top_uncat.sort_by_key(|(_, n)| std::cmp::Reverse(*n));
        eprintln!("top uncategorized room types:");
        for (name, n) in top_uncat.into_iter().take(15) {
            eprintln!("  {name}: {n}");
        }

        assert!(
            categorized > 10_000,
            "categorizer should cover many rooms, got {categorized}"
        );
    }

    #[test]
    fn reads_lotheader_roomdefs_from_installed_game_when_available() {
        let Some(root) = find_game_root() else {
            return;
        };
        let map_dir = root.join("media").join("maps").join("Muldraugh, KY");
        let rooms = load_rooms(&map_dir).expect("all installed lotheaders should parse cleanly");

        // Corpus scale validated during the spike (~90,827 rooms, ~586 distinct names).
        assert!(
            rooms.len() > 80_000,
            "expected many rooms, got {}",
            rooms.len()
        );
        let names: HashSet<&str> = rooms.iter().map(|room| room.name.as_str()).collect();
        assert!(
            names.len() > 400,
            "expected a rich room vocabulary, got {}",
            names.len()
        );

        // The real building/room identity the prototype could not see is present…
        for expected in [
            "gunstore",
            "bookstore",
            "grocery",
            "pharmacy",
            "fishingstorage",
        ] {
            assert!(names.contains(expected), "missing room type: {expected}");
        }
        // …with sane world coordinates (256-cell conversion) on a known store.
        let gun = rooms
            .iter()
            .find(|room| room.name == "gunstore")
            .expect("a gunstore RoomDef");
        assert!(!gun.rects.is_empty());
        let bounds = gun.bounds();
        assert!(bounds.min_x >= 0.0 && bounds.min_y >= 0.0);
    }

    #[test]
    fn reads_positions_from_the_latest_save_when_available() {
        let Some(save_dir) = default_save_dir() else {
            return; // no local save to read
        };
        let detail = load_save_detail(&save_dir).expect("save positions should parse");

        // The reader is robust to thin client caches; when data is present it must be sane world coords.
        for player in &detail.players {
            assert!(player.x.is_finite() && player.y.is_finite());
        }
        for vehicle in &detail.vehicles {
            assert!(vehicle.x.is_finite() && vehicle.x > 0.0 && vehicle.y > 0.0);
        }
        eprintln!(
            "save {:?}: {} player(s), {} vehicle(s)",
            save_dir.file_name().unwrap_or_default(),
            detail.players.len(),
            detail.vehicles.len()
        );
        for player in &detail.players {
            eprintln!(
                "  player {} ({}) @ ({:.0}, {:.0}) z{}",
                player.name, player.username, player.x, player.y, player.z
            );
        }
        for vehicle in &detail.vehicles {
            eprintln!(
                "  vehicle #{} @ ({:.0}, {:.0})",
                vehicle.id, vehicle.x, vehicle.y
            );
        }
    }

    #[test]
    fn reads_an_installed_game_when_available() {
        if find_game_root().is_none() {
            return;
        }

        let snapshot = load_snapshot().expect("installed game data should parse");
        assert!(!snapshot.features.is_empty());
        assert!(!snapshot.streets.is_empty());
        assert!(!snapshot.labels.is_empty());
        assert!(snapshot.counts.buildings > 1_000);
        let vehicles: Vec<_> = snapshot
            .pois
            .iter()
            .filter(|poi| poi.kind == "vehicle")
            .collect();
        assert!(!vehicles.is_empty());
        assert!(vehicles.iter().all(|poi| !poi.vehicle_types.is_empty()));
        assert!(vehicles.iter().any(|poi| poi.expected_quality.is_some()));
        assert!(vehicles.iter().all(|poi| {
            let label = poi.label.to_ascii_lowercase();
            !label.contains("burnt")
                && !label.contains("traffic jam")
                && !label.contains("trafficjam")
                && !label.contains("junkyard")
        }));
    }
}
