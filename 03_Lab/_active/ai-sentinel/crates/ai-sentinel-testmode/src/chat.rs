//! POST /chat — the orchestrator.
//!
//! Flow:
//!   1. Resolve trace_id (honor incoming X-Sentinel-Trace-Id, else mint ULID)
//!   2. Resolve effective mode (bypass-if-admin wins over global mode)
//!   3. Ingress pipeline run — Block|Sanitize|Pass
//!   4. Upstream call (simulated or live) unless BYPASS
//!   5. Egress pipeline run on upstream response
//!   6. Assemble envelope + X-Sentinel-* headers
//!   7. Record trace
//!
//! All X-Sentinel-* headers are always emitted, even on BYPASS or transparent-mode ALLOW.

use crate::contract::*;
use crate::mode::{check_admin_token, SentinelMode};
use crate::state::TestmodeState;
use crate::trace::{new_trace_id, sanitize_external_trace_id, TraceRecord};
use ai_sentinel_core::{
    CallerContext, CheckRequest, CheckResponse, CheckStatus, Direction, LayerContext,
};
use axum::{
    extract::State,
    http::{header, HeaderMap, HeaderName, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Instant;
use tracing::{debug, info, warn};

pub async fn chat_handler(
    State(state): State<Arc<TestmodeState>>,
    headers: HeaderMap,
    Json(body): Json<ChatRequestBody>,
) -> Response {
    let start = Instant::now();

    // 1. Trace id
    let trace_id = headers
        .get(H_TRACE_ID)
        .and_then(|v| v.to_str().ok())
        .and_then(sanitize_external_trace_id)
        .unwrap_or_else(new_trace_id);

    // 2. Effective mode (admin + bypass-header wins over global)
    let bypass_header =
        header_str(&headers, H_BYPASS).map(|s| s.eq_ignore_ascii_case("true")).unwrap_or(false);
    let is_admin = check_admin_token(&state, extract_bearer(&headers));
    let global_mode = state.mode.read().mode;
    let effective_mode = if bypass_header && is_admin {
        SentinelMode::Bypass
    } else {
        global_mode
    };
    let envelope_mode = headers
        .get(header::ACCEPT)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.contains(ENVELOPE_CONTENT_TYPE))
        .unwrap_or(false);

    // 3. Ingress pipeline (skipped on BYPASS)
    let mut layers_ran: Vec<String> = Vec::new();
    let mut rules_matched: Vec<RuleMatchOut> = Vec::new();
    let mut modifications: Vec<Modification> = Vec::new();
    let mut explanation: Option<String> = None;
    let mut ingress_blocked: Option<(String, String)> = None; // (rule_name, code)
    let mut current_message = body.message.clone();

    if !matches!(effective_mode, SentinelMode::Bypass) {
        let req = build_check_request(Direction::Ingress, &current_message, &trace_id, &state.config);
        let mut ctx = LayerContext::new(trace_id.clone());
        let resp = state.pipeline.run(req, &mut ctx).await;
        for l in &resp.layers_ran {
            layers_ran.push(l.clone());
        }
        match resp.status {
            CheckStatus::Reject => {
                let detail = resp.reject.as_ref();
                let rule_name = detail.map(|d| rule_name_from_layer(&d.layer)).unwrap_or_else(|| "unknown".into());
                let code = detail.map(|d| d.code.clone()).unwrap_or_default();
                rules_matched.push(RuleMatchOut {
                    id: rule_name.clone(),
                    category: Category::Unknown.as_header().to_string(),
                    owasp: None,
                    confidence: 1.0,
                    evidence: None,
                    evidence_offset: None,
                });
                explanation = detail.map(|d| d.reason.clone());
                if matches!(effective_mode, SentinelMode::Full) {
                    // BLOCK at ingress: short-circuit, no upstream.
                    ingress_blocked = Some((rule_name, code));
                }
                // Observe mode: record but continue with original content.
            }
            CheckStatus::Pass => {
                // If the pipeline mutated the payload, reflect that as a redact modification.
                if let Some(p) = resp.payload.as_ref() {
                    if let Some(new_content) = extract_content(p) {
                        if new_content != current_message {
                            modifications.push(Modification {
                                stage: "ingress".into(),
                                ty: "redact".into(),
                                field: "prompt".into(),
                                offset: None,
                                original: Some(current_message.clone()),
                                replacement: new_content.clone(),
                            });
                            current_message = new_content;
                        }
                    }
                }
            }
        }
    }

    // Early BLOCK return (ingress) ───────────────────────────────────────────
    if let Some((rule, code)) = ingress_blocked {
        let latency = start.elapsed().as_millis() as u64;
        let meta = build_meta(
            &state,
            &trace_id,
            Verdict::Block,
            Stage::Ingress,
            Some(ACTION_REFUSED_AT_INGRESS.into()),
            latency,
            rules_matched.clone(),
            modifications.clone(),
            explanation.clone(),
            Some("We can't process that request. If you need help, please rephrase.".into()),
            Some(body.upstream_mode),
            effective_mode,
            layers_ran.clone(),
        )
        .await;
        let env = Envelope { sentinel: meta.clone(), upstream: None };
        record_trace(&state, &trace_id, &body, &env, &meta, rules_matched.first().map(|r| r.id.clone()), code);
        return emit_response(StatusCode::FORBIDDEN, envelope_mode, meta, env, None);
    }

    // 4. Upstream call
    let model = body
        .model
        .clone()
        .unwrap_or_else(|| state.default_model.clone());
    let upstream_result = state
        .upstream
        .call(body.upstream_mode, &model, body.system.as_deref(), &current_message)
        .await;
    let upstream_body = match upstream_result {
        Ok(u) => u,
        Err(e) => {
            warn!(trace_id, error = %e, "upstream call failed");
            let latency = start.elapsed().as_millis() as u64;
            let meta = build_meta(
                &state,
                &trace_id,
                Verdict::Error,
                Stage::None,
                None,
                latency,
                Vec::new(),
                Vec::new(),
                Some(format!("upstream error: {e}")),
                Some("Service temporarily unavailable".into()),
                Some(body.upstream_mode),
                effective_mode,
                layers_ran.clone(),
            )
            .await;
            let env = Envelope { sentinel: meta.clone(), upstream: None };
            record_trace(&state, &trace_id, &body, &env, &meta, None, "UPSTREAM_ERROR".into());
            return emit_response(StatusCode::BAD_GATEWAY, envelope_mode, meta, env, None);
        }
    };

    // 5. Egress pipeline on upstream response (skipped on BYPASS)
    let mut egress_blocked: Option<(String, String)> = None;
    let mut current_upstream = upstream_body.clone();

    if !matches!(effective_mode, SentinelMode::Bypass) {
        let req = build_check_request(Direction::Egress, &upstream_body.response, &trace_id, &state.config);
        let mut ctx = LayerContext::new(trace_id.clone());
        let resp = state.pipeline.run(req, &mut ctx).await;
        for l in &resp.layers_ran {
            layers_ran.push(l.clone());
        }
        match resp.status {
            CheckStatus::Reject => {
                let detail = resp.reject.as_ref();
                let rule_name = detail.map(|d| rule_name_from_layer(&d.layer)).unwrap_or_else(|| "unknown".into());
                let code = detail.map(|d| d.code.clone()).unwrap_or_default();
                rules_matched.push(RuleMatchOut {
                    id: rule_name.clone(),
                    category: Category::Unknown.as_header().to_string(),
                    owasp: None,
                    confidence: 1.0,
                    evidence: None,
                    evidence_offset: None,
                });
                if explanation.is_none() {
                    explanation = detail.map(|d| d.reason.clone());
                }
                if matches!(effective_mode, SentinelMode::Full) {
                    egress_blocked = Some((rule_name, code));
                }
            }
            CheckStatus::Pass => {
                if let Some(p) = resp.payload.as_ref() {
                    if let Some(new_content) = extract_content(p) {
                        if new_content != upstream_body.response {
                            modifications.push(Modification {
                                stage: "egress".into(),
                                ty: "redact".into(),
                                field: "response".into(),
                                offset: None,
                                original: Some(upstream_body.response.clone()),
                                replacement: new_content.clone(),
                            });
                            current_upstream.response = new_content;
                        }
                    }
                }
            }
        }
    }

    // Early BLOCK return (egress)
    if let Some((rule, code)) = egress_blocked {
        let latency = start.elapsed().as_millis() as u64;
        let meta = build_meta(
            &state,
            &trace_id,
            Verdict::Block,
            Stage::Egress,
            Some(ACTION_REFUSED_AT_EGRESS.into()),
            latency,
            rules_matched.clone(),
            modifications.clone(),
            explanation.clone(),
            Some("Response withheld by safety policy.".into()),
            Some(body.upstream_mode),
            effective_mode,
            layers_ran.clone(),
        )
        .await;
        let env = Envelope { sentinel: meta.clone(), upstream: None };
        record_trace(&state, &trace_id, &body, &env, &meta, Some(rule), code);
        return emit_response(StatusCode::FORBIDDEN, envelope_mode, meta, env, None);
    }

    // 6. Decide final verdict
    let latency = start.elapsed().as_millis() as u64;
    let (verdict, stage, action) = if matches!(effective_mode, SentinelMode::Bypass) {
        (Verdict::Bypass, Stage::None, Some(ACTION_BYPASSED.into()))
    } else if !modifications.is_empty() {
        let stage = if modifications.iter().any(|m| m.stage == "ingress")
            && modifications.iter().any(|m| m.stage == "egress")
        {
            Stage::Both
        } else if modifications.iter().any(|m| m.stage == "ingress") {
            Stage::Ingress
        } else {
            Stage::Egress
        };
        let action = if stage == Stage::Egress {
            ACTION_REDACTED_AT_EGRESS
        } else {
            ACTION_REDACTED_AT_INGRESS
        };
        (Verdict::Sanitize, stage, Some(action.into()))
    } else if !rules_matched.is_empty() && matches!(effective_mode, SentinelMode::Observe) {
        // Observe: a rule would have fired but we didn't enforce.
        (Verdict::Allow, Stage::None, Some(ACTION_PASSTHROUGH.into()))
    } else {
        (Verdict::Allow, Stage::None, Some(ACTION_PASSTHROUGH.into()))
    };

    let meta = build_meta(
        &state,
        &trace_id,
        verdict,
        stage,
        action,
        latency,
        rules_matched.clone(),
        modifications.clone(),
        explanation.clone(),
        None,
        Some(body.upstream_mode),
        effective_mode,
        layers_ran.clone(),
    )
    .await;
    let env = Envelope {
        sentinel: meta.clone(),
        upstream: Some(current_upstream.clone()),
    };
    record_trace(
        &state,
        &trace_id,
        &body,
        &env,
        &meta,
        rules_matched.first().map(|r| r.id.clone()),
        String::new(),
    );
    emit_response(StatusCode::OK, envelope_mode, meta, env, Some(current_upstream))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn header_str<'a>(h: &'a HeaderMap, name: &str) -> Option<&'a str> {
    h.get(name).and_then(|v| v.to_str().ok())
}

