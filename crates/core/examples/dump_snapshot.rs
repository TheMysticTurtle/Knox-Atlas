//! Dev helper: write real map data to `web/public/*.json` so the frontend can render actual data in
//! a browser (dev + the future served web view) without needing the Tauri runtime.
//!
//! Run from the repo root: `cargo run -p knox-atlas-core --example dump_snapshot`

use std::path::{Path, PathBuf};

use serde::Serialize;

fn write_json(dir: &Path, name: &str, value: &impl Serialize) {
    let json = serde_json::to_string(value).expect("serialize");
    let path = dir.join(name);
    std::fs::write(&path, json).unwrap_or_else(|e| panic!("write {}: {e}", path.display()));
    let bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    println!("wrote {name} ({} KB)", bytes / 1024);
}

fn main() {
    let out = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../web/public");
    std::fs::create_dir_all(&out).expect("create web/public");

    let snapshot = knox_atlas_core::load_snapshot_from(None).expect("load installed game");
    let root = PathBuf::from(&snapshot.install_path);
    let pois = knox_atlas_core::load_room_pois(&root).expect("room POIs");
    let loot = knox_atlas_core::load_distributions(&root).expect("loot tables");

    println!("{} POIs, {} room loot types", pois.len(), loot.len());
    write_json(&out, "snapshot.json", &snapshot);
    write_json(&out, "pois.json", &pois);
    write_json(&out, "loot.json", &loot);
}
