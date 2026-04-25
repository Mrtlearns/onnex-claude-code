use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use serde_json::{json, Value};
use std::sync::Arc;
use std::sync::atomic::Ordering;
use tracing::{info, warn};

use crate::auth_helpers::verify_admin;
use crate::routes::AppState;

/// Accepts Bearer admin-token OR Basic dashboard creds. Constant-time compare both paths.
fn is_admin(state: &AppState, headers: &HeaderMap) -> bool {
    let ok = verify_admin(&state.config, headers);
    if !ok {
        warn!("admin: no valid credentials (Bearer or Basic) — rejecting request");
    }
    ok
}

pub async fn estop_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if !is_admin(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"})));
    }
    state.e_stop.store(true, Ordering::SeqCst);
    state.metrics.estop_active.set(1);
    warn!("E-STOP ACTIVATED via admin API");
    (StatusCode::OK, Json(json!({ "status": "estop_active" })))
}

pub async fn estop_lift_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if !is_admin(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"})));
    }
    state.e_stop.store(false, Ordering::SeqCst);
    state.metrics.estop_active.set(0);
    info!("E-STOP LIFTED via admin API");
    (StatusCode::OK, Json(json!({ "status": "estop_lifted" })))
}

pub async fn feed_refresh_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if !is_admin(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"})));
    }
    let _ = state.feed_refresh_tx.send(()).await;
    (StatusCode::ACCEPTED, Json(json!({ "status": "refresh_triggered" })))
}

pub async fn signatures_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if !is_admin(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"})));
    }
    let stats = state.signatures.stats();
    (StatusCode::OK, Json(json!({
        "pattern_count": stats.pattern_count,
        "cve_count": stats.cve_count,
    })))
}

pub async fn audit_verify_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if !is_admin(&state, &headers) {
        return (StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"})));
    }
    match state.audit.verify().await {
        Ok(count) => (StatusCode::OK, Json(json!({
            "status": "ok",
            "records_verified": count,
        }))),
        Err(first_bad) => (StatusCode::OK, Json(json!({
            "status": "integrity_failure",
            "first_bad_record_id": first_bad,
        }))),
    }
}
