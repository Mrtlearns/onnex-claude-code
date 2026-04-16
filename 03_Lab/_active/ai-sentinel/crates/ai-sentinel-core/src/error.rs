use thiserror::Error;

#[derive(Debug, Error)]
pub enum LayerError {
    #[error("Layer internal error: {0}")]
    Internal(String),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Serialization error: {0}")]
    Serde(String),

    #[error("Network error: {0}")]
    Network(String),

    #[error("Timeout: {0}")]
    Timeout(String),
}

impl LayerError {
    pub fn internal(msg: impl Into<String>) -> Self {
        LayerError::Internal(msg.into())
    }
    pub fn config(msg: impl Into<String>) -> Self {
        LayerError::Config(msg.into())
    }
    pub fn network(msg: impl Into<String>) -> Self {
        LayerError::Network(msg.into())
    }
}

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Layer error: {0}")]
    Layer(#[from] LayerError),

    #[error("Config error: {0}")]
    Config(String),

    #[error("Store error: {0}")]
    Store(String),
}
