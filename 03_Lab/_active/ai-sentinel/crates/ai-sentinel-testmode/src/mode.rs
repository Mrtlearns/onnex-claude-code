//! Sentinel mode state: full | observe | bypass.
//!
//! - `full`    — normal ingress + egress enforcement (default)
//! - `observe` — rules evaluated, verdicts reported, but nothing is blocked/mutated
//! - `bypass`  — inspection entirely skipped; every response verdict is BYPASS

use crate::state::TestmodeState;
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use subtle::ConstantTimeEq;
use tracing::info;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SentinelMode {
    Full,
    Observe,
    Bypass,
}

impl Default for SentinelMode {
    fn default() -> Self {
        SentinelMode::Full
    }
}

impl SentinelMode {
    pub fn as_str(&self) -> &'static str {
        match self {
            SentinelMode::Full => "full",
            SentinelMode::Observe => "observe",
            SentinelMode::Bypass => "bypass",
        }
    }
}

#[derive(Debug, Clone)]
pub struct ModeState {
    pub mode: SentinelMode,
    pub since: DateTime<Utc>,
}

impl Default for ModeState {
    fn default() -> Self {
        Self {
            mode: SentinelMode::Full,
            since: Utc::now(),
        }
    }
}

// ─── Auth helper (duplicated from api::admin so testmode stays self-contained) ──

fn extract_bearer(headers: &HeaderMap) -> &str {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("")
}

pub(crate) fn check_admin_token(state: &TestmodeState, token: &str) -> bool {
    match &state.config.admin_token {
        Some(t) => t.as_bytes().ct_eq(token.as_bytes()).into(),
        None => false,
    }
}

fn auth_or_401(state: &TestmodeState, headers: &HeaderMap) -> Option<(StatusCode, Json<Value>)> {
    if !check_admin_token(state, extract_bearer(headers)) {
        return Some((StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"}))));
    }
    None
}

// ─── Handlers ────────────────────────────────────────────────────────────────

pub async fn get_mode_handler(State(state): State<Arc<TestmodeState>>) -> (StatusCode, Json<Value>) {
    let s = state.mode.read();
    (
        StatusCode::OK,
        Json(json!({
            "mode": s.mode.as_str(),
            "since": s.since.to_rfc3339(),
        })),
    )
}

#[derive(Deserialize)]
pub struct SetModeBody {
    pub mode: String,
}

pub async fn set_mode_handler(
    State(state): State<Arc<TestmodeState>>,
    headers: HeaderMap,
    Json(body): Json<SetModeBody>,
) -> (StatusCode, Json<Value>) {
    if let Some(r) = auth_or_401(&state, &headers) {
        return r;
    }
    let new_mode = match body.mode.as_str() {
        "full" => SentinelMode::Full,
        "observe" => SentinelMode::Observe,
        "bypass" => SentinelMode::Bypass,
        other => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("unknown mode: {other}")})),
            );
        }
    };
    let mut s = state.mode.write();
    s.mode = new_mode;
    s.since = Utc::now();
    info!(mode = new_mode.as_str(), "sentinel mode changed");
    (
        StatusCode::OK,
        Json(json!({
            "mode": s.mode.as_str(),
            "since": s.since.to_rfc3339(),
        })),
    )
}
