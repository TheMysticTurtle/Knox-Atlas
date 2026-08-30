//! The core's typed error. Callers (the Tauri layer, the share server, tests) can distinguish an
//! install that was not found from an unreadable folder from a parse failure, while every variant
//! still renders a clear, user-facing message via `Display`.

/// Errors returned by the Knox Atlas core.
#[derive(Debug, thiserror::Error)]
pub enum CoreError {
    /// No Project Zomboid installation was discovered automatically.
    #[error(
        "Project Zomboid was not found in your Steam libraries. Choose the ProjectZomboid installation folder from the Local game source card."
    )]
    InstallNotFound,

    /// A folder the user chose is not a Project Zomboid installation.
    #[error(
        "That folder is not a Project Zomboid installation. Choose the ProjectZomboid folder that contains projectzomboid.jar and media\\maps."
    )]
    InvalidInstall,

    /// A required file or directory could not be read.
    #[error("Could not read {context}: {source}")]
    Io {
        context: String,
        #[source]
        source: std::io::Error,
    },

    /// A game-owned file was present but could not be parsed in the expected format.
    #[error("Could not parse {file}: {reason}")]
    Parse { file: String, reason: String },
}

impl CoreError {
    /// Wrap an I/O error with human context (e.g. `"the world map"`).
    pub(crate) fn io(context: impl Into<String>, source: std::io::Error) -> Self {
        Self::Io {
            context: context.into(),
            source,
        }
    }

    /// A parse failure for a named source file.
    pub(crate) fn parse(file: impl Into<String>, reason: impl Into<String>) -> Self {
        Self::Parse {
            file: file.into(),
            reason: reason.into(),
        }
    }
}

/// Convenience alias for results returned by the core.
pub type Result<T> = std::result::Result<T, CoreError>;
