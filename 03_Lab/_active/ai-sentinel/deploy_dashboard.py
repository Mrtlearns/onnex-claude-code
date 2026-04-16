import paramiko
import os
import sys

HOST = "10.10.110.36"
USER = "root"
PASS = "Poll0000"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username=USER, password=PASS, timeout=15)

# Create directories
dirs = [
    "/opt/ai-sentinel/crates/ai-sentinel-api/src/routes",
    "/opt/ai-sentinel/crates/ai-sentinel-api/static",
    "/opt/ai-sentinel/infra/grafana/provisioning/datasources",
    "/opt/ai-sentinel/infra/grafana/provisioning/dashboards",
    "/opt/ai-sentinel/infra/grafana/dashboards",
]
for d in dirs:
    stdin, stdout, stderr = ssh.exec_command(f"mkdir -p {d}")
    stdout.channel.recv_exit_status()
print("Directories created.")

sftp = ssh.open_sftp()

# Define files as a list of (remote_path, local_content)
files = []

# metrics.rs
files.append(("/opt/ai-sentinel/crates/ai-sentinel-api/src/metrics.rs", """\
use prometheus_client::{
    metrics::{counter::Counter, gauge::Gauge, histogram::Histogram},
    registry::Registry,
};
use std::sync::atomic::AtomicU64;

pub struct MetricsRegistry {
    pub registry: Registry,
    pub requests_total: Counter,
    pub layer_faults_total: Counter,
    pub pii_stripped_total: Counter,
    pub rate_limit_total: Counter,
    pub trust_replay_attempts: Counter,
    pub feed_last_update: Gauge,
    pub audit_chain_length: Gauge,
    pub estop_active: Gauge,
    pub latency_ms: Histogram,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let mut registry = Registry::default();

        // Counter names WITHOUT _total — prometheus-client appends _total automatically
        let requests_total: Counter = Counter::default();
        registry.register("ai_sentinel_requests", "Total requests processed", requests_total.clone());

        let layer_faults_total: Counter = Counter::default();
        registry.register("ai_sentinel_layer_faults", "Total layer faults", layer_faults_total.clone());

        let pii_stripped_total: Counter = Counter::default();
        registry.register("ai_sentinel_pii_stripped", "Requests where PII was stripped", pii_stripped_total.clone());

        let rate_limit_total: Counter = Counter::default();
        registry.register("ai_sentinel_rate_limit", "Requests rejected by rate limiter", rate_limit_total.clone());

        let trust_replay_attempts: Counter = Counter::default();
        registry.register("ai_sentinel_trust_replay_attempts", "Trust token replay attempts", trust_replay_attempts.clone());

        let feed_last_update: Gauge = Gauge::default();
        registry.register("ai_sentinel_feed_last_update", "Unix timestamp of last feed update", feed_last_update.clone());

        let audit_chain_length: Gauge = Gauge::default();
        registry.register("ai_sentinel_audit_chain_length", "Records in audit chain", audit_chain_length.clone());

        let estop_active: Gauge = Gauge::default();
        registry.register("ai_sentinel_estop_active", "1.0 if e-stop active", estop_active.clone());

        let latency_ms = Histogram::new(
            [1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0].iter().copied(),
        );
        registry.register("ai_sentinel_latency_ms", "Request latency milliseconds", latency_ms.clone());

        MetricsRegistry {
            registry,
            requests_total,
            layer_faults_total,
            pii_stripped_total,
            rate_limit_total,
            trust_replay_attempts,
            feed_last_update,
            audit_chain_length,
            estop_active,
            latency_ms,
        }
    }
}
"""))

