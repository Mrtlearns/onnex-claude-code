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

// ─── Auth helpers (vendored — testmode stays self-contained) ──────────────────
// Accepts EITHER `Authorization: Bearer <admin_token>` OR
// `Authorization: Basic base64(dashboard_user:dashboard_password)`. Constant-time compare.

fn auth_value(headers: &HeaderMap) -> Option<&str> {
    headers.get("authorization").and_then(|v| v.to_str().ok())
}

pub(crate) fn extract_bearer(headers: &HeaderMap) -> &str {
    auth_value(headers).and_then(|v| v.strip_prefix("Bearer ")).unwrap_or("")
}

fn extract_basic(headers: &HeaderMap) -> Option<(String, String)> {
    let raw = auth_value(headers)?.strip_prefix("Basic ")?;
    let bytes = b64_decode(raw.trim())?;
    let s = String::from_utf8(bytes).ok()?;
    let mut split = s.splitn(2, ':');
    Some((split.next()?.to_string(), split.next()?.to_string()))
}

fn b64_decode(s: &str) -> Option<Vec<u8>> {
    let mut out = Vec::with_capacity(s.len() * 3 / 4);
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    for c in s.chars() {
        let v: u32 = match c {
            'A'..='Z' => (c as u32) - 'A' as u32,
            'a'..='z' => (c as u32) - 'a' as u32 + 26,
            '0'..='9' => (c as u32) - '0' as u32 + 52,
            '+' => 62,
            '/' => 63,
            '=' => break,
            ' ' | '\t' | '\r' | '\n' => continue,
            _ => return None,
        };
        buf = (buf << 6) | v;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Some(out)
}

pub(crate) fn check_admin_token(state: &TestmodeState, _token: &str) -> bool {
    // Compatibility shim — chat.rs calls this with the bearer-only token. Now that we
    // also accept Basic auth, this signature is preserved but the real check is in
    // verify_admin_headers.
    let headers = HeaderMap::new();
    let _ = headers;
    // chat.rs callers should switch to verify_admin_headers; until they do, accept any
    // token whose constant-time equality matches admin_token (bearer-only path).
    if let Some(t) = state.config.admin_token.as_ref() {
        if !_token.is_empty() {
            return t.as_bytes().ct_eq(_token.as_bytes()).into();
        }
    }
    false
}

/// Combined auth check — used by handlers that have access to the full HeaderMap.
pub(crate) fn verify_admin_headers(state: &TestmodeState, headers: &HeaderMap) -> bool {
    // 1. Bearer admin-token
    if let Some(expected) = state.config.admin_token.as_ref() {
        let token = extract_bearer(headers);
        if !token.is_empty() {
            let ok: bool = expected.as_bytes().ct_eq(token.as_bytes()).into();
            if ok {
                return true;
            }
        }
    }
    // 2. Basic dashboard-user:dashboard-password
    if let (Some(user), Some(pass)) = (
        state.config.dashboard_user.as_ref(),
        state.config.dashboard_password.as_ref(),
    ) {
        if let Some((u, p)) = extract_basic(headers) {
            let user_ok: bool = u.as_bytes().ct_eq(user.as_bytes()).into();
            let pass_ok: bool = p.as_bytes().ct_eq(pass.as_bytes()).into();
            if user_ok && pass_ok {
                return true;
            }
        }
    }
    false
}

fn auth_or_401(state: &TestmodeState, headers: &HeaderMap) -> Option<(StatusCode, Json<Value>)> {
    if !verify_admin_headers(state, headers) {
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
