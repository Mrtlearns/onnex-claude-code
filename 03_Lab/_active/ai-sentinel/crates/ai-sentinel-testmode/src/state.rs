//! Shared state passed to every testmode handler.
//!
//! Deliberately narrow: testmode only needs the pipeline handle, the app config (for
//! admin-token comparison), an optional DB pool (for policy-version derivation), and the
//! three testmode-owned pieces: mode state, upstream client, trace ring buffer.

use crate::mode::ModeState;
use crate::trace::TraceStore;
use crate::upstream::UpstreamClient;
use ai_sentinel_core::{AppConfig, Pipeline};
use parking_lot::RwLock;
use sqlx::PgPool;
use std::sync::Arc;

/// Plain-data input that the api crate hands over at startup.
pub struct TestmodeStateConfig {
    pub pipeline: Arc<Pipeline>,
    pub config: Arc<AppConfig>,
    pub db: Option<PgPool>,
    pub sentinel_version: &'static str,
    pub upstream_url: String,
    pub upstream_api_key: Option<String>,
    pub upstream_default_model: String,
}

/// Runtime state held behind Arc for every request.
pub struct TestmodeState {
    pub pipeline: Arc<Pipeline>,
    pub config: Arc<AppConfig>,
    pub db: Option<PgPool>,
    pub sentinel_version: &'static str,
    pub mode: Arc<RwLock<ModeState>>,
    pub upstream: Arc<UpstreamClient>,
    pub traces: Arc<TraceStore>,
    pub default_model: String,
}

impl TestmodeState {
    pub fn new(cfg: TestmodeStateConfig) -> Self {
        Self {
            pipeline: cfg.pipeline,
            config: cfg.config,
            db: cfg.db,
            sentinel_version: cfg.sentinel_version,
            mode: Arc::new(RwLock::new(ModeState::default())),
            upstream: Arc::new(UpstreamClient::new(cfg.upstream_url, cfg.upstream_api_key)),
            traces: Arc::new(TraceStore::new(200)),
            default_model: cfg.upstream_default_model,
        }
    }
}