# routes/mod.rs
files.append(("/opt/ai-sentinel/crates/ai-sentinel-api/src/routes/mod.rs", """\
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use axum::{extract::State, response::IntoResponse, Json};
use tokio::sync::mpsc;
use serde_json::json;
use prometheus_client::encoding::text::encode;

use ai_sentinel_core::{AppConfig, Pipeline};
use ai_sentinel_feed::LiveSignatures;
use ai_sentinel_store::MemoryStore;
use ai_sentinel_layers::AuditChain;
use crate::metrics::MetricsRegistry;

pub mod admin;
pub mod check;
pub mod health;

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
}

/// GET /metrics -- Prometheus text format
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

/// GET /openapi.json -- OpenAPI 3.1 spec
pub async fn openapi_handler() -> impl IntoResponse {
    Json(json!({
        "openapi": "3.1.0",
        "info": {
            "title": "AI-Sentinel",
            "version": env!("CARGO_PKG_VERSION"),
            "description": "Enterprise AI security sidecar -- 8-layer protection for every LLM call"
        },
        "paths": {
            "/check": {
                "post": {
                    "summary": "Security check -- ingress or egress",
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
            "/metrics": { "get": { "summary": "Prometheus metrics" } },
            "/ui": { "get": { "summary": "Admin dashboard UI" } }
        }
    }))
}

/// GET /ui -- Built-in admin dashboard (embedded at compile time)
pub async fn ui_handler() -> impl IntoResponse {
    (
        axum::http::StatusCode::OK,
        [("content-type", "text/html; charset=utf-8")],
        include_str!("../../static/ui.html"),
    )
}

/// GET /docs -- Scalar API browser (lightweight HTML embed)
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
"""))

# main.rs
files.append(("/opt/ai-sentinel/crates/ai-sentinel-api/src/main.rs", """\
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use axum::{
    Router,
    routing::{get, post},
    extract::State,
};
use tokio::net::TcpListener;
use tracing::{info, warn};
use tracing_subscriber::{EnvFilter, fmt};

use ai_sentinel_core::{AppConfig, Pipeline};
use ai_sentinel_feed::{FeedWorker, LiveSignatures, SignatureSet};
use ai_sentinel_store::MemoryStore;
use ai_sentinel_layers::{
    L1Sanitization, L2Auth, L2Mcp, L2Threat, L2Trust,
    L3Intent, L4Tools, L5Sandbox, L6Output, AuditChain,
};

mod metrics;
mod routes;

pub use routes::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_env("AI_SENTINEL_LOG_LEVEL")
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .init();

    let config = Arc::new(AppConfig::load().unwrap_or_else(|e| {
        warn!("Config load error ({}), using defaults", e);
        AppConfig::default()
    }));

    info!(version = env!("CARGO_PKG_VERSION"), "ai-sentinel starting");

    let signatures = LiveSignatures::new(SignatureSet::default());
    let feed_worker = FeedWorker::new(signatures.clone(), config.clone());
    let feed_refresh_tx = feed_worker.spawn();

    let audit = Arc::new(AuditChain::new());
    let e_stop = Arc::new(AtomicBool::new(false));
    let store = Arc::new(MemoryStore::default());

    let l1 = L1Sanitization::new(&config)
        .map_err(|e| anyhow::anyhow!("L1 init: {}", e))?;
    let l2_auth = L2Auth::new(&config);
    let l2_trust = L2Trust::new(&config);
    let l2_threat = L2Threat::new(signatures.clone());
    let l2_mcp = L2Mcp::new();
    let l3 = L3Intent::new(&config);
    let l4 = L4Tools::new(&config, signatures.clone())
        .map_err(|e| anyhow::anyhow!("L4 init: {}", e))?;
    let l5 = L5Sandbox::new(&config, e_stop.clone());
    let l6 = L6Output::new(&config)
        .map_err(|e| anyhow::anyhow!("L6 init: {}", e))?;

    let pipeline = Arc::new(Pipeline::new(vec![
        Arc::new(l1),
        Arc::new(l2_auth),
        Arc::new(l2_trust),
        Arc::new(l2_threat),
        Arc::new(l2_mcp),
        Arc::new(l3),
        Arc::new(l4),
        Arc::new(l5),
        Arc::new(l6),
    ]));

    let metrics_registry = Arc::new(metrics::MetricsRegistry::new());
    let state = Arc::new(AppState {
        pipeline,
        store,
        audit: audit.clone(),
        signatures,
        feed_refresh_tx,
        e_stop,
        config: config.clone(),
        metrics: metrics_registry,
    });

    let app = Router::new()
        .route("/health", get(routes::health::health_handler))
        .route("/ready", get(routes::health::ready_handler))
        .route("/check", post(routes::check::check_handler))
        .route("/metrics", get(routes::metrics_handler))
        .route("/openapi.json", get(routes::openapi_handler))
        .route("/ui", get(routes::ui_handler))
        .route("/docs", get(routes::docs_handler))
        .route("/admin/estop", post(routes::admin::estop_handler))
        .route("/admin/estop/lift", post(routes::admin::estop_lift_handler))
        .route("/admin/feed/refresh", post(routes::admin::feed_refresh_handler))
        .route("/admin/signatures", get(routes::admin::signatures_handler))
        .route("/admin/audit/verify", get(routes::admin::audit_verify_handler))
        .with_state(state);

    let bind = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&bind).await?;
    info!(bind = %bind, "listening");

    axum::serve(listener, app).await?;
    Ok(())
}
"""))

