//! Save reader (Tier 2) — reads a Project Zomboid save directory read-only.
//!
//! The reader is **source-agnostic**: point it at any save dir (single-player, self-hosted, or a
//! dedicated server's save on the server box). Only a *remote* multiplayer client's cache is thin.
//!
//! Extraction is layered by difficulty (built incrementally):
//! 1. **Positions** — `players.db` / `vehicles.db` are plain SQLite. DONE here.
//! 2. Vehicle/player `data` blobs (type, condition, keys, inventory) — Java-serialized. TODO.
//! 3. Container loot in `map/<x>/<y>/` chunk files — custom binary. TODO.

use std::path::{Path, PathBuf};

use rusqlite::{Connection, OpenFlags};
use serde::Serialize;

use crate::error::{CoreError, Result};

/// A player's last-saved position. From `localPlayers` (single-player) or `networkPlayers` (hosted).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerPosition {
    pub id: i64,
    pub username: String,
    pub name: String,
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub is_dead: bool,
}

/// A vehicle's saved world position (its `data` blob — type/condition/keys — is decoded later).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VehiclePosition {
    pub id: i64,
    pub x: f32,
    pub y: f32,
}

/// What we can extract from a save today (positions layer). Grows with later layers.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveDetail {
    pub players: Vec<PlayerPosition>,
    pub vehicles: Vec<VehiclePosition>,
}

fn open_read_only(path: &Path) -> Option<Connection> {
    if !path.exists() {
        return None;
    }
    // `immutable=1` reads a consistent snapshot without taking locks, so we can read even while the
    // game holds the file open (the data may be slightly stale until the game's next autosave/quit).
    let uri = format!(
        "file:{}?immutable=1",
        path.to_string_lossy()
            .replace('\\', "/")
            .replace(' ', "%20")
    );
    Connection::open_with_flags(
        uri,
        OpenFlags::SQLITE_OPEN_READ_ONLY
            | OpenFlags::SQLITE_OPEN_URI
            | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .ok()
}

fn table_exists(connection: &Connection, name: &str) -> bool {
    connection
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
            [name],
            |_| Ok(()),
        )
        .is_ok()
}

fn read_players(save_dir: &Path) -> Result<Vec<PlayerPosition>> {
    let Some(connection) = open_read_only(&save_dir.join("players.db")) else {
        return Ok(Vec::new());
    };
    let mut players = Vec::new();

    // Hosted / multiplayer saves store players (incl. the host) in `networkPlayers`.
    if table_exists(&connection, "networkPlayers") {
        let mut statement = connection
            .prepare("SELECT id, username, name, x, y, z, isDead FROM networkPlayers")
            .map_err(|error| CoreError::parse("players.db", error.to_string()))?;
        let rows = statement
            .query_map([], |row| {
                Ok(PlayerPosition {
                    id: row.get(0)?,
                    username: row.get::<_, Option<String>>(1)?.unwrap_or_default(),
                    name: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
                    x: row.get::<_, f64>(3)? as f32,
                    y: row.get::<_, f64>(4)? as f32,
                    z: row.get::<_, f64>(5)? as f32,
                    is_dead: row.get::<_, i64>(6)? != 0,
                })
            })
            .map_err(|error| CoreError::parse("players.db", error.to_string()))?;
        for row in rows {
            players.push(row.map_err(|error| CoreError::parse("players.db", error.to_string()))?);
        }
    }

    // Single-player saves store the local player in `localPlayers` (no `username` column).
    if table_exists(&connection, "localPlayers") {
        let mut statement = connection
            .prepare("SELECT id, name, x, y, z, isDead FROM localPlayers")
            .map_err(|error| CoreError::parse("players.db", error.to_string()))?;
        let rows = statement
            .query_map([], |row| {
                let name = row.get::<_, Option<String>>(1)?.unwrap_or_default();
                Ok(PlayerPosition {
                    id: row.get(0)?,
                    username: name.clone(),
                    name,
                    x: row.get::<_, f64>(2)? as f32,
                    y: row.get::<_, f64>(3)? as f32,
                    z: row.get::<_, f64>(4)? as f32,
                    is_dead: row.get::<_, i64>(5)? != 0,
                })
            })
            .map_err(|error| CoreError::parse("players.db", error.to_string()))?;
        for row in rows {
            players.push(row.map_err(|error| CoreError::parse("players.db", error.to_string()))?);
        }
    }

    Ok(players)
}

fn read_vehicles(save_dir: &Path) -> Result<Vec<VehiclePosition>> {
    let Some(connection) = open_read_only(&save_dir.join("vehicles.db")) else {
        return Ok(Vec::new());
    };
    if !table_exists(&connection, "vehicles") {
        return Ok(Vec::new());
    }
    let mut statement = connection
        .prepare("SELECT id, x, y FROM vehicles")
        .map_err(|error| CoreError::parse("vehicles.db", error.to_string()))?;
    let rows = statement
        .query_map([], |row| {
            Ok(VehiclePosition {
                id: row.get(0)?,
                x: row.get::<_, f64>(1)? as f32,
                y: row.get::<_, f64>(2)? as f32,
            })
        })
        .map_err(|error| CoreError::parse("vehicles.db", error.to_string()))?;
    let mut vehicles = Vec::new();
    for row in rows {
        vehicles.push(row.map_err(|error| CoreError::parse("vehicles.db", error.to_string()))?);
    }
    Ok(vehicles)
}

/// Read the extractable detail from a save directory (positions layer).
pub fn load_save_detail(save_dir: &Path) -> Result<SaveDetail> {
    Ok(SaveDetail {
        players: read_players(save_dir)?,
        vehicles: read_vehicles(save_dir)?,
    })
}

/// The most-recently-modified save directory beneath `%USERPROFILE%/Zomboid/Saves`, if any.
/// A convenience for the default "read my latest save" path; the frontend can pass any dir instead.
pub fn default_save_dir() -> Option<PathBuf> {
    let root = std::env::var_os("USERPROFILE")
        .map(PathBuf::from)?
        .join("Zomboid")
        .join("Saves");
    crate::install::newest_save(&root).map(|(path, _group)| path)
}
