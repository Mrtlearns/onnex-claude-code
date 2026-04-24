//! ULID trace IDs + in-memory ring buffer for /sentinel/traces listings.

use crate::contract::{Envelope, Stage, Verdict};
use crate::state::TestmodeState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::VecDeque;
use std::sync::Arc;
use ulid::Ulid;

/// Mint a fresh ULID (26-char base32, sortable by time).
pub fn new_trace_id() -> String {
    Ulid::new().to_string()
}

/// Try to reuse an externally-supplied trace id — validates it looks like a ULID.
pub fn sanitize_external_trace_id(s: &str) -> Option<String> {
    if s.len() == 26 && s.chars().all(|c| c.is_ascii_alphanumeric()) {
        Some(s.to_string())
    } else {
        None
    }
}

/// One row in the ring buffer. Stores the envelope + request echo so the dashboard can
/// replay the full chain-of-reason without needing a DB query.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraceRecord {
    pub trace_id: String,
    pub timestamp: DateTime<Utc>,
    pub verdict: Verdict,
    pub stage: Stage,
    pub action: Option<String>,
    pub category: Option<String>,
    pub rule: Option<String>,
    pub latency_ms: u64,
    pub upstream_mode: String,
    pub sentinel_mode: String,
    pub request_message: String,
    pub envelope: Envelope,
}

pub struct TraceStore {
    inner: RwLock<VecDeque<TraceRecord>>,
    cap: usize,
}

impl TraceStore {
    pub fn new(cap: usize) -> Self {
        Self {
            inner: RwLock::new(VecDeque::with_capacity(cap)),
            cap,
        }
    }

    pub fn push(&self, rec: TraceRecord) {
        let mut q = self.inner.write();
        if q.len() == self.cap {
            q.pop_front();
        }
        q.push_back(rec);
    }

    pub fn list(&self, limit: usize, filter: &TraceFilter) -> Vec<TraceRecord> {
        let q = self.inner.read();
        q.iter()
            .rev()
            .filter(|r| filter.matches(r))
            .take(limit)
            .cloned()
            .collect()
    }

    pub fn get(&self, trace_id: &str) -> Option<TraceRecord> {
        self.inner
            .read()
            .iter()
            .rev()
            .find(|r| r.trace_id == trace_id)
            .cloned()
    }
}

#[derive(Debug, Default)]
pub struct TraceFilter {
    pub verdict: Option<String>,
    pub category: Option<String>,
    pub rule: Option<String>,
}

impl TraceFilter {
    pub fn matches(&self, r: &TraceRecord) -> bool {
        if let Some(v) = &self.verdict {
            if v.to_ascii_uppercase() != r.verdict.as_header() {
                return false;
            }
        }
        if let Some(c) = &self.category {
            if r.category.as_deref() != Some(c.as_str()) {
                return false;
            }
        }
        if let Some(name) = &self.rule {
            if r.rule.as_deref() != Some(name.as_str()) {
                return false;
            }
        }
        true
    }
}

// ─── Handlers ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct ListQuery {
    #[serde(default = "default_limit")]
    pub limit: usize,
    pub verdict: Option<String>,
    pub category: Option<String>,
    pub rule: Option<String>,
}

fn default_limit() -> usize {
    50
}

pub async fn list_traces_handler(
    State(state): State<Arc<TestmodeState>>,
    axum::extract::Query(q): axum::extract::Query<ListQuery>,
) -> (StatusCode, Json<Value>) {
    let filter = TraceFilter {
        verdict: q.verdict,
        category: q.category,
        rule: q.rule,
    };
    let limit = q.limit.min(state.traces.cap);
    let traces = state.traces.list(limit, &filter);
    (StatusCode::OK, Json(json!({ "traces": traces })))
}

pub async fn get_trace_handler(
    State(state): State<Arc<TestmodeState>>,
    Path(trace_id): Path<String>,
) -> (StatusCode, Json<Value>) {
    match state.traces.get(&trace_id) {
        Some(r) => (StatusCode::OK, Json(json!({ "trace": r }))),
        None => (StatusCode::NOT_FOUND, Json(json!({"error":"not_found"}))),
    }
}
