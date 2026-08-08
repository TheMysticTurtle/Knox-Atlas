use quick_xml::Reader;
use quick_xml::events::{BytesStart, Event};
use regex::Regex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::BufReader;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

const WORLD_MAP_CELL_SIZE: f32 = 300.0;
const COMPILED_CELL_SIZE: u32 = 256;
const CHUNK_SIZE: u32 = 8;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
struct Point {
    x: f32,
    y: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bounds {
    min_x: f32,
    min_y: f32,
    max_x: f32,
    max_y: f32,
}

impl Bounds {
    fn empty() -> Self {
        Self {
            min_x: f32::INFINITY,
            min_y: f32::INFINITY,
            max_x: f32::NEG_INFINITY,
            max_y: f32::NEG_INFINITY,
        }
    }

    fn include(&mut self, point: Point) {
        self.min_x = self.min_x.min(point.x);
        self.min_y = self.min_y.min(point.y);
        self.max_x = self.max_x.max(point.x);
        self.max_y = self.max_y.max(point.y);
    }

    fn finish(mut self) -> Self {
        if !self.min_x.is_finite() {
            self.min_x = 0.0;
            self.min_y = 0.0;
            self.max_x = 1.0;
            self.max_y = 1.0;
        }
        self
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MapFeature {
    kind: String,
    value: String,
    detail: Option<String>,
    points: Vec<Point>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Street {
    name: String,
    width: f32,
    points: Vec<Point>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct MapLabel {
    text: String,
    kind: String,
    style: String,
    x: f32,
    y: f32,
    scale: f32,
    rotation: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Poi {
    label: String,
    kind: String,
    category: String,
    x: f32,
    y: f32,
    z: i32,
    width: f32,
    height: f32,
    source: String,
    details: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SaveInfo {
    name: String,
    group: String,
    center: Option<Point>,
    isometric: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct SnapshotCounts {
    buildings: usize,
    streets: usize,
    labels: usize,
    businesses: usize,
    vehicle_zones: usize,
    loot_zones: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct GameSnapshot {
    game_title: String,
    steam_build_id: Option<String>,
    install_path: String,
    map_directory: String,
    compiled_cell_size: u32,
    chunk_size: u32,
    bounds: Bounds,
    initial_center: Point,
    save: Option<SaveInfo>,
    features: Vec<MapFeature>,
    streets: Vec<Street>,
    labels: Vec<MapLabel>,
    pois: Vec<Poi>,
    counts: SnapshotCounts,
    warnings: Vec<String>,
}

#[derive(Default)]
struct TempFeature {
    points: Vec<Point>,
    properties: HashMap<String, String>,
}

fn attribute(element: &BytesStart<'_>, key: &[u8]) -> Option<String> {
    element.attributes().flatten().find_map(|attribute| {
        (attribute.key.as_ref() == key)
            .then(|| xml_decode(&String::from_utf8_lossy(attribute.value.as_ref())))
    })
}

fn xml_decode(value: &str) -> String {
    value
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&apos;", "'")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
}

fn parse_f32(value: Option<String>) -> f32 {
    value.and_then(|value| value.parse().ok()).unwrap_or(0.0)
}

fn classify_feature(properties: &HashMap<String, String>) -> Option<(String, String)> {
    for key in [
        "water", "highway", "railway", "building", "natural", "place",
    ] {
        if let Some(value) = properties.get(key) {
            let kind = match key {
                "highway" => "road",
                "natural" => "terrain",
                other => other,
            };
            return Some((kind.to_string(), value.to_string()));
        }
    }
    None
}

fn parse_world_map(path: &Path, bounds: &mut Bounds) -> Result<Vec<MapFeature>, String> {
    let file = File::open(path).map_err(|error| format!("Could not open world map: {error}"))?;
    let mut reader = Reader::from_reader(BufReader::new(file));
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut cell_origin = Point { x: 0.0, y: 0.0 };
    let mut current: Option<TempFeature> = None;
    let mut features = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) if element.name().as_ref() == b"cell" => {
                cell_origin = Point {
                    x: parse_f32(attribute(&element, b"x")) * WORLD_MAP_CELL_SIZE,
                    y: parse_f32(attribute(&element, b"y")) * WORLD_MAP_CELL_SIZE,
                };
            }
            Ok(Event::Start(element)) if element.name().as_ref() == b"feature" => {
                current = Some(TempFeature::default());
            }
            Ok(Event::Empty(element)) if element.name().as_ref() == b"point" => {
                if let Some(feature) = current.as_mut() {
                    feature.points.push(Point {
                        x: cell_origin.x + parse_f32(attribute(&element, b"x")),
                        y: cell_origin.y + parse_f32(attribute(&element, b"y")),
                    });
                }
            }
            Ok(Event::Empty(element)) if element.name().as_ref() == b"property" => {
                if let (Some(feature), Some(name), Some(value)) = (
                    current.as_mut(),
                    attribute(&element, b"name"),
                    attribute(&element, b"value"),
                ) {
                    feature.properties.insert(name, value);
                }
            }
            Ok(Event::End(element)) if element.name().as_ref() == b"feature" => {
                if let Some(feature) = current.take() {
                    if let Some((kind, value)) = classify_feature(&feature.properties) {
                        for point in &feature.points {
                            bounds.include(*point);
                        }
                        features.push(MapFeature {
                            kind,
                            value,
                            detail: feature.properties.get("RoomTone").cloned(),
                            points: feature.points,
                        });
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("Could not parse world map: {error}")),
            _ => {}
        }
        buffer.clear();
    }

    Ok(features)
}

fn parse_streets(path: &Path, bounds: &mut Bounds) -> Result<Vec<Street>, String> {
    let file = File::open(path).map_err(|error| format!("Could not open street data: {error}"))?;
    let mut reader = Reader::from_reader(BufReader::new(file));
    reader.config_mut().trim_text(true);
    let mut buffer = Vec::new();
    let mut current: Option<Street> = None;
    let mut streets = Vec::new();

    loop {
        match reader.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) if element.name().as_ref() == b"street" => {
                current = Some(Street {
                    name: attribute(&element, b"name").unwrap_or_else(|| "Unnamed road".into()),
                    width: parse_f32(attribute(&element, b"width")),
                    points: Vec::new(),
                });
            }
            Ok(Event::Empty(element)) if element.name().as_ref() == b"point" => {
                if let Some(street) = current.as_mut() {
                    let point = Point {
                        x: parse_f32(attribute(&element, b"x")),
                        y: parse_f32(attribute(&element, b"y")),
                    };
                    bounds.include(point);
                    street.points.push(point);
                }
            }
            Ok(Event::End(element)) if element.name().as_ref() == b"street" => {
                if let Some(street) = current.take() {
                    if street.points.len() > 1 {
                        streets.push(street);
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(error) => return Err(format!("Could not parse street data: {error}")),
            _ => {}
        }
        buffer.clear();
    }

    Ok(streets)
}

fn clean_label(value: &str) -> String {
    value
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_annotations(
    path: &Path,
    translations_path: &Path,
    bounds: &mut Bounds,
) -> Result<Vec<MapLabel>, String> {
    let source = fs::read_to_string(path)
        .map_err(|error| format!("Could not read map annotations: {error}"))?;
    let translations: HashMap<String, String> = fs::read_to_string(translations_path)
        .ok()
        .and_then(|contents| serde_json::from_str(&contents).ok())
        .unwrap_or_default();
    let call_pattern =
        Regex::new(r#"^\s*\(\"([^\"]+)\",\s*\"([^\"]+)\",\s*(-?[0-9.]+),\s*(-?[0-9.]+)\)"#)
            .expect("valid annotation expression");
    let scale_pattern = Regex::new(r"symbol:setScale\(([0-9.]+)\)").unwrap();
    let rotation_pattern = Regex::new(r"symbol:setRotation\((-?[0-9.]+)\)").unwrap();
    let mut labels = Vec::new();

    for block in source
        .split("symbol = symbolsAPI:addUntranslatedText")
        .skip(1)
    {
        let Some(captures) = call_pattern.captures(block) else {
            continue;
        };
        let raw_text = captures.get(1).map(|value| value.as_str()).unwrap_or("");
        let style = captures.get(2).map(|value| value.as_str()).unwrap_or("");
        let x = captures
            .get(3)
            .and_then(|value| value.as_str().parse().ok())
            .unwrap_or(0.0);
        let y = captures
            .get(4)
            .and_then(|value| value.as_str().parse().ok())
            .unwrap_or(0.0);
        let scale = scale_pattern
            .captures(block)
            .and_then(|capture| capture.get(1))
            .and_then(|value| value.as_str().parse().ok())
            .unwrap_or(1.0);
        let rotation = rotation_pattern
            .captures(block)
            .and_then(|capture| capture.get(1))
            .and_then(|value| value.as_str().parse().ok())
            .unwrap_or(0.0);
        let kind = if style.contains("town") {
            "town"
        } else if style.contains("building") {
            "landmark"
        } else if style.contains("place") || style.contains("forest") {
            "area"
        } else if style.contains("water") {
            "water"
        } else {
            "note"
        };
        let point = Point { x, y };
        bounds.include(point);
        labels.push(MapLabel {
            text: clean_label(
                translations
                    .get(raw_text)
                    .map(String::as_str)
                    .unwrap_or(raw_text),
            ),
            kind: kind.into(),
            style: style.into(),
            x,
            y,
            scale,
            rotation,
        });
    }

    Ok(labels)
}

fn friendly_name(value: &str) -> String {
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

fn poi_category(value: &str) -> &'static str {
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
    } else if [
        "doctor",
        "pharmacist",
        "nursinghome",
        "hospital",
        "ambulance",
    ]
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

fn parse_pois(path: &Path, bounds: &mut Bounds) -> Result<Vec<Poi>, String> {
    let source =
        fs::read_to_string(path).map_err(|error| format!("Could not read game zones: {error}"))?;
    let pattern = Regex::new(
        r#"\{\s*name\s*=\s*\"([^\"]*)\",\s*type\s*=\s*\"([^\"]*)\",\s*x\s*=\s*(-?\d+),\s*y\s*=\s*(-?\d+),\s*z\s*=\s*(-?\d+),\s*width\s*=\s*(\d+),\s*height\s*=\s*(\d+)"#,
    )
    .expect("valid zone expression");
    let mut pois = Vec::new();
    let mut seen_businesses = HashSet::new();

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

        let (kind, category, label, details) = match zone_type {
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
                )
            }
            "ParkingStall" => {
                let label = if name.trim().is_empty() {
                    "Vehicle spawn".into()
                } else {
                    format!("{} vehicle zone", friendly_name(name))
                };
                (
                    "vehicle",
                    "vehicles",
                    label,
                    "Game-defined parking or vehicle spawn area. Vehicle presence and condition vary by save.".into(),
                )
            }
            "LootZone" => (
                "loot",
                poi_category(name),
                if name.trim().is_empty() { "Loot zone".into() } else { friendly_name(name) },
                "Explicit game loot zone. Actual contents still depend on sandbox settings and random generation.".into(),
            ),
            "WaterZone" => (
                "resource",
                "water",
                "Water access".into(),
                "Game-defined water zone.".into(),
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
        });
    }

    Ok(pois)
}

fn read_key_value(path: &Path) -> HashMap<String, String> {
    fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect()
}

fn newest_save(root: &Path) -> Option<(PathBuf, String)> {
    let mut candidates: Vec<(SystemTime, PathBuf, String)> = Vec::new();
    for group in fs::read_dir(root).ok()?.flatten() {
        if !group.file_type().ok()?.is_dir() {
            continue;
        }
        let group_name = group.file_name().to_string_lossy().into_owned();
        for save in fs::read_dir(group.path()).ok()?.flatten() {
            if !save.file_type().ok()?.is_dir() {
                continue;
            }
            let modified = save
                .metadata()
                .and_then(|metadata| metadata.modified())
                .unwrap_or(SystemTime::UNIX_EPOCH);
            candidates.push((modified, save.path(), group_name.clone()));
        }
    }
    candidates.sort_by_key(|candidate| candidate.0);
    candidates.pop().map(|(_, path, group)| (path, group))
}

fn find_game_root() -> Option<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        candidates.push(
            PathBuf::from(program_files_x86)
                .join("Steam")
                .join("steamapps")
                .join("common")
                .join("ProjectZomboid"),
        );
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        candidates.push(
            PathBuf::from(program_files)
                .join("Steam")
                .join("steamapps")
                .join("common")
                .join("ProjectZomboid"),
        );
    }
    for drive in ["C", "D", "E", "F"] {
        candidates.push(PathBuf::from(format!(
            "{drive}:\\SteamLibrary\\steamapps\\common\\ProjectZomboid"
        )));
    }
    candidates.into_iter().find(|candidate| {
        candidate.join("projectzomboid.jar").is_file()
            && candidate.join("media").join("maps").is_dir()
    })
}

fn steam_build_id(game_root: &Path) -> Option<String> {
    let manifest = game_root.parent()?.parent()?.join("appmanifest_108600.acf");
    let source = fs::read_to_string(manifest).ok()?;
    Regex::new(r#"\"buildid\"\s+\"([^\"]+)\""#)
        .ok()?
        .captures(&source)?
        .get(1)
        .map(|value| value.as_str().to_string())
}

fn load_snapshot() -> Result<GameSnapshot, String> {
    let game_root = find_game_root().ok_or_else(|| {
        "Project Zomboid was not found in the standard Steam library locations.".to_string()
    })?;
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
    let pois = parse_pois(&map_root.join("objects.lua"), &mut bounds)?;
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

#[tauri::command]
fn load_game_snapshot() -> Result<GameSnapshot, String> {
    load_snapshot()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_game_snapshot])
        .run(tauri::generate_context!())
        .expect("error while running Knox Atlas");
}

#[cfg(test)]
mod tests {
    use super::{find_game_root, friendly_name, load_snapshot, poi_category};

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
    fn reads_an_installed_game_when_available() {
        if find_game_root().is_none() {
            return;
        }

        let snapshot = load_snapshot().expect("installed game data should parse");
        assert!(!snapshot.features.is_empty());
        assert!(!snapshot.streets.is_empty());
        assert!(!snapshot.labels.is_empty());
        assert!(snapshot.counts.buildings > 1_000);
    }
}