fn extract_bearer(h: &HeaderMap) -> &str {
    h.get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("")
}

fn extract_content(v: &Value) -> Option<String> {
    v.get("content")
        .and_then(|c| c.as_str())
        .map(str::to_string)
        .or_else(|| v.get("response").and_then(|c| c.as_str()).map(str::to_string))
}

/// Rule names come out of the pipeline encoded in `layer` as `policy:rule_name`.
fn rule_name_from_layer(layer: &str) -> String {
    layer
        .strip_prefix("policy:")
        .unwrap_or(layer)
        .to_string()
}

fn build_check_request(
    direction: Direction,
    content: &str,
    trace_id: &str,
    config: &ai_sentinel_core::AppConfig,
) -> CheckRequest {
    // Testmode is admin-token-authenticated at the HTTP layer. Inside the pipeline we
    // present as an authenticated caller by borrowing the first configured api_key_hash —
    // this satisfies L2_Auth without giving testmode privileged bypass of the security
    // layers it exists to exercise. If api_keys is empty, L2_Auth is in dev-open mode.
    let api_key_hash = config.api_keys.first().cloned();
    CheckRequest {
        direction,
        payload: json!({ "content": content }),
        session_id: Some(trace_id.to_string()),
        caller_context: CallerContext {
            caller_id: format!("testmode:{trace_id}"),
            api_key_hash,
            ..Default::default()
        },
        tool_manifest: None,
        config_override: None,
    }
}

