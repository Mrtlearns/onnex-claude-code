use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use axum::{
    Router,
    routing::{get, post},
};
use tokio::net::TcpListener;
use tokio::sync::broadcast;
use tracing::{info, warn};
use tracing_subscriber::EnvFilter;

use ai_sentinel_core::{AppConfig, Pipeline, TelemetryEvent};
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
    // Init tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_env("AI_SENTINEL_LOG_LEVEL")
                .unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .init();

    // Load config
    let config = Arc::new(AppConfig::load().unwrap_or_else(|e| {
        warn!("Config load error ({}), using defaults", e);
        AppConfig::default()
    }));

    info!(version = env!("CARGO_PKG_VERSION"), "ai-sentinel starting");

    // Initialize live signatures
    let signatures = LiveSignatures::new(SignatureSet::default());

    // Start feed worker
    let feed_worker = FeedWorker::new(signatures.clone(), config.clone());
    let feed_refresh_tx = feed_worker.spawn();

    // Initialize audit chain
    let audit = Arc::new(AuditChain::new());

    // Initialize e-stop flag
    let e_stop = Arc::new(AtomicBool::new(false));

    // Initialize session store
    let store = Arc::new(MemoryStore::default());

    // Build layer pipeline
    let l1 = L1Sanitization::new(&config)
        .map_err(|e| anyhow::anyhow!("L1 init: {}", e))?;
    let l2_auth = L2Auth::new(&config);
    let l2_trust = L2Trust::new(&config);
    let l2_threat = L2Threat::new(signatures.clone());
    let l2_mcp = L2Mcp::new();
    let l4 = L4Tools::new(&config, signatures.clone())
        .map_err(|e| anyhow::anyhow!("L4 init: {}", e))?;
    let l5 = L5Sandbox::new(&config, e_stop.clone());
    let l3 = L3Intent::new(&config);
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

    // Broadcast channel for real-time telemetry streaming to /ws/telemetry clients.
    // Buffer 1024 events. Slow/absent subscribers receive RecvError::Lagged (not an error).
    let (broadcast_tx, _broadcast_rx) = broadcast::channel::<TelemetryEvent>(1024);

    // Build app state
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
        broadcast_tx,
    });

    // Build router
    let app = Router::new()
        .route("/", get(routes::landing_handler))
        .route("/live", get(routes::live_handler))
        .route("/ws/telemetry", get(routes::ws::ws_telemetry_handler))
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
