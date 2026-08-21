//! Normalized data types that cross the Tauri boundary (serialized to the frontend as camelCase).
//! Ported verbatim from the prototype; behavior is unchanged.

use serde::Serialize;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Point {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Bounds {
    pub min_x: f32,
    pub min_y: f32,
    pub max_x: f32,
    pub max_y: f32,
}

impl Bounds {
    pub(crate) fn empty() -> Self {
        Self {
            min_x: f32::INFINITY,
            min_y: f32::INFINITY,
            max_x: f32::NEG_INFINITY,
            max_y: f32::NEG_INFINITY,
        }
    }

    pub(crate) fn include(&mut self, point: Point) {
        self.min_x = self.min_x.min(point.x);
        self.min_y = self.min_y.min(point.y);
        self.max_x = self.max_x.max(point.x);
        self.max_y = self.max_y.max(point.y);
    }

    pub(crate) fn finish(mut self) -> Self {
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
pub struct MapFeature {
    pub kind: String,
    pub value: String,
    pub detail: Option<String>,
    pub points: Vec<Point>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Street {
    pub name: String,
    pub width: f32,
    pub points: Vec<Point>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MapLabel {
    pub text: String,
    pub kind: String,
    pub style: String,
    pub x: f32,
    pub y: f32,
    pub scale: f32,
    pub rotation: f32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Poi {
    pub label: String,
    pub kind: String,
    pub category: String,
    pub x: f32,
    pub y: f32,
    pub z: i32,
    pub width: f32,
    pub height: f32,
    pub source: String,
    pub details: String,
    pub vehicle_types: Vec<String>,
    pub expected_quality: Option<f32>,
    pub part_damage_chance: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveInfo {
    pub name: String,
    pub group: String,
    pub center: Option<Point>,
    pub isometric: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotCounts {
    pub buildings: usize,
    pub streets: usize,
    pub labels: usize,
    pub businesses: usize,
    pub vehicle_zones: usize,
    pub loot_zones: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GameSnapshot {
    pub game_title: String,
    pub steam_build_id: Option<String>,
    pub install_path: String,
    pub map_directory: String,
    pub compiled_cell_size: u32,
    pub chunk_size: u32,
    pub bounds: Bounds,
    pub initial_center: Point,
    pub save: Option<SaveInfo>,
    pub features: Vec<MapFeature>,
    pub streets: Vec<Street>,
    pub labels: Vec<MapLabel>,
    pub pois: Vec<Poi>,
    pub counts: SnapshotCounts,
    pub warnings: Vec<String>,
}