#[allow(clippy::too_many_arguments)]
async fn build_meta(
    state: &TestmodeState,
    trace_id: &str,
    verdict: Verdict,
    stage: Stage,
    action: Option<String>,
    latency_ms: u64,
    rules_matched: Vec<RuleMatchOut>,
    modifications: Vec<Modification>,
    explanation: Option<String>,
    client_message: Option<String>,
    upstream_mode: Option<ChatUpstreamMode>,
    sentinel_mode: SentinelMode,
    layers_ran: Vec<String>,
) -> SentinelMeta {
    let policy_version = crate::policy::compute_policy_version(state).await;
    SentinelMeta {
        trace_id: trace_id.to_string(),
        verdict,
        stage,
        action,
        latency_ms,
        policy_version,
        api_version: API_VERSION.into(),
        sentinel_version: state.sentinel_version.into(),
        rules_matched,
        modifications,
        explanation,
        client_message,
        upstream_mode,
        sentinel_mode: Some(sentinel_mode.as_str().into()),
        layers_ran,
    }
}

fn emit_response(
    status: StatusCode,
    envelope_mode: bool,
    meta: SentinelMeta,
    env: Envelope,
    transparent_body: Option<UpstreamBody>,
) -> Response {
    let mut resp: Response = if envelope_mode {
        (status, Json(env.clone())).into_response()
    } else if status == StatusCode::OK {
        // Transparent: return the upstream body directly (verbatim).
        let body = transparent_body.unwrap_or_else(|| UpstreamBody {
            response: String::new(),
            model: "none".into(),
            tokens: 0,
        });
        (status, Json(body)).into_response()
    } else {
        // Block / Error always emits envelope shape — the client needs the reasons.
        (status, Json(env.clone())).into_response()
    };

    let h = resp.headers_mut();
    set_h(h, H_TRACE_ID, &meta.trace_id);
    set_h(h, H_VERDICT, meta.verdict.as_header());
    set_h(h, H_STAGE, meta.stage.as_header());
    set_h(h, H_LATENCY_MS, &meta.latency_ms.to_string());
    set_h(h, H_VERSION, &meta.sentinel_version);
    set_h(h, H_POLICY_VERSION, &meta.policy_version);
    set_h(h, H_API_VERSION, &meta.api_version);
    if let Some(a) = &meta.action {
        set_h(h, H_ACTION, a);
    }
    if let Some(top) = meta.rules_matched.first() {
        set_h(h, H_RULE, &top.id);
        set_h(h, H_CONFIDENCE, &format!("{:.2}", top.confidence));
        set_h(h, H_CATEGORY, &top.category);
        if let Some(o) = &top.owasp {
            set_h(h, H_OWASP, o);
        }
    }

    if envelope_mode {
        h.insert(
            header::CONTENT_TYPE,
            HeaderValue::from_static(ENVELOPE_CONTENT_TYPE),
        );
    }

    resp
}

