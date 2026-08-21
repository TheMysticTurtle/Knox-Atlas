//! Steam / Project Zomboid install discovery, root validation, save discovery, key/value reads.

use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use regex::Regex;

pub(crate) fn read_key_value(path: &Path) -> HashMap<String, String> {
    fs::read_to_string(path)
        .unwrap_or_default()
        .lines()
        .filter_map(|line| line.split_once('='))
        .map(|(key, value)| (key.trim().to_string(), value.trim().to_string()))
        .collect()
}

pub(crate) fn newest_save(root: &Path) -> Option<(PathBuf, String)> {
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

pub(crate) fn is_game_root(candidate: &Path) -> bool {
    candidate.join("projectzomboid.jar").is_file() && candidate.join("media").join("maps").is_dir()
}

pub(crate) fn steam_library_paths(steam_root: &Path) -> Vec<PathBuf> {
    let mut libraries = vec![steam_root.to_path_buf()];
    let source = fs::read_to_string(steam_root.join("steamapps").join("libraryfolders.vdf"))
        .unwrap_or_default();
    let path_pattern = Regex::new(r#""path"\s+"([^"]+)""#).expect("valid Steam path pattern");
    for captures in path_pattern.captures_iter(&source) {
        if let Some(value) = captures.get(1) {
            libraries.push(PathBuf::from(value.as_str().replace("\\\\", "\\")));
        }
    }
    libraries
}

pub(crate) fn find_game_root() -> Option<PathBuf> {
    let mut steam_roots = Vec::new();
    if let Some(program_files_x86) = std::env::var_os("ProgramFiles(x86)") {
        steam_roots.push(PathBuf::from(program_files_x86).join("Steam"));
    }
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        steam_roots.push(PathBuf::from(program_files).join("Steam"));
    }
    for drive in ["C", "D", "E", "F"] {
        steam_roots.push(PathBuf::from(format!("{drive}:\\SteamLibrary")));
    }

    steam_roots
        .into_iter()
        .flat_map(|root| steam_library_paths(&root))
        .map(|library| {
            library
                .join("steamapps")
                .join("common")
                .join("ProjectZomboid")
        })
        .find(|candidate| is_game_root(candidate))
}

pub fn validated_game_root(path: &Path) -> Result<PathBuf, String> {
    if !is_game_root(path) {
        return Err(
            "That folder is not a Project Zomboid installation. Choose the ProjectZomboid folder that contains projectzomboid.jar and media\\maps."
                .to_string(),
        );
    }
    path.canonicalize()
        .map_err(|error| format!("The Project Zomboid folder could not be opened: {error}"))
}

pub(crate) fn steam_build_id(game_root: &Path) -> Option<String> {
    let manifest = game_root.parent()?.parent()?.join("appmanifest_108600.acf");
    let source = fs::read_to_string(manifest).ok()?;
    Regex::new(r#"\"buildid\"\s+\"([^\"]+)\""#)
        .ok()?
        .captures(&source)?
        .get(1)
        .map(|value| value.as_str().to_string())
}
