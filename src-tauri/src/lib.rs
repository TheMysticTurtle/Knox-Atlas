//! Knox Atlas desktop shell — a thin Tauri command layer over `knox-atlas-core`.
//!
//! All game parsing and the typed `GameSnapshot` boundary live in `knox-atlas-core`; this crate only
//! wires two narrow commands to it (mirrors the prototype's boundary for the Phase S parity gate):
//! - `load_game_snapshot` — parse the install (optionally a user-chosen root) into a `GameSnapshot`.
//! - `validate_game_install_path` — validate a folder the user picked before it is remembered.

use std::path::Path;

use knox_atlas_core::GameSnapshot;

/// Parse the installed game (optionally a user-chosen root) into a `GameSnapshot`. The parse is
/// CPU/IO-heavy, so it runs on the blocking pool and the command is `async` — the WebView never
/// blocks. `CoreError` is flattened to a user-facing string for the frontend.
#[tauri::command]
async fn load_game_snapshot(game_root: Option<String>) -> Result<GameSnapshot, String> {
    tauri::async_runtime::spawn_blocking(move || {
        knox_atlas_core::load_snapshot_from(game_root.as_deref().map(Path::new))
            .map_err(|error| error.to_string())
    })
    .await
    .map_err(|error| error.to_string())?
}

/// Validate a folder the user picked before it is remembered. Cheap, so it stays synchronous.
#[tauri::command]
fn validate_game_install_path(path: String) -> Result<String, String> {
    knox_atlas_core::validated_game_root(Path::new(&path))
        .map(|root| root.to_string_lossy().into_owned())
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load_game_snapshot,
            validate_game_install_path
        ])
        .run(tauri::generate_context!())
        .expect("error while running Knox Atlas");
}
