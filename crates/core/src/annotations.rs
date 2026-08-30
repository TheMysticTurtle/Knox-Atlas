//! `worldmap-annotations.lua` + `MapLabel.json` — town/area/water/landmark labels.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use regex::Regex;

use crate::error::{CoreError, Result};
use crate::types::{Bounds, MapLabel, Point};

fn clean_label(value: &str) -> String {
    value
        .replace("<br>", " ")
        .replace("<br/>", " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub(crate) fn parse_annotations(
    path: &Path,
    translations_path: &Path,
    bounds: &mut Bounds,
) -> Result<Vec<MapLabel>> {
    let source =
        fs::read_to_string(path).map_err(|error| CoreError::io("the map annotations", error))?;
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
