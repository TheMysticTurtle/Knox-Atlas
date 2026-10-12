//! Expected loot per room type — parsed from the game's own loot tables (install-only, no save).
//!
//! Data chain (verified in the spike):
//! - `Distributions.lua` / `SuburbsDistributions.lua`: `roomName = { container = { items = {"Item",
//!   weight, …} | procedural = true, procList = { {name="ListName", …} } } }`.
//! - `ProceduralDistributions.lua`: `ListName = { items = { "Item", weight, … } }`.
//!
//! We combine them into `room type (lowercase) → ranked expected items`, which powers the
//! "click a room → see its likely loot" feature. Names are the game's item script IDs.

use std::collections::HashMap;
use std::fs;
use std::path::Path;

use regex::Regex;
use serde::Serialize;

use crate::error::{CoreError, Result};

/// One expected item and the game's spawn weight for it (higher = more likely).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LootItem {
    pub item: String,
    pub weight: f32,
}

/// room type (lowercase) → items the game can spawn there, most-likely first.
pub type RoomLoot = HashMap<String, Vec<LootItem>>;

/// Index of the matching `}` for the `{` at `open`, scanning a byte slice.
fn matching_brace(bytes: &[u8], open: usize) -> Option<usize> {
    let mut depth = 0i32;
    for (offset, &byte) in bytes.iter().enumerate().skip(open) {
        match byte {
            b'{' => depth += 1,
            b'}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(offset);
                }
            }
            _ => {}
        }
    }
    None
}

/// Top-level `key = { … }` blocks (direct children of the file's single root table, i.e. brace
/// depth 1). Depth-based, so it is robust to the files' mixed tab/space indentation.
fn top_level_blocks(source: &str) -> Vec<(String, &str)> {
    let bytes = source.as_bytes();
    let mut depth_before = vec![0i32; bytes.len()];
    let mut depth = 0i32;
    for (index, &byte) in bytes.iter().enumerate() {
        depth_before[index] = depth;
        if byte == b'{' {
            depth += 1;
        } else if byte == b'}' {
            depth -= 1;
        }
    }
    let key = Regex::new(r"([A-Za-z_]\w*)\s*=\s*\{").expect("valid key expression");
    let mut blocks = Vec::new();
    for capture in key.captures_iter(source) {
        let whole = capture.get(0).unwrap();
        let brace = whole.end() - 1;
        if depth_before[brace] == 1 {
            if let Some(close) = matching_brace(bytes, brace) {
                blocks.push((capture[1].to_string(), &source[brace + 1..close]));
            }
        }
    }
    blocks
}

/// Every `items = { … }` sub-block within a block.
fn items_blocks<'a>(block: &'a str, marker: &Regex) -> Vec<&'a str> {
    let bytes = block.as_bytes();
    marker
        .find_iter(block)
        .filter_map(|m| {
            let brace = m.end() - 1;
            matching_brace(bytes, brace).map(|close| &block[brace + 1..close])
        })
        .collect()
}

/// `"Item", weight` pairs inside an items block. `procList` `{name="X", min=0}` entries do not match
/// (their string is followed by `, min`, not a number), so they are naturally excluded.
fn item_pairs(items_block: &str, pair: &Regex) -> Vec<(String, f32)> {
    pair.captures_iter(items_block)
        .filter_map(|c| {
            let item = c.get(1)?.as_str().to_string();
            let weight = c.get(2)?.as_str().parse().ok()?;
            Some((item, weight))
        })
        .collect()
}

fn merge_max(into: &mut HashMap<String, f32>, item: String, weight: f32) {
    into.entry(item)
        .and_modify(|existing| *existing = existing.max(weight))
        .or_insert(weight);
}

/// Order a room's complete item set by the game's raw spawn weight (most likely first). This is the
/// honest, predictable default; a *characteristic* headline (e.g. grouping by container/source so a
/// gun room leads with guns, not shared paperwork) is a UX-presentation refinement layered on top —
/// tried a distinctiveness (weight×idf) rank and it unreliably buried common-but-characteristic loot
/// (a pharmacy's meds sank under pharmacy-specific glasses displays), so it is intentionally not the
/// stored default. The full item list is retained so no characteristic loot is lost to truncation.
fn rank(items: HashMap<String, f32>) -> Vec<LootItem> {
    let mut ranked: Vec<LootItem> = items
        .into_iter()
        .map(|(item, weight)| LootItem { item, weight })
        .collect();
    ranked.sort_by(|a, b| {
        b.weight
            .partial_cmp(&a.weight)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then_with(|| a.item.cmp(&b.item))
    });
    // Uncapped: item search must find every room type that lists an item (a 60-item cap hid
    // items from ~200 room types). The selection card shows only the top of this list.
    ranked
}

/// Build `room type → expected loot` from the installed game (`<root>/media/lua/server/Items`).
pub fn load_distributions(game_root: &Path) -> Result<RoomLoot> {
    let dir = game_root
        .join("media")
        .join("lua")
        .join("server")
        .join("Items");
    let read = |name: &str| -> String { fs::read_to_string(dir.join(name)).unwrap_or_default() };
    let procedural_src = read("ProceduralDistributions.lua");
    if procedural_src.is_empty() {
        return Err(CoreError::parse(
            "ProceduralDistributions.lua",
            "not found or empty",
        ));
    }
    let room_sources = [read("SuburbsDistributions.lua"), read("Distributions.lua")];

    let items_marker = Regex::new(r"items\s*=\s*\{").expect("valid items marker");
    let pair = Regex::new(r#""([^"]+)"\s*,\s*(\d+(?:\.\d+)?)"#).expect("valid item pair");
    let proc_ref = Regex::new(r#"name\s*=\s*"([^"]+)""#).expect("valid proc ref");

    // Named procedural loot lists.
    let mut proc_lists: HashMap<String, Vec<(String, f32)>> = HashMap::new();
    for (name, block) in top_level_blocks(&procedural_src) {
        let mut items = Vec::new();
        for inner in items_blocks(block, &items_marker) {
            items.extend(item_pairs(inner, &pair));
        }
        if !items.is_empty() {
            proc_lists.insert(name.to_ascii_lowercase(), items);
        }
    }

    // Rooms: direct items + referenced procedural lists.
    let mut room_loot: HashMap<String, HashMap<String, f32>> = HashMap::new();
    for source in &room_sources {
        for (room, block) in top_level_blocks(source) {
            let entry = room_loot.entry(room.to_ascii_lowercase()).or_default();
            for inner in items_blocks(block, &items_marker) {
                for (item, weight) in item_pairs(inner, &pair) {
                    merge_max(entry, item, weight);
                }
            }
            for reference in proc_ref.captures_iter(block) {
                if let Some(list) = proc_lists.get(&reference[1].to_ascii_lowercase()) {
                    for (item, weight) in list {
                        merge_max(entry, item.clone(), *weight);
                    }
                }
            }
        }
    }

    Ok(room_loot
        .into_iter()
        .map(|(room, items)| (room, rank(items)))
        .filter(|(_, items)| !items.is_empty())
        .collect())
}
