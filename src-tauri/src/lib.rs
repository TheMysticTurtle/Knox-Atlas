//! Knox Atlas desktop shell — a thin Tauri command layer over `knox-atlas-core`.
//!
//! Game parsing and the typed `GameSnapshot` boundary live in `knox-atlas-core`; this crate only
//! wires Tauri commands to it. Commands are ported from the prototype during Phase S (parity).

/// Smoke-test command proving the React shell → Tauri → core wiring during scaffolding.
#[tauri::command]
fn core_version() -> String {
    knox_atlas_core::version().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![core_version])
        .run(tauri::generate_context!())
        .expect("error while running Knox Atlas");
}
