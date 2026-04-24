//! GET /sentinel/policy — stable version string plus the list of enabled rule categories.

use crate::contract::API_VERSION;
use crate::state::TestmodeState;
use axum::{extract::State, http::StatusCode, Json};
use chrono::{DateTime, Utc};
use serde_json::{json, Value};
use sqlx::Row;
use std::sync::Arc;

/// Returns `{policy_version, api_version, sentinel_version, rule_categories_enabled}`.
/// No auth — Armory reads this to label test runs.
pub async fn get_policy_handler(
    State(state): State<Arc<TestmodeState>>,
) -> (StatusCode, Json<Value>) {
    let policy_version = compute_policy_version(&state).await;
    let rule_categories = rule_categories_enabled(&state).await;
    (
        StatusCode::OK,
        Json(json!({
            "policy_version": policy_version,
            "api_version": API_VERSION,
            "sentinel_version": state.sentinel_version,
            "rule_categories_enabled": rule_categories,
        })),
    )
}

/// `{YYYY.MM.DD}-r{N}` where date = latest module_audit timestamp and N = count of
/// distinct record_hash values that day. Falls back to the binary build date.
pub async fn compute_policy_version(state: &TestmodeState) -> String {
    if let Some(pool) = state.db.as_ref() {
        if let Ok(row) = sqlx::query(
            r#"SELECT MAX("timestamp") AS latest,
                      COUNT(DISTINCT record_hash) FILTER (WHERE "timestamp"::date = (SELECT MAX("timestamp")::date FROM module_audit)) AS rev_count
               FROM module_audit"#,
        )
        .fetch_one(pool)
        .await
        {
            let latest: Option<DateTime<Utc>> = row.try_get("latest").ok();
            let rev_count: Option<i64> = row.try_get("rev_count").ok();
            if let (Some(ts), Some(n)) = (latest, rev_count) {
                return format!("{}-r{}", ts.format("%Y.%m.%d"), n.max(1));
            }
        }
    }
    // No DB or empty chain — synthesize from compile time.
    format!("{}-r1", chrono::Utc::now().format("%Y.%m.%d"))
}

async fn rule_categories_enabled(state: &TestmodeState) -> Vec<String> {
    // Until we expose the PolicyEngine directly, return the closed-set canonical category
    // list from the contract §6.1; in a follow-up we'll query the engine for actually-loaded ones.
    let _ = state;
    vec![
        "prompt_injection".into(),
        "jailbreak".into(),
        "system_prompt_extraction".into(),
        "pii_leakage".into(),
        "secret_leakage".into(),
        "indirect_injection".into(),
        "cost_amplification".into(),
        "toxicity".into(),
        "bias".into(),
        "off_topic".into(),
        "policy_violation".into(),
    ]
}
