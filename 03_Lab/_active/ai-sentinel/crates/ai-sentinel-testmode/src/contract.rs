//! Wire types for the Onnex Armory HTTP Interface Contract v1.0.
//!
//! Serde shapes match §5.4 and §5.5 verbatim. Any additive change (new Category, new
//! Action) is backwards-compatible per contract §2 "additive-only schema changes".

use serde::{Deserialize, Serialize};

// ─── Header names ─────────────────────────────────────────────────────────────

pub const H_TRACE_ID: &str = "x-sentinel-trace-id";
pub const H_VERDICT: &str = "x-sentinel-verdict";
pub const H_STAGE: &str = "x-sentinel-stage";
pub const H_LATENCY_MS: &str = "x-sentinel-latency-ms";
pub const H_VERSION: &str = "x-sentinel-version";
pub const H_POLICY_VERSION: &str = "x-sentinel-policy-version";
pub const H_API_VERSION: &str = "x-sentinel-api-version";
pub const H_RULE: &str = "x-sentinel-rule";
pub const H_CONFIDENCE: &str = "x-sentinel-confidence";
pub const H_CATEGORY: &str = "x-sentinel-category";
pub const H_OWASP: &str = "x-sentinel-owasp";
pub const H_ACTION: &str = "x-sentinel-action";
pub const H_BYPASS: &str = "x-sentinel-bypass";
pub const H_TENANT: &str = "x-sentinel-tenant";

pub const ENVELOPE_CONTENT_TYPE: &str = "application/vnd.onnex-sentinel+json";
pub const API_VERSION: &str = "1.0";

// ─── Action vocabulary (contract §6.2) ────────────────────────────────────────

pub const ACTION_REFUSED_AT_INGRESS: &str = "refused_at_ingress";
pub const ACTION_REDACTED_AT_INGRESS: &str = "redacted_at_ingress";
pub const ACTION_REFRAMED_AT_INGRESS: &str = "reframed_at_ingress";
pub const ACTION_REFUSED_AT_EGRESS: &str = "refused_at_egress";
pub const ACTION_REDACTED_AT_EGRESS: &str = "redacted_at_egress";
pub const ACTION_TRUNCATED_AT_EGRESS: &str = "truncated_at_egress";
pub const ACTION_RATE_LIMITED: &str = "rate_limited";
pub const ACTION_BYPASSED: &str = "bypassed";
pub const ACTION_PASSTHROUGH: &str = "passthrough";

// ─── Verdict / Stage / Category enums ─────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Verdict {
    Allow,
    Block,
    Sanitize,
    Error,
    Bypass,
}

impl Verdict {
    pub fn as_header(&self) -> &'static str {
        match self {
            Verdict::Allow => "ALLOW",
            Verdict::Block => "BLOCK",
            Verdict::Sanitize => "SANITIZE",
            Verdict::Error => "ERROR",
            Verdict::Bypass => "BYPASS",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Stage {
    Ingress,
    Egress,
    Both,
    None,
}

impl Stage {
    pub fn as_header(&self) -> &'static str {
        match self {
            Stage::Ingress => "ingress",
            Stage::Egress => "egress",
            Stage::Both => "both",
            Stage::None => "none",
        }
    }
}

/// Closed set per contract §6.1. Unknown categories map to `Category::Unknown`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Category {
    PromptInjection,
    Jailbreak,
    SystemPromptExtraction,
    PiiLeakage,
    SecretLeakage,
    IndirectInjection,
    CostAmplification,
    Toxicity,
    Bias,
    OffTopic,
    PolicyViolation,
    Unknown,
}

impl Category {
    pub fn parse(s: &str) -> Self {
        match s {
            "prompt_injection" => Category::PromptInjection,
            "jailbreak" => Category::Jailbreak,
            "system_prompt_extraction" => Category::SystemPromptExtraction,
            "pii_leakage" => Category::PiiLeakage,
            "secret_leakage" => Category::SecretLeakage,
            "indirect_injection" => Category::IndirectInjection,
            "cost_amplification" => Category::CostAmplification,
            "toxicity" => Category::Toxicity,
            "bias" => Category::Bias,
            "off_topic" => Category::OffTopic,
            "policy_violation" => Category::PolicyViolation,
            _ => Category::Unknown,
        }
    }
    pub fn as_header(&self) -> &'static str {
        match self {
            Category::PromptInjection => "prompt_injection",
            Category::Jailbreak => "jailbreak",
            Category::SystemPromptExtraction => "system_prompt_extraction",
            Category::PiiLeakage => "pii_leakage",
            Category::SecretLeakage => "secret_leakage",
            Category::IndirectInjection => "indirect_injection",
            Category::CostAmplification => "cost_amplification",
            Category::Toxicity => "toxicity",
            Category::Bias => "bias",
            Category::OffTopic => "off_topic",
            Category::PolicyViolation => "policy_violation",
            Category::Unknown => "unknown",
        }
    }
}

// ─── Request / Response bodies ────────────────────────────────────────────────

/// POST /chat request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequestBody {
    pub message: String,
    #[serde(default)]
    pub upstream_mode: ChatUpstreamMode,
    /// Override the configured default upstream model (Armory / dashboard convenience).
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub system: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ChatUpstreamMode {
    /// Skip upstream; return a synthetic "this is what the LLM would have said" stub.
    #[default]
    Simulated,
    /// Forward to the configured upstream (OpenRouter).
    Live,
}

// ─── Envelope (contract §5.4/§5.5) ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Envelope {
    pub sentinel: SentinelMeta,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream: Option<UpstreamBody>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SentinelMeta {
    pub trace_id: String,
    pub verdict: Verdict,
    pub stage: Stage,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub action: Option<String>,
    pub latency_ms: u64,
    pub policy_version: String,
    pub api_version: String,
    pub sentinel_version: String,
    pub rules_matched: Vec<RuleMatchOut>,
    pub modifications: Vec<Modification>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explanation: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upstream_mode: Option<ChatUpstreamMode>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sentinel_mode: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub layers_ran: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleMatchOut {
    pub id: String,
    pub category: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub owasp: Option<String>,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub evidence_offset: Option<[usize; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Modification {
    pub stage: String, // "ingress" | "egress"
    #[serde(rename = "type")]
    pub ty: String, // "redact" | "rewrite" | "truncate"
    pub field: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<[usize; 2]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original: Option<String>,
    pub replacement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpstreamBody {
    pub response: String,
    pub model: String,
    #[serde(default)]
    pub tokens: u32,
}
