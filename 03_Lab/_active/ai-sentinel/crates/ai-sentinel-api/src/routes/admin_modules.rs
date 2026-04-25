//! Admin CRUD for `Module` entities — rules, optimizer, context-bank.
//!
//! All endpoints require the admin Bearer token. Mutating endpoints also accept an
//! `If-Match` header carrying the current `version` integer for optimistic concurrency;
//! mismatched values return 412.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::warn;

use crate::auth_helpers::verify_admin;
use crate::routes::AppState;
use ai_sentinel_modules::{ModuleKind, ModuleStore, ModuleUpdate};
use ai_sentinel_rules::{compile_yaml, dsl::Trigger, evaluator::RuleContext, PolicyEngine};

// ─── Auth ────────────────────────────────────────────────────────────────────

fn auth_or_401(state: &AppState, headers: &HeaderMap) -> Option<(StatusCode, Json<Value>)> {
    if !verify_admin(&state.config, headers) {
        warn!("admin_modules: no valid Bearer or Basic credentials");
        return Some((StatusCode::UNAUTHORIZED, Json(json!({"error": "unauthorized"}))));
    }
    None
}

fn store_or_503(state: &AppState) -> Result<&Arc<ai_sentinel_modules::PostgresModuleStore>, (StatusCode, Json<Value>)> {
    state.module_store.as_ref().ok_or((
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({"error": "module_store_unavailable", "hint": "AI_SENTINEL_DB_URL not configured"})),
    ))
}

fn actor_from_headers(headers: &HeaderMap) -> String {
    headers
        .get("x-actor")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("admin")
        .to_string()
}

// ─── Handlers ────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ListQuery {
    pub kind: Option<String>,
}

pub async fn list_modules(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(q): Query<ListQuery>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let filter = q.kind.as_deref().and_then(ModuleKind::parse);
    let modules = match store.list(filter).await {
        Ok(m) => m,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    };
    let visible: Vec<_> = modules
        .into_iter()
        .filter(|m| state.license_tier.covers(m.license_tier))
        .collect();
    (StatusCode::OK, Json(json!({ "modules": visible })))
}

pub async fn get_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    match store.get(id).await {
        Ok(m) => {
            if !state.license_tier.covers(m.license_tier) {
                return (StatusCode::FORBIDDEN, Json(json!({"error": "license_tier_insufficient"})));
            }
            let yaml = store.current_config_yaml(id).await.ok();
            (StatusCode::OK, Json(json!({ "module": m, "config_yaml": yaml })))
        }
        Err(e) => (StatusCode::NOT_FOUND, Json(json!({"error": e.to_string()}))),
    }
}

#[derive(Deserialize)]
pub struct UpdateBody {
    pub config_yaml: String,
    pub description: Option<String>,
}

pub async fn update_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
    Json(body): Json<UpdateBody>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };

    // Expect If-Match: <version> for optimistic concurrency.
    let expected_version: i32 = match headers
        .get("if-match")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.parse().ok())
    {
        Some(v) => v,
        None => return (
            StatusCode::PRECONDITION_REQUIRED,
            Json(json!({"error": "If-Match header required with current version"})),
        ),
    };

    // Pre-compile to reject invalid YAML before writing a new version.
    if let Err(e) = compile_yaml(&body.config_yaml) {
        return (StatusCode::BAD_REQUEST, Json(json!({"error": "compile", "detail": e.to_string()})));
    }

    let actor = actor_from_headers(&headers);
    let updated = match store
        .update_config(
            &actor,
            id,
            ModuleUpdate {
                config_yaml: body.config_yaml.clone(),
                description: body.description.clone(),
                expected_version,
            },
        )
        .await
    {
        Ok(m) => m,
        Err(ai_sentinel_modules::store::ModuleStoreError::VersionConflict { expected, found }) => {
            return (
                StatusCode::PRECONDITION_FAILED,
                Json(json!({"error": "version_conflict", "expected": expected, "found": found})),
            );
        }
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    };

    // Hot-reload the engine if this is a rules module.
    if matches!(updated.kind, ModuleKind::Rules) {
        let _ = state.policy_engine.load_or_replace(
            updated.id,
            updated.name.clone(),
            updated.enabled,
            &body.config_yaml,
        );
    }

    (StatusCode::OK, Json(json!({ "module": updated })))
}

