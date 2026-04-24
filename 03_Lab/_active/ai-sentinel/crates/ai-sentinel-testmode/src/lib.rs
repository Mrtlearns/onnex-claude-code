//! AI-Sentinel Testing Mode — implements the Onnex Armory v1.0 HTTP contract.
//!
//! This crate is the sole container for dev-only testing surface. It is consumed by
//! `ai-sentinel-api` only when the `testmode` feature is enabled, so production builds
//! never pull it in and the binary carries no testmode code.
//!
//! Exposed HTTP surface (mounted under the top-level `ai-sentinel-api` router):
//!
//! - `POST /chat`                     — Main proxy: pipeline → upstream → pipeline → envelope
//! - `GET  /sentinel/mode`            — current enforcement mode (full | observe | bypass)
//! - `POST /sentinel/mode`            — set mode (admin-authed)
//! - `GET  /sentinel/policy`          — current policy version + api version + rule categories
//! - `GET  /sentinel/traces`          — ring buffer of recent traces
//! - `GET  /sentinel/traces/:id`      — full detail for one trace
//! - `GET  /healthz`, `GET /readyz`   — aliases of `/health`, `/ready` for contract compat
//!
//! Public entry point: [`testmode_router`] — takes a [`TestmodeState`] and returns an axum
//! `Router<()>` ready to be `.merge()`d into the api crate's router.

pub mod chat;
pub mod contract;
pub mod health;
pub mod mode;
pub mod policy;
pub mod state;
pub mod trace;
pub mod upstream;

pub use contract::{
    Category, ChatRequestBody, ChatUpstreamMode, Envelope, Modification, RuleMatchOut,
    SentinelMeta, Stage, UpstreamBody, Verdict, ACTION_REFUSED_AT_EGRESS,
    ACTION_REFUSED_AT_INGRESS, ACTION_REDACTED_AT_EGRESS, ACTION_REDACTED_AT_INGRESS,
    ACTION_PASSTHROUGH, ACTION_BYPASSED,
};
pub use state::{TestmodeState, TestmodeStateConfig};

use axum::{
    routing::{get, post},
    Router,
};
use std::sync::Arc;

/// Build the testmode router. Call site wraps its output in `.with_state(Arc<TestmodeState>)`
/// already-applied so it returns a plain `Router` mergeable into the top-level axum app.
pub fn testmode_router(state: Arc<TestmodeState>) -> Router {
    Router::new()
        .route("/chat", post(chat::chat_handler))
        .route("/sentinel/mode", get(mode::get_mode_handler).post(mode::set_mode_handler))
        .route("/sentinel/policy", get(policy::get_policy_handler))
        .route("/sentinel/traces", get(trace::list_traces_handler))
        .route("/sentinel/traces/:id", get(trace::get_trace_handler))
        .route("/healthz", get(health::healthz_handler))
        .route("/readyz", get(health::readyz_handler))
        .with_state(state)
}
