//! `objects.lua` — ZombiesType (business/theme zones), ParkingStall (vehicles), LootZone, WaterZone.
//!
//! NOTE (future work): `ZombiesType` zones are zombie population/outfit/loot-theme zones, not a true
//! business directory. Phase P0 replaces this as the "business/loot" source with `.lotheader`
//! RoomDefs and demotes these to a separate opt-in "zombie theme zones" layer. Ported as-is for parity.

use std::collections::HashSet;
use std::fs;
use std::path::Path;

use regex::Regex;

use crate::types::{Bounds, Point, Poi};
use crate::vehicles::{is_drivable_vehicle_zone, parse_vehicle_zone_definitions, vehicle_types};

pub(crate) fn friendly_name(value: &str) -> String {
    match value.trim() {
        "" => "Unspecified".into(),
        "CarRepair" => "Auto repair".into(),
        "VariousFoodMarket" => "Food market".into(),
        "ConstructionSite" => "Construction site".into(),
        "FireDept" => "Fire department".into(),
        "FarmingStore" => "Farm supply".into(),
        "Pharmacist" => "Pharmacy".into(),
        "Dinner" => "Diner".into(),
        "FancyRestaurant" => "Fine dining".into(),
        "PileOCrepe" => "Pile O' Crepe".into(),
        "PizzaWhirled" => "Pizza Whirled".into(),
        "Gas2Go" => "Gas 2 Go".into(),
        "ThunderGas" => "Thunder Gas".into(),
        "Fossoil" => "Fossoil".into(),
        "Spiffo" => "Spiffo's".into(),
        "Gigamart" => "GigaMart".into(),
        "McCoys" => "McCoy's Logging".into(),
        "Seahorse" | "SeaHorses" => "Sea Horse Coffee".into(),
        other => {
            let mut result = String::new();
            let mut previous_lowercase = false;
            for character in other.chars() {
                if character.is_uppercase() && previous_lowercase {
                    result.push(' ');
                }
                result.push(character);
                previous_lowercase = character.is_lowercase();
            }
            result
        }
    }
}

pub(crate) fn poi_category(value: &str) -> &'static str {
    let value = value.trim().to_ascii_lowercase();
    if [
        "restaurant",
        "dinner",
        "variousfoodmarket",
        "spiffo",
        "pizzawhirled",
        "coffeeshop",
        "coffeshop",
        "gigamart",
        "pileocrepe",
        "cafe",
        "butcher",
        "fancyrestaurant",
        "seahorse",
        "seahorses",
    ]
    .iter()
    .any(|name| value.contains(name))
    {
        "food"
    } else if ["doctor", "pharmacist", "nursinghome", "hospital", "ambulance"]
        .iter()
        .any(|name| value.contains(name))
    {
        "medical"
    } else if [
        "constructionsite",
        "factory",
        "farmingstore",
        "farm",
        "mccoy",
        "carpenter",
        "firedept",
    ]
    .iter()
    .any(|name| value.contains(name))
    {
        "tools"
    } else if [
        "police",
        "army",
        "prison",
        "secretlab",
        "secretbase",
        "survivalist",
    ]
    .iter()
    .any(|name| value.contains(name))
    {
        "security"
    } else if ["gas2go", "fossoil", "thundergas"]
        .iter()
        .any(|name| value.contains(name))
    {
        "fuel"
    } else if value.contains("water") {
        "water"
    } else {
        "business"
    }
}

