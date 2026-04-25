use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use axum::{
    middleware as axum_middleware,
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
use ai_sentinel_modules::{LicenseTier, PostgresModuleStore};
use ai_sentinel_rules::PolicyEngine;

mod auth_helpers;
mod bootstrap;
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

    // Optional Postgres — required for persistent audit, modules, context. Missing in
    // local dev mode is fine: we fall back to in-memory audit and skip module/context.
    let db = match std::env::var("AI_SENTINEL_DB_URL") {
        Ok(url) => match ai_sentinel_store::connect_and_migrate(&url).await {
            Ok(pool) => {
                info!("postgres connected + migrations applied");
                Some(pool)
            }
            Err(e) => {
                warn!(error = %e, "postgres unavailable — running in in-memory mode");
                None
            }
        },
        Err(_) => {
            warn!("AI_SENTINEL_DB_URL not set — running in in-memory mode");
            None
        }
    };

    // Initialize live signatures
    let signatures = LiveSignatures::new(SignatureSet::default());

    // Start feed worker
    let feed_worker = FeedWorker::new(signatures.clone(), config.clone());
    let feed_refresh_tx = feed_worker.spawn();

    // Initialize audit chain — Postgres-backed when the pool is available.
    let audit = match &db {
        Some(pool) => {
            match AuditChain::with_postgres(pool.clone()).await {
                Ok(c) => Arc::new(c),
                Err(e) => {
                    warn!(error = %e, "audit: postgres init failed — falling back to in-memory");
                    Arc::new(AuditChain::new())
                }
            }
        }
        None => Arc::new(AuditChain::new()),
    };

    // Module store & policy engine
    let module_store = match &db {
        Some(pool) => match PostgresModuleStore::new(pool.clone()).await {
            Ok(s) => Some(Arc::new(s)),
            Err(e) => {
                warn!(error = %e, "module store init failed — module admin API disabled");
                None
            }
        },
        None => None,
    };
    let policy_engine = Arc::new(PolicyEngine::new());
    let license_tier = LicenseTier::parse(
        &std::env::var("AI_SENTINEL_LICENSE_TIER").unwrap_or_else(|_| "enterprise".to_string()),
    );

    // Preseed + hot-load active rule modules into the policy engine.
    if let Some(ms) = module_store.as_ref() {
        if let Err(e) = bootstrap::preseed_if_empty(ms.as_ref()).await {
            warn!(error = %e, "bootstrap: preseed skipped");
        }
        if let Err(e) = bootstrap::load_active_into_engine(ms.as_ref(), &policy_engine).await {
            warn!(error = %e, "bootstrap: policy engine load failed");
        }
    }

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
    let l8 = ai_sentinel_optimizer::L8Optimizer::new(Default::default());

    let pipeline = Arc::new(
        Pipeline::new(vec![
            Arc::new(l1),
            Arc::new(l2_auth),
            Arc::new(l2_trust),
            Arc::new(l2_threat),
            Arc::new(l2_mcp),
            Arc::new(l8), // L8 optimizer: semantic cache + model routing (ingress)
            Arc::new(l3),
            Arc::new(l4),
            Arc::new(l5),
            Arc::new(l6),
        ])
        .with_policy(policy_engine.clone()),
    );

    // Broadcast channel for real-time telemetry streaming to /ws/telemetry clients.
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
        db: db.clone(),
        module_store,
        policy_engine,
        license_tier,
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
        .route("/dashboard", get(routes::dashboard_handler))
        .route("/dashboard/", get(routes::dashboard_handler))
        .route("/dashboard/ai-sentinel-dashboard.js", get(routes::dashboard_js_handler))
        .route("/dashboard/ai-sentinel-dashboard_bg.wasm", get(routes::dashboard_wasm_handler))
        .route("/dashboard-html", get(routes::dashboard_html_fallback_handler))
        .route("/docs", get(routes::docs_handler))
        .route("/presentation.pdf", get(routes::presentation_pdf_handler))
        .route("/admin/estop", post(routes::admin::estop_handler))
        .route("/admin/estop/lift", post(routes::admin::estop_lift_handler))
        .route("/admin/feed/refresh", post(routes::admin::feed_refresh_handler))
        .route("/admin/signatures", get(routes::admin::signatures_handler))
        .route("/admin/audit/verify", get(routes::admin::audit_verify_handler))
        // Phase 5 admin module CRUD
        .route("/admin/modules", get(routes::admin_modules::list_modules))
        .route("/admin/modules/:id", get(routes::admin_modules::get_module).put(routes::admin_modules::update_module).delete(routes::admin_modules::delete_module))
        .route("/admin/modules/:id/enable", post(routes::admin_modules::enable_module))
        .route("/admin/modules/:id/disable", post(routes::admin_modules::disable_module))
        .route("/admin/modules/:id/versions", get(routes::admin_modules::list_versions))
        .route("/admin/modules/:id/revert/:version", post(routes::admin_modules::revert_module))
        .route("/admin/modules/:id/audit", get(routes::admin_modules::module_audit))
        .route("/admin/rules/validate", post(routes::admin_modules::validate_rules_yaml))
        .route("/admin/rules/dry-run", post(routes::admin_modules::dry_run_rules))
        .route("/admin/preseed/refresh", post(routes::admin_modules::refresh_preseeds))
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            auth_helpers::admin_auth_middleware,
        ))
        .with_state(state.clone());

    // Phase 6 testmode — mounted only when the `testmode` cargo feature is on.
    // Production builds compile without it and these routes 404.
    #[cfg(feature = "testmode")]
    let app = {
        use ai_sentinel_testmode::{testmode_router, TestmodeState, TestmodeStateConfig};
        let upstream_url = std::env::var("AI_SENTINEL_UPSTREAM_URL")
            .unwrap_or_else(|_| "https://openrouter.ai/api".to_string());
        let upstream_api_key = std::env::var("AI_SENTINEL_UPSTREAM_API_KEY").ok();
        let upstream_default_model = std::env::var("AI_SENTINEL_UPSTREAM_MODEL")
            .unwrap_or_else(|_| "google/gemini-flash-1.5-8b".to_string());
        let tm = Arc::new(TestmodeState::new(TestmodeStateConfig {
            pipeline: state.pipeline.clone(),
            config: state.config.clone(),
            db: state.db.clone(),
            sentinel_version: env!("CARGO_PKG_VERSION"),
            upstream_url,
            upstream_api_key,
            upstream_default_model,
        }));
        info!("testmode enabled — /chat, /sentinel/*, /healthz, /readyz mounted");
        app.merge(testmode_router(tm))
    };

    let bind = format!("{}:{}", config.host, config.port);
    let listener = TcpListener::bind(&bind).await?;
    info!(bind = %bind, "listening");

    axum::serve(listener, app).await?;
    Ok(())
}
