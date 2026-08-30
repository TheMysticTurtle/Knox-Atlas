//! `worldmap.xml` — vector water/roads/rail/buildings/terrain. Vector cells are 300 tiles.

use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use quick_xml::events::Event;
use quick_xml::Reader;

use crate::error::{CoreError, Result};
use crate::types::{Bounds, MapFeature, Point};
use crate::util::{attribute, parse_f32};
use crate::WORLD_MAP_CELL_SIZE;

#[derive(Default)]
struct TempFeature {
    points: Vec<Point>,
    properties: HashMap<String, String>,
}

pub(crate) fn classify_feature(properties: &HashMap<String, String>) -> Option<(String, String)> {
    for key in [
        "water", "highway", "railway", "building", "natural", "place",
    ] {
        if let Some(value) = properties.get(key) {
            let kind = match key {
                "highway" => "road",
                "natural" => "terrain",
                other => other,
            };
            let value = if key == "building" && value.eq_ignore_ascii_case("yes") {
                // The world map uses the OpenStreetMap-style `building=yes` flag
                // when no more specific display category was authored.
                "Unclassified".to_string()
            } else {
                value.to_string()
            };
            return Some((kind.to_string(), value));
        }
    }
    None
}

pub(crate) fn parse_world_map(path: &Path, bounds: &mut Bounds) -> Result<Vec<MapFeature>> {
    let file = File::open(path).map_err(|error| CoreError::io("the world map", error))?;
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
            Err(error) => return Err(CoreError::parse("worldmap.xml", error.to_string())),
            _ => {}
        }
        buffer.clear();
    }

    Ok(features)
}