fn set_h(h: &mut HeaderMap, name: &str, value: &str) {
    if let (Ok(n), Ok(v)) = (HeaderName::try_from(name), HeaderValue::from_str(value)) {
        h.insert(n, v);
    }
}

fn record_trace(
    state: &TestmodeState,
    trace_id: &str,
    body: &ChatRequestBody,
    env: &Envelope,
    meta: &SentinelMeta,
    rule: Option<String>,
    _code: String,
) {
    let upstream_mode = match body.upstream_mode {
        ChatUpstreamMode::Simulated => "simulated".to_string(),
        ChatUpstreamMode::Live => "live".to_string(),
    };
    let rec = TraceRecord {
        trace_id: trace_id.to_string(),
        timestamp: Utc::now(),
        verdict: meta.verdict,
        stage: meta.stage,
        action: meta.action.clone(),
        category: meta.rules_matched.first().map(|r| r.category.clone()),
        rule,
        latency_ms: meta.latency_ms,
        upstream_mode,
        sentinel_mode: meta.sentinel_mode.clone().unwrap_or_default(),
        request_message: body.message.clone(),
        envelope: env.clone(),
    };
    debug!(trace_id, verdict = ?meta.verdict, "recording trace");
    state.traces.push(rec);
    info!(trace_id, verdict = meta.verdict.as_header(), latency_ms = meta.latency_ms, "chat handled");
}