# prometheus.yml
files.append(("/opt/ai-sentinel/infra/prometheus.yml", """\
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: ai-sentinel
    static_configs:
      - targets: ['agentsec:8080']
    metrics_path: /metrics
"""))

# grafana datasource
files.append(("/opt/ai-sentinel/infra/grafana/provisioning/datasources/prometheus.yml", """\
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
"""))

# grafana dashboard provider
files.append(("/opt/ai-sentinel/infra/grafana/provisioning/dashboards/dashboard.yml", """\
apiVersion: 1
providers:
  - name: ai-sentinel
    folder: AI-Sentinel
    type: file
    disableDeletion: false
    editable: true
    options:
      path: /var/lib/grafana/dashboards
"""))

# grafana dashboard JSON
grafana_json = '{"title":"AI-Sentinel","uid":"ai-sentinel-v1","schemaVersion":38,"version":1,"refresh":"15s","time":{"from":"now-1h","to":"now"},"panels":[{"id":1,"type":"stat","gridPos":{"x":0,"y":0,"w":4,"h":4},"title":"Total Requests","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background","graphMode":"area"},"fieldConfig":{"defaults":{"color":{"fixedColor":"blue","mode":"fixed"},"unit":"short"}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_requests_total","legendFormat":"requests"}]},{"id":2,"type":"stat","gridPos":{"x":4,"y":0,"w":4,"h":4},"title":"Avg Latency (ms)","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background","graphMode":"area"},"fieldConfig":{"defaults":{"color":{"fixedColor":"green","mode":"fixed"},"unit":"ms"}},"targets":[{"datasource":"Prometheus","expr":"rate(ai_sentinel_latency_ms_sum[5m]) / rate(ai_sentinel_latency_ms_count[5m])","legendFormat":"avg latency"}]},{"id":3,"type":"stat","gridPos":{"x":8,"y":0,"w":4,"h":4},"title":"E-Stop Active","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background"},"fieldConfig":{"defaults":{"mappings":[{"type":"value","options":{"0":{"text":"INACTIVE","color":"green"},"1":{"text":"ACTIVE","color":"red"}}}],"thresholds":{"steps":[{"value":0,"color":"green"},{"value":1,"color":"red"}]},"color":{"mode":"thresholds"}}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_estop_active","legendFormat":"e-stop"}]},{"id":4,"type":"stat","gridPos":{"x":12,"y":0,"w":4,"h":4},"title":"Audit Chain Length","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background","graphMode":"area"},"fieldConfig":{"defaults":{"color":{"fixedColor":"purple","mode":"fixed"},"unit":"short"}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_audit_chain_length","legendFormat":"records"}]},{"id":5,"type":"stat","gridPos":{"x":16,"y":0,"w":4,"h":4},"title":"PII Stripped","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background","graphMode":"area"},"fieldConfig":{"defaults":{"color":{"fixedColor":"yellow","mode":"fixed"},"unit":"short"}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_pii_stripped_total","legendFormat":"redacted"}]},{"id":6,"type":"stat","gridPos":{"x":20,"y":0,"w":4,"h":4},"title":"Layer Faults","options":{"reduceOptions":{"calcs":["lastNotNull"]},"colorMode":"background"},"fieldConfig":{"defaults":{"thresholds":{"steps":[{"value":0,"color":"green"},{"value":1,"color":"orange"}]},"color":{"mode":"thresholds"},"unit":"short"}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_layer_faults_total","legendFormat":"faults"}]},{"id":7,"type":"timeseries","gridPos":{"x":0,"y":4,"w":12,"h":8},"title":"Request Rate (req/s)","fieldConfig":{"defaults":{"unit":"reqps","color":{"mode":"palette-classic"}}},"targets":[{"datasource":"Prometheus","expr":"rate(ai_sentinel_requests_total[1m])","legendFormat":"requests/s"}]},{"id":8,"type":"timeseries","gridPos":{"x":12,"y":4,"w":12,"h":8},"title":"Request Latency (ms)","fieldConfig":{"defaults":{"unit":"ms","color":{"mode":"palette-classic"}}},"targets":[{"datasource":"Prometheus","expr":"histogram_quantile(0.50, rate(ai_sentinel_latency_ms_bucket[5m]))","legendFormat":"p50"},{"datasource":"Prometheus","expr":"histogram_quantile(0.95, rate(ai_sentinel_latency_ms_bucket[5m]))","legendFormat":"p95"},{"datasource":"Prometheus","expr":"histogram_quantile(0.99, rate(ai_sentinel_latency_ms_bucket[5m]))","legendFormat":"p99"}]},{"id":9,"type":"timeseries","gridPos":{"x":0,"y":12,"w":12,"h":8},"title":"Security Events","fieldConfig":{"defaults":{"unit":"short","color":{"mode":"palette-classic"}}},"targets":[{"datasource":"Prometheus","expr":"rate(ai_sentinel_pii_stripped_total[5m])","legendFormat":"PII stripped/s"},{"datasource":"Prometheus","expr":"rate(ai_sentinel_rate_limit_total[5m])","legendFormat":"rate limited/s"},{"datasource":"Prometheus","expr":"rate(ai_sentinel_trust_replay_attempts_total[5m])","legendFormat":"replay attempts/s"}]},{"id":10,"type":"timeseries","gridPos":{"x":12,"y":12,"w":12,"h":8},"title":"Audit Chain Growth","fieldConfig":{"defaults":{"unit":"short","color":{"mode":"palette-classic"}}},"targets":[{"datasource":"Prometheus","expr":"ai_sentinel_audit_chain_length","legendFormat":"records"}]}]}'
files.append(("/opt/ai-sentinel/infra/grafana/dashboards/ai-sentinel.json", grafana_json))

# ui.html - write as bytes to avoid encoding issues
import os
_script_dir = os.path.dirname(os.path.abspath(__file__))
ui_html_content = open(os.path.join(_script_dir, "ui.html"), "rb").read()

# Upload all text files
for path, content in files:
    with sftp.open(path, 'w') as f:
        f.write(content)
    print(f"Uploaded: {path}")

# Upload ui.html as binary
with sftp.open("/opt/ai-sentinel/crates/ai-sentinel-api/static/ui.html", 'wb') as f:
    f.write(ui_html_content)
print("Uploaded: /opt/ai-sentinel/crates/ai-sentinel-api/static/ui.html")

sftp.close()
ssh.close()
print("\nAll files uploaded successfully.")
