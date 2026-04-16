use axum::{extract::State, Json};
use serde_json::{json, Value};
use std::sync::Arc;
use crate::routes::AppState;

pub async fn health_handler() -> Json<Value> {
    Json(json!({ "status": "ok", "service": "ai-sentinel" }))
}

pub async fn ready_handler(State(state): State<Arc<AppState>>) -> Json<Value> {
    let estop = state.e_stop.load(std::sync::atomic::Ordering::Relaxed);
    let sig_stats = state.signatures.stats();
    let audit_len = state.audit.record_count();

    Json(json!({
        "status": "ready",
        "e_stop": estop,
        "feed": {
            "pattern_count": sig_stats.pattern_count,
            "cve_count": sig_stats.cve_count,
        },
        "audit_chain_length": audit_len,
        "layers": {
            "l0": "telemetry",
            "l1": "active",
            "l2_1": "active",
            "l2_2": "active",
            "l2_3": "active",
            "l2_4": "active",
            "l3": "stub",
            "l4": "active",
            "l5": "active",
            "l6": "stub",
            "l7": "active",
        }
    }))
}
