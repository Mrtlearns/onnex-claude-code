//! Contract-compat aliases for /health and /ready.

use axum::{http::StatusCode, Json};
use serde_json::{json, Value};

pub async fn healthz_handler() -> (StatusCode, Json<Value>) {
    (
        StatusCode::OK,
        Json(json!({
            "status": "ok",
            "version": env!("CARGO_PKG_VERSION"),
        })),
    )
}

pub async fn readyz_handler() -> (StatusCode, Json<Value>) {
    // For v1 testmode returns ok unconditionally. Full readiness (upstream reachability,
    // rule pack loaded) is delegated to the main /ready endpoint on the api crate.
    (StatusCode::OK, Json(json!({"status": "ready"})))
}