pub(crate) fn parse_pois(
    path: &Path,
    vehicle_definitions_path: &Path,
    bounds: &mut Bounds,
) -> Result<Vec<Poi>, String> {
    let source =
        fs::read_to_string(path).map_err(|error| format!("Could not read game zones: {error}"))?;
    let pattern = Regex::new(
        r#"\{\s*name\s*=\s*\"([^\"]*)\",\s*type\s*=\s*\"([^\"]*)\",\s*x\s*=\s*(-?\d+),\s*y\s*=\s*(-?\d+),\s*z\s*=\s*(-?\d+),\s*width\s*=\s*(\d+),\s*height\s*=\s*(\d+)"#,
    )
    .expect("valid zone expression");
    let mut pois = Vec::new();
    let mut seen_businesses = HashSet::new();
    let vehicle_definitions = parse_vehicle_zone_definitions(vehicle_definitions_path);
    let default_vehicle_spec = vehicle_definitions
        .get("parkingstall")
        .cloned()
        .unwrap_or_default();

    for capture in pattern.captures_iter(&source) {
        let name = capture.get(1).map(|value| value.as_str()).unwrap_or("");
        let zone_type = capture.get(2).map(|value| value.as_str()).unwrap_or("");
        let x: f32 = capture
            .get(3)
            .and_then(|v| v.as_str().parse().ok())
            .unwrap_or(0.0);
        let y: f32 = capture
            .get(4)
            .and_then(|v| v.as_str().parse().ok())
            .unwrap_or(0.0);
        let z: i32 = capture
            .get(5)
            .and_then(|v| v.as_str().parse().ok())
            .unwrap_or(0);
        let width: f32 = capture
            .get(6)
            .and_then(|v| v.as_str().parse().ok())
            .unwrap_or(0.0);
        let height: f32 = capture
            .get(7)
            .and_then(|v| v.as_str().parse().ok())
            .unwrap_or(0.0);
        let center = Point {
            x: x + width / 2.0,
            y: y + height / 2.0,
        };

        let (kind, category, label, details, vehicle_types, expected_quality, part_damage_chance) = match zone_type {
            "ZombiesType" if !name.trim().is_empty() => {
                let dedupe_key = format!(
                    "{}:{}:{}:{}",
                    name.trim().to_ascii_lowercase(),
                    (center.x / 12.0).round(),
                    (center.y / 12.0).round(),
                    z
                );
                if !seen_businesses.insert(dedupe_key) {
                    continue;
                }
                let category = poi_category(name);
                (
                    "business",
                    category,
                    friendly_name(name),
                    format!(
                        "Game-defined activity zone. {} loot may be nearby; contents are not guaranteed.",
                        friendly_name(category)
                    ),
                    Vec::new(),
                    None,
                    None,
                )
            }
            "ParkingStall" => {
                if !is_drivable_vehicle_zone(name) {
                    continue;
                }
                let label = if name.trim().is_empty() {
                    "Vehicle spawn".into()
                } else {
                    format!("{} vehicle zone", friendly_name(name))
                };
                let zone_key = if name.trim().is_empty() {
                    "parkingstall".to_string()
                } else {
                    name.trim().to_ascii_lowercase()
                };
                let spec = vehicle_definitions
                    .get(&zone_key)
                    .unwrap_or(&default_vehicle_spec);
                let types = vehicle_types(spec, name);
                let type_summary = types
                    .iter()
                    .map(|value| friendly_name(value))
                    .collect::<Vec<_>>()
                    .join(", ");
                let quality_summary = spec.base_quality.map(|quality| {
                    if quality >= 1.0 {
                        "higher"
                    } else if quality < 0.7 {
                        "lower"
                    } else {
                        "standard"
                    }
                });
                let mut details = format!(
                    "Game-defined possible drivable spawn area for {type_summary}. This is a spawn pool, not a live vehicle."
                );
                if let Some(quality) = quality_summary {
                    details.push_str(&format!(" Expected spawn quality: {quality}."));
                }
                if let Some(chance) = spec.part_damage_chance {
                    details.push_str(&format!(" Part-damage chance: {chance:.0}%."));
                }
                details.push_str(" Actual presence, model, condition, and keys vary by save. This source does not expose key locations.");
                (
                    "vehicle",
                    "vehicles",
                    label,
                    details,
                    types,
                    spec.base_quality,
                    spec.part_damage_chance,
                )
            }
            "LootZone" => (
                "loot",
                poi_category(name),
                if name.trim().is_empty() { "Loot zone".into() } else { friendly_name(name) },
                "Explicit game loot zone. Actual contents still depend on sandbox settings and random generation.".into(),
                Vec::new(),
                None,
                None,
            ),
            "WaterZone" => (
                "resource",
                "water",
                "Water zone".into(),
                "Game-authored water activity/resource zone. This is not a complete list of shorelines, wells, sinks, or other water sources.".into(),
                Vec::new(),
                None,
                None,
            ),
            _ => continue,
        };

        bounds.include(center);
        pois.push(Poi {
            label,
            kind: kind.into(),
            category: category.into(),
            x: center.x,
            y: center.y,
            z,
            width,
            height,
            source: format!("objects.lua · {zone_type}"),
            details,
            vehicle_types,
            expected_quality,
            part_damage_chance,
        });
    }

    Ok(pois)
}
