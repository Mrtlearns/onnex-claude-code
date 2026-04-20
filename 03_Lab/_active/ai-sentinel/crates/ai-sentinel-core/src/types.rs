use serde::{Deserialize, Serialize};
use uuid::Uuid;
use chrono::{DateTime, Utc};

// ─── Direction ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Direction {
    Ingress,
    Egress,
}

// ─── Caller Context ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CallerType {
    N8n,
    Temporal,
    Sdk,
    Unknown,
    /// Network-layer gateway: caller is identified by 5-tuple blake3 hash
    Network,
    /// OS process intercepted via eBPF/WFP agent
    Agent,
}

impl Default for CallerType {
    fn default() -> Self {
        CallerType::Unknown
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CallerContext {
    pub caller_id: String,
    #[serde(default)]
    pub caller_type: CallerType,
    pub api_key_hash: Option<String>,
    pub ip: Option<String>,
    pub trust_token: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
    /// Source IP address (gateway mode: extracted from CONNECT 5-tuple)
    pub source_ip: Option<String>,
    /// OS process name (agent mode: e.g. "cursor.exe pid=4812")
    pub process_name: Option<String>,
}

// ─── Tool Manifest ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolManifest {
    pub tool_name: String,
    pub tool_args: serde_json::Value,
    #[serde(default)]
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub role: Option<String>,
}

// ─── Layer Config Override ────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LayerConfig {
    pub enabled: Option<bool>,
    pub extra: Option<serde_json::Value>,
}

// ─── Check Request ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRequest {
    pub direction: Direction,
    pub payload: serde_json::Value,
    pub session_id: Option<String>,
    pub caller_context: CallerContext,
    pub tool_manifest: Option<ToolManifest>,
    pub config_override: Option<LayerConfig>,
}

// ─── Layer Result ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone)]
pub enum LayerResult {
    Pass,
    Reject {
        code: String,
        reason: String,
        severity: Severity,
    },
    Mutate {
        payload: serde_json::Value,
    },
}

// ─── Check Response ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CheckStatus {
    Pass,
    Reject,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectDetail {
    pub layer: String,
    pub code: String,
    pub reason: String,
    pub severity: Severity,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckResponse {
    pub status: CheckStatus,
    pub request_id: String,
    pub session_id: Option<String>,
    pub payload: Option<serde_json::Value>,
    pub reject: Option<RejectDetail>,
    pub latency_ms: u64,
    pub layers_ran: Vec<String>,
}

impl CheckResponse {
    pub fn pass(
        request_id: String,
        session_id: Option<String>,
        payload: serde_json::Value,
        latency_ms: u64,
        layers_ran: Vec<String>,
    ) -> Self {
        CheckResponse {
            status: CheckStatus::Pass,
            request_id,
            session_id,
            payload: Some(payload),
            reject: None,
            latency_ms,
            layers_ran,
        }
    }

    pub fn reject(
        request_id: String,
        session_id: Option<String>,
        detail: RejectDetail,
        latency_ms: u64,
        layers_ran: Vec<String>,
    ) -> Self {
        CheckResponse {
            status: CheckStatus::Reject,
            request_id,
            session_id,
            payload: None,
            reject: Some(detail),
            latency_ms,
            layers_ran,
        }
    }
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TelemetryRecord {
    pub request_id: String,
    pub session_id: Option<String>,
    pub direction: Option<String>,
    pub caller_id: Option<String>,
    pub model: Option<String>,
    pub provider: Option<String>,
    pub prompt_tokens: Option<u32>,
    pub completion_tokens: Option<u32>,
    pub cost_usd: Option<f64>,
    pub decision: Option<String>,
    pub reject_layer: Option<String>,
    pub reject_code: Option<String>,
    pub latency_ms: Option<u64>,
    pub layers_ran: Vec<String>,
    pub per_layer_ms: Vec<(String, u64)>,
    pub drift_score: Option<f64>,
    pub rate_counter: Option<u64>,
    pub timestamp: Option<DateTime<Utc>>,
}

// ─── Telemetry Event (broadcast / WebSocket) ─────────────────────────────────

/// Slim real-time event broadcast over the WebSocket telemetry channel.
/// One event per /check call — all connected /ws/telemetry clients receive it.
#[derive(Debug, Clone, Serialize)]
pub struct TelemetryEvent {
    pub request_id: String,
    pub direction: String,          // "ingress" | "egress"
    pub decision: String,           // "pass" | "reject"
    pub reject_layer: Option<String>,
    pub reject_code: Option<String>,
    pub latency_ms: u64,
    pub caller_id: String,
    pub layers_ran: Vec<String>,
    pub timestamp: i64,             // unix milliseconds
}

// ─── Audit Record ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditRecord {
    pub record_id: String,
    pub prev_hash: String,
    pub timestamp: DateTime<Utc>,
    pub payload_hash: String,
    pub record_hash: String,
    pub direction: String,
    pub decision: String,
    pub layer: Option<String>,
    pub code: Option<String>,
    pub caller_id: String,
    pub session_id: Option<String>,
}
