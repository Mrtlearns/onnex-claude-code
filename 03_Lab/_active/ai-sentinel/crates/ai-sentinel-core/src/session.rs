use async_trait::async_trait;
use std::sync::Arc;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SessionState {
    pub session_id: String,
    pub caller_id: String,
    pub action_count: u64,
    pub cost_usd_today: f64,
    pub tokens_today: u64,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
    pub e_stop: bool,
    /// Seen trust tokens for replay protection (token_hash → expiry_unix)
    pub seen_trust_tokens: std::collections::HashMap<String, i64>,
    /// Embedding baseline for L3 drift detection (Phase 2)
    pub embedding_baseline: Option<Vec<f32>>,
}

impl SessionState {
    pub fn new(session_id: String, caller_id: String) -> Self {
        SessionState {
            session_id,
            caller_id,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
            ..Default::default()
        }
    }
}

/// Trait for session storage backends.
#[async_trait]
pub trait SessionHandle: Send + Sync {
    fn session_id(&self) -> &str;
    async fn load(&self) -> anyhow::Result<Option<SessionState>>;
    async fn save(&self, state: &SessionState) -> anyhow::Result<()>;
}

/// Trait for session store factories.
#[async_trait]
pub trait SessionStore: Send + Sync {
    async fn get(&self, session_id: &str, caller_id: &str)
        -> anyhow::Result<Box<dyn SessionHandle>>;
}
