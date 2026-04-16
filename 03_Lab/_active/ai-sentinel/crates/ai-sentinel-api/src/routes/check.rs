use axum::{extract::State, Json};
use std::sync::Arc;
use uuid::Uuid;
use tracing::{info, debug};
use chrono::Utc;

use ai_sentinel_core::{CheckRequest, CheckResponse, CheckStatus, LayerContext, SessionStore, TelemetryEvent};
use crate::routes::AppState;

pub async fn check_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CheckRequest>,
) -> Json<CheckResponse> {
    let request_id = Uuid::new_v4().to_string();
    let session_id = req.session_id.clone();
    let caller_id = req.caller_context.caller_id.clone();

    debug!(
        request_id = %request_id,
        direction = ?req.direction,
        caller = %caller_id,
        "check request"
    );

    // Build layer context
    let mut ctx = LayerContext::new(request_id.clone());

    // Attach session if session_id provided
    if let Some(ref sid) = session_id {
        match state.store.get(sid, &caller_id).await {
            Ok(handle) => ctx.session = Some(handle),
            Err(e) => tracing::warn!("session load error: {}", e),
        }
    }

    // Run pipeline
    let resp = state.pipeline.run(req.clone(), &mut ctx).await;

    // Write audit record async
    let decision = if resp.status == CheckStatus::Pass { "pass" } else { "reject" };
    let layer = resp.reject.as_ref().map(|r| r.layer.as_str());
    let code = resp.reject.as_ref().map(|r| r.code.as_str());
    let payload_json = serde_json::to_string(&req.payload).unwrap_or_default();
    state.audit.write(
        &request_id,
        &format!("{:?}", req.direction).to_lowercase(),
        decision,
        layer,
        code,
        &caller_id,
        session_id.as_deref(),
        &payload_json,
    );

    // Update metrics
    state.metrics.requests_total.inc();
    state.metrics.latency_ms.observe(resp.latency_ms as f64);
    state.metrics.audit_chain_length.set(state.audit.record_count() as i64);

    // Fire telemetry broadcast — non-blocking, silent noop if no subscribers
    let event = TelemetryEvent {
        request_id: resp.request_id.clone(),
        direction: format!("{:?}", req.direction).to_lowercase(),
        decision: if resp.status == CheckStatus::Pass { "pass".to_string() } else { "reject".to_string() },
        reject_layer: resp.reject.as_ref().map(|r| r.layer.clone()),
        reject_code: resp.reject.as_ref().map(|r| r.code.clone()),
        latency_ms: resp.latency_ms,
        caller_id: caller_id.clone(),
        layers_ran: resp.layers_ran.clone(),
        timestamp: Utc::now().timestamp_millis(),
    };
    let _ = state.broadcast_tx.send(event);

    info!(
        request_id = %request_id,
        status = ?resp.status,
        latency_ms = resp.latency_ms,
        layers = resp.layers_ran.len(),
        "check complete"
    );

    Json(resp)
}
