//! Shared admin-auth checking. Two paths supported:
//!
//! 1. `Authorization: Bearer <admin_token>` — for Armory, curl, scripts (existing).
//! 2. `Authorization: Basic <base64(user:pass)>` — for the dashboard via Traefik HTTP
//!    basic auth. Browser caches the credential after one prompt, then auto-attaches
//!    it on every same-origin call. Server-side we still verify the user/pass matches
//!    the configured `AI_SENTINEL_DASHBOARD_USER` / `AI_SENTINEL_DASHBOARD_PASSWORD`.
//!
//! Both paths use constant-time comparison.

use ai_sentinel_core::AppConfig;
use axum::http::HeaderMap;
use subtle::ConstantTimeEq;

/// Extract the value of the `Authorization` header.
fn auth_header(headers: &HeaderMap) -> Option<&str> {
    headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
}

pub fn extract_bearer(headers: &HeaderMap) -> &str {
    auth_header(headers)
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("")
}

/// Decode `Authorization: Basic <base64>` into `(user, password)` tuple.
fn extract_basic(headers: &HeaderMap) -> Option<(String, String)> {
    let raw = auth_header(headers)?.strip_prefix("Basic ")?;
    // base64 stdlib not in deps; do a small manual decode.
    let bytes = base64_decode(raw.trim())?;
    let s = String::from_utf8(bytes).ok()?;
    let mut split = s.splitn(2, ':');
    Some((split.next()?.to_string(), split.next()?.to_string()))
}

fn base64_decode(s: &str) -> Option<Vec<u8>> {
    // Minimal RFC 4648 base64 decoder. Handles standard alphabet + '=' padding.
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

/// Check Bearer-token auth.
pub fn verify_bearer(config: &AppConfig, headers: &HeaderMap) -> bool {
    let Some(expected) = config.admin_token.as_ref() else {
        return false;
    };
    let token = extract_bearer(headers);
    if token.is_empty() {
        return false;
    }
    expected.as_bytes().ct_eq(token.as_bytes()).into()
}

/// Check HTTP Basic auth against configured dashboard user + password.
pub fn verify_basic(config: &AppConfig, headers: &HeaderMap) -> bool {
    let (Some(user), Some(pass)) = (
        config.dashboard_user.as_ref(),
        config.dashboard_password.as_ref(),
    ) else {
        return false;
    };
    let Some((u, p)) = extract_basic(headers) else {
        return false;
    };
    let user_ok: bool = u.as_bytes().ct_eq(user.as_bytes()).into();
    let pass_ok: bool = p.as_bytes().ct_eq(pass.as_bytes()).into();
    user_ok && pass_ok
}

/// Combined admin gate — accepts either Bearer admin-token or Basic dashboard creds.
pub fn verify_admin(config: &AppConfig, headers: &HeaderMap) -> bool {
    verify_bearer(config, headers) || verify_basic(config, headers)
}

/// Path-based gate for `/dashboard*` and `/admin/*`. Returns true if the path requires
/// admin auth. Public paths (/chat, /healthz, /sentinel/mode GET, etc.) return false so
/// Armory and unauthenticated callers can still reach them.
pub fn path_requires_admin(path: &str) -> bool {
    path.starts_with("/admin")
        || path == "/dashboard"
        || path.starts_with("/dashboard/")
}

/// Axum middleware: gates `/dashboard*` and `/admin/*`. On 401, sets
/// `WWW-Authenticate: Basic realm="AI-Sentinel"` so the browser opens its native
/// HTTP basic auth prompt — no token-pasting UI needed in the dashboard itself.
pub async fn admin_auth_middleware(
    axum::extract::State(state): axum::extract::State<std::sync::Arc<crate::routes::AppState>>,
    req: axum::http::Request<axum::body::Body>,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let path = req.uri().path().to_string();
    if !path_requires_admin(&path) {
        return next.run(req).await;
    }
    if verify_admin(&state.config, req.headers()) {
        return next.run(req).await;
    }
    let mut resp = axum::response::Response::builder()
        .status(axum::http::StatusCode::UNAUTHORIZED)
        .header(
            axum::http::header::WWW_AUTHENTICATE,
            r#"Basic realm="AI-Sentinel""#,
        )
        .header(axum::http::header::CONTENT_TYPE, "application/json")
        .body(axum::body::Body::from(
            r#"{"error":"unauthorized","hint":"basic auth: demo / configured password, or Bearer admin token"}"#,
        ))
        .unwrap();
    resp.extensions_mut().insert(()); // placate clippy
    resp
}
