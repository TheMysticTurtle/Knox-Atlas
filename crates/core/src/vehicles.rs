//! `VehicleZoneDefinition.lua` — maps `ParkingStall` zone names to weighted vehicle pools.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use regex::Regex;

#[derive(Debug, Default, Clone)]
pub(crate) struct VehicleZoneSpec {
    pub(crate) scripts: Vec<String>,
    pub(crate) base_quality: Option<f32>,
    pub(crate) part_damage_chance: Option<f32>,
    pub(crate) includes_normal_pool: bool,
}

pub(crate) fn is_drivable_vehicle_zone(value: &str) -> bool {
    let value = value.trim().to_ascii_lowercase();
    !value.contains("burnt")
        && !value.contains("trafficjam")
        && !value.contains("traffic jam")
        && !value.contains("junkyard")
}

pub(crate) fn parse_vehicle_zone_definitions(path: &Path) -> HashMap<String, VehicleZoneSpec> {
    let Ok(source) = fs::read_to_string(path) else {
        return HashMap::new();
    };
    let section_pattern = Regex::new(r"VehicleZoneDistribution\.([A-Za-z0-9_]+)\s*=\s*\{\s*\}\s*;")
        .expect("valid vehicle section expression");
    let vehicle_pattern =
        Regex::new(r#"\.vehicles\[\"([^\"]+)\"\]"#).expect("valid vehicle expression");
    let quality_pattern = Regex::new(r"\.baseVehicleQuality\s*=\s*([0-9.]+)")
        .expect("valid vehicle quality expression");
    let damage_pattern = Regex::new(r"\.chanceToPartDamage\s*=\s*([0-9.]+)")
        .expect("valid vehicle damage expression");
    let normal_pattern =
        Regex::new(r"\.chanceToSpawnNormal\s*=\s*([0-9.]+)").expect("valid normal pool expression");
    let sections: Vec<_> = section_pattern.captures_iter(&source).collect();
    let mut definitions = HashMap::new();

    for (index, captures) in sections.iter().enumerate() {
        let Some(section) = captures.get(0) else {
            continue;
        };
        let name = captures
            .get(1)
            .map(|value| value.as_str().to_ascii_lowercase())
            .unwrap_or_default();
        let end = sections
            .get(index + 1)
            .and_then(|next| next.get(0))
            .map(|next| next.start())
            .unwrap_or(source.len());
        let block = &source[section.end()..end];
        let scripts = vehicle_pattern
            .captures_iter(block)
            .filter_map(|capture| capture.get(1))
            .map(|value| value.as_str().to_string())
            .collect();
        let number = |pattern: &Regex| {
            pattern
                .captures(block)
                .and_then(|capture| capture.get(1))
                .and_then(|value| value.as_str().parse::<f32>().ok())
        };
        definitions.insert(
            name,
            VehicleZoneSpec {
                scripts,
                base_quality: number(&quality_pattern),
                part_damage_chance: number(&damage_pattern),
                includes_normal_pool: number(&normal_pattern).is_some_and(|chance| chance > 0.0),
            },
        );
    }

    let normal_scripts = definitions
        .get("parkingstall")
        .map(|definition| definition.scripts.clone())
        .unwrap_or_default();
    for definition in definitions.values_mut() {
        if definition.includes_normal_pool {
            definition.scripts.extend(normal_scripts.iter().cloned());
        }
    }
    definitions
}

pub(crate) fn vehicle_types(spec: &VehicleZoneSpec, zone_name: &str) -> Vec<String> {
    let mut types = Vec::new();
    let scripts = spec.scripts.join(" ").to_ascii_lowercase();
    let zone_name = zone_name.to_ascii_lowercase();

    if scripts.contains("car") || scripts.contains("suv") || scripts.contains("offroad") {
        types.push("cars".into());
    }
    if scripts.contains("van") || scripts.contains("ambulance") {
        types.push("vans".into());
    }
    if scripts.contains("truck") || scripts.contains("tractor") {
        types.push("trucks".into());
    }
    if ["police", "ambulance", "fire", "prison", "ranger", "army"]
        .iter()
        .any(|name| zone_name.contains(name))
    {
        types.push("emergency".into());
    }
    if types.is_empty() {
        types.push("cars".into());
    }
    types.sort();
    types.dedup();
    types
}