pub async fn enable_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    set_enabled_impl(state, headers, id, true).await
}

pub async fn disable_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    set_enabled_impl(state, headers, id, false).await
}

async fn set_enabled_impl(
    state: Arc<AppState>,
    headers: HeaderMap,
    id: i64,
    enabled: bool,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let actor = actor_from_headers(&headers);
    match store.set_enabled(&actor, id, enabled).await {
        Ok(m) => {
            if matches!(m.kind, ModuleKind::Rules) {
                state.policy_engine.set_enabled(m.id, enabled);
            }
            (StatusCode::OK, Json(json!({ "module": m })))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({"error": e.to_string()}))),
    }
}

pub async fn delete_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let actor = actor_from_headers(&headers);
    match store.delete(&actor, id).await {
        Ok(()) => {
            state.policy_engine.remove(id);
            (StatusCode::OK, Json(json!({"status": "deleted"})))
        }
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    }
}

pub async fn list_versions(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    match store.versions(id).await {
        Ok(v) => (StatusCode::OK, Json(json!({"versions": v}))),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    }
}

pub async fn revert_module(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path((id, version)): Path<(i64, i32)>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let actor = actor_from_headers(&headers);
    match store.revert(&actor, id, version).await {
        Ok(m) => {
            // Hot-reload after revert
            if matches!(m.kind, ModuleKind::Rules) {
                if let Ok(yaml) = store.current_config_yaml(m.id).await {
                    let _ = state
                        .policy_engine
                        .load_or_replace(m.id, m.name.clone(), m.enabled, &yaml);
                }
            }
            (StatusCode::OK, Json(json!({"module": m})))
        }
        Err(e) => (StatusCode::BAD_REQUEST, Json(json!({"error": e.to_string()}))),
    }
}

pub async fn module_audit(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<i64>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let pool = match state.db.as_ref() {
        Some(p) => p,
        None => return (StatusCode::SERVICE_UNAVAILABLE, Json(json!({"error": "db_unavailable"}))),
    };
    use sqlx::Row;
    let rows = match sqlx::query(
        "SELECT id, action, actor, \"timestamp\", before_version, after_version, diff_json, record_hash \
         FROM module_audit WHERE module_id = $1 ORDER BY id DESC LIMIT 100",
    )
    .bind(id)
    .fetch_all(pool)
    .await
    {
        Ok(r) => r,
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"error": e.to_string()}))),
    };
    let entries: Vec<Value> = rows
        .into_iter()
        .map(|r| {
            json!({
                "id": r.try_get::<i64, _>("id").unwrap_or_default(),
                "action": r.try_get::<String, _>("action").unwrap_or_default(),
                "actor": r.try_get::<String, _>("actor").unwrap_or_default(),
                "timestamp": r.try_get::<chrono::DateTime<chrono::Utc>, _>("timestamp").ok(),
                "before_version": r.try_get::<Option<i32>, _>("before_version").ok().flatten(),
                "after_version": r.try_get::<Option<i32>, _>("after_version").ok().flatten(),
                "diff_json": r.try_get::<Option<Value>, _>("diff_json").ok().flatten(),
                "record_hash": r.try_get::<String, _>("record_hash").unwrap_or_default(),
            })
        })
        .collect();
    let _ = store; // keep `store` referenced so the borrow-checker is happy if unused later
    (StatusCode::OK, Json(json!({"audit": entries})))
}

// ─── YAML validate + dry-run ─────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ValidateBody {
    pub yaml: String,
}

