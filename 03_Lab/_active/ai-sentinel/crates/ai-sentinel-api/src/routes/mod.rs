use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use axum::{extract::State, http::StatusCode, response::{IntoResponse, Response}, body::Body, Json};
use axum::http::header;
use tokio::sync::{broadcast, mpsc};
use serde_json::json;
use prometheus_client::encoding::text::encode;

use ai_sentinel_core::{AppConfig, Pipeline, TelemetryEvent};
use ai_sentinel_feed::LiveSignatures;
use ai_sentinel_store::MemoryStore;
use ai_sentinel_layers::AuditChain;
use crate::metrics::MetricsRegistry;

pub mod admin;
pub mod check;
pub mod health;
pub mod ws;

/// Shared application state threaded through all handlers.
pub struct AppState {
    pub pipeline: Arc<Pipeline>,
    pub store: Arc<MemoryStore>,
    pub audit: Arc<AuditChain>,
    pub signatures: LiveSignatures,
    pub feed_refresh_tx: mpsc::Sender<()>,
    pub e_stop: Arc<AtomicBool>,
    pub config: Arc<AppConfig>,
    pub metrics: Arc<MetricsRegistry>,
    /// Broadcast sender for real-time telemetry streaming to /ws/telemetry clients.
    pub broadcast_tx: broadcast::Sender<TelemetryEvent>,
}

/// GET /metrics — Prometheus text format
pub async fn metrics_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let mut buf = String::new();
    if encode(&mut buf, &state.metrics.registry).is_ok() {
        (
            axum::http::StatusCode::OK,
            [("content-type", "text/plain; version=0.0.4")],
            buf,
        )
    } else {
        (
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            [("content-type", "text/plain")],
            "encode error".to_string(),
        )
    }
}

/// GET /openapi.json — OpenAPI 3.1 spec (minimal, expand in Wave 7)
pub async fn openapi_handler() -> impl IntoResponse {
    Json(json!({
        "openapi": "3.1.0",
        "info": {
            "title": "AI-Sentinel",
            "version": env!("CARGO_PKG_VERSION"),
            "description": "Enterprise AI security sidecar — 8-layer protection for every LLM call"
        },
        "paths": {
            "/check": {
                "post": {
                    "summary": "Security check — ingress or egress",
                    "requestBody": {
                        "required": true,
                        "content": {
                            "application/json": {
                                "schema": { "$ref": "#/components/schemas/CheckRequest" }
                            }
                        }
                    },
                    "responses": {
                        "200": { "description": "Pass or Reject with detail" }
                    }
                }
            },
            "/health": { "get": { "summary": "Liveness probe", "responses": { "200": { "description": "ok" } } } },
            "/ready": { "get": { "summary": "Readiness probe", "responses": { "200": { "description": "ready" } } } },
            "/metrics": { "get": { "summary": "Prometheus metrics" } }
        }
    }))
}

/// GET / — Landing page (embedded at compile time)
pub async fn landing_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        include_str!("../../static/landing.html"),
    )
}

/// GET /live — Live glassmorphism architecture viewer (embedded at compile time)
pub async fn live_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        include_str!("../../static/live.html"),
    )
}

/// GET /ui — Built-in admin dashboard (embedded at compile time)
pub async fn ui_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        include_str!("../../static/ui.html"),
    )
}

/// GET /presentation.pdf — Pre-generated investor presentation PDF (embedded at compile time)
pub async fn presentation_pdf_handler() -> Response {
    let bytes: &'static [u8] = include_bytes!("../../static/presentation.pdf");
    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(header::CONTENT_DISPOSITION, "attachment; filename=\"AI-Sentinel-Investor-Presentation.pdf\"")
        .header(header::CACHE_CONTROL, "public, max-age=3600")
        .body(Body::from(bytes))
        .unwrap()
}

/// GET /docs — Scalar API browser (lightweight HTML embed)
pub async fn docs_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::OK,
        [("content-type", "text/html")],
        r#"<!DOCTYPE html>
<html>
<head><title>AI-Sentinel API</title></head>
<body>
<script id="api-reference" data-url="/openapi.json"></script>
<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>"#,
    )
}