pub async fn validate_rules_yaml(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<ValidateBody>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    match compile_yaml(&body.yaml) {
        Ok(set) => (
            StatusCode::OK,
            Json(json!({
                "ok": true,
                "module": set.module,
                "version": set.version,
                "rules": set.rules.len(),
                "rule_errors": set.errors,
            })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": e.to_string()})),
        ),
    }
}

#[derive(Deserialize)]
pub struct DryRunBody {
    pub yaml: String,
    pub trigger: String,
    pub content: String,
}

#[derive(Serialize)]
struct DryRunResult {
    rule: String,
    actions: usize,
}

/// POST /admin/preseed/refresh — re-syncs every preseed module from on-disk YAMLs in
/// `config/modules/`. Used after editing the shipped rule sets. Existing modules get a
/// new version (preserves audit chain); missing ones are created. Hot-reloads the
/// PolicyEngine for any updated rules-kind module.
pub async fn refresh_preseeds(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let store = match store_or_503(&state) {
        Ok(s) => s,
        Err(e) => return e,
    };
    let actor = actor_from_headers(&headers);
    match crate::bootstrap::resync_preseeds(store.as_ref(), &actor).await {
        Ok((updated, created)) => {
            // Hot-reload all rules-kind modules into the engine.
            let _ = crate::bootstrap::load_active_into_engine(store.as_ref(), &state.policy_engine).await;
            (
                StatusCode::OK,
                Json(json!({"updated": updated, "created": created, "actor": actor})),
            )
        }
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": e.to_string()})),
        ),
    }
}

pub async fn dry_run_rules(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(body): Json<DryRunBody>,
) -> (StatusCode, Json<Value>) {
    if let Some(resp) = auth_or_401(&state, &headers) {
        return resp;
    }
    let set = match compile_yaml(&body.yaml) {
        Ok(s) => s,
        Err(e) => return (StatusCode::BAD_REQUEST, Json(json!({"error": e.to_string()}))),
    };

    let trigger = match body.trigger.as_str() {
        "prompt_ingress" => Trigger::PromptIngress,
        "prompt_egress" => Trigger::PromptEgress,
        "tool_call" => Trigger::ToolCall,
        "session_start" => Trigger::SessionStart,
        "session_end" => Trigger::SessionEnd,
        "cost_threshold" => Trigger::CostThreshold,
        "token_budget_exceeded" => Trigger::TokenBudgetExceeded,
        _ => return (StatusCode::BAD_REQUEST, Json(json!({"error": "unknown trigger"}))),
    };

    let engine = PolicyEngine::new();
    let _ = engine.load_or_replace(0, set.module.clone(), true, &body.yaml);
    let ctx = RuleContext {
        trigger: Some(trigger),
        content: body.content.as_str(),
        intents: &[],
        pii_categories: &[],
        cost_usd: 0.0,
        tokens_used: 0,
        caller_roles: &[],
        now_minutes_utc: 0,
    };
    let decision = engine.evaluate_all(trigger, &ctx);

    let matches: Vec<DryRunResult> = decision
        .matches
        .iter()
        .map(|m| DryRunResult {
            rule: m.rule_name.clone(),
            actions: m.actions.len(),
        })
        .collect();

    (StatusCode::OK, Json(json!({
        "matched_rules": matches,
        "top_action": decision.top_action.as_ref().map(|a| match a {
            ai_sentinel_rules::dsl::ActionSpec::Reject(_) => "reject",
            ai_sentinel_rules::dsl::ActionSpec::Allow => "allow",
            ai_sentinel_rules::dsl::ActionSpec::Warn { .. } => "warn",
            ai_sentinel_rules::dsl::ActionSpec::Redact(_) => "redact",
            ai_sentinel_rules::dsl::ActionSpec::Rewrite(_) => "rewrite",
            ai_sentinel_rules::dsl::ActionSpec::RateLimit { .. } => "rate_limit",
            ai_sentinel_rules::dsl::ActionSpec::RouteToModel(_) => "route_to_model",
            ai_sentinel_rules::dsl::ActionSpec::ForwardToReviewQueue { .. } => "forward_to_review_queue",
            ai_sentinel_rules::dsl::ActionSpec::RunLayer { .. } => "run_layer",
        }),
    })))
}
