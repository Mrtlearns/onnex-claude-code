//! YAML DSL — the AST types users write rules in.
//!
//! These are plain serde types; `compiler` transforms them into an executable form.

use serde::{Deserialize, Serialize};

/// Top-level rule set — parsed from YAML.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleSet {
    pub module: String,
    #[serde(default = "default_version")]
    pub version: u32,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_tier")]
    pub license_tier: String,
    pub rules: Vec<Rule>,
}

fn default_version() -> u32 { 1 }
fn default_tier() -> String { "basic".to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rule {
    pub name: String,
    pub trigger: Trigger,
    #[serde(default = "default_priority")]
    pub priority: i32,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default = "default_true")]
    pub enabled: bool,
    pub conditions: ConditionBlock,
    pub actions: Vec<ActionSpec>,
}

fn default_priority() -> i32 { 50 }
fn default_true() -> bool { true }

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Trigger {
    PromptIngress,
    PromptEgress,
    ToolCall,
    SessionStart,
    SessionEnd,
    CostThreshold,
    TokenBudgetExceeded,
}

impl Trigger {
    pub fn as_str(&self) -> &'static str {
        match self {
            Trigger::PromptIngress => "prompt_ingress",
            Trigger::PromptEgress => "prompt_egress",
            Trigger::ToolCall => "tool_call",
            Trigger::SessionStart => "session_start",
            Trigger::SessionEnd => "session_end",
            Trigger::CostThreshold => "cost_threshold",
            Trigger::TokenBudgetExceeded => "token_budget_exceeded",
        }
    }
}

/// Condition grouping — either an `any_of` or `all_of` block of leaf conditions.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum ConditionBlock {
    AnyOf { any_of: Vec<Condition> },
    AllOf { all_of: Vec<Condition> },
    // Single leaf shorthand: `conditions: { regex: "..." }`
    Leaf(Condition),
}

/// Leaf condition predicates. Each maps to a boolean check at evaluation time.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum Condition {
    /// Simple regex on the request content.
    Regex(String),
    /// Regex with a named capture group (used by redact actions to scope the replacement).
    RegexNamedCapture { pattern: String, group: String },
    /// Intent category — matched against classifier output when available.
    Intent { category: String, #[serde(default)] confidence_gte: f32 },
    /// PII category present in the content.
    PiiCategory(String),
    /// Accumulated USD cost threshold.
    CostGt(f64),
    /// Tokens emitted so far exceed threshold.
    TokensGt(u32),
    /// Caller has a specific role claim.
    CallerRole(String),
    /// Time-of-day window, inclusive. Values like "08:00" / "17:00" (local to UTC).
    TimeOfDay { from: String, to: String },
    /// Always true — useful for catch-alls and tests.
    Always,
}

/// Per-rule actions. Evaluator merges these by priority: Reject > Rewrite > Redact > Warn > Allow.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ActionSpec {
    Allow,
    Reject(RejectSpec),
    Redact(RedactSpec),
    Warn { message: String },
    Rewrite(RewriteSpec),
    RateLimit { rpm: u32 },
    RouteToModel(RouteSpec),
    ForwardToReviewQueue { queue: String },
    RunLayer { layer: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RejectSpec {
    pub user_message: String,
    #[serde(default)]
    pub audit_tag: Option<String>,
    #[serde(default = "default_severity")]
    pub severity: Severity,
}

fn default_severity() -> Severity { Severity::Medium }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactSpec {
    pub replacement: String,
    #[serde(default)]
    pub audit_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewriteSpec {
    pub template: String,
    #[serde(default)]
    pub audit_tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteSpec {
    pub target_model: String,
    #[serde(default)]
    pub audit_tag: Option<String>,
}

/// Lightweight `Action` enum — used for evaluator output and priority ordering.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Action {
    Allow,
    Warn,
    Redact,
    Rewrite,
    Reject,
    RateLimit,
    RouteToModel,
    ForwardToReviewQueue,
    RunLayer,
}

impl Action {
    /// Higher = more decisive. Used to merge actions across rules.
    pub fn rank(&self) -> u8 {
        match self {
            Action::Allow => 0,
            Action::Warn => 1,
            Action::RateLimit => 2,
            Action::Redact => 3,
            Action::Rewrite => 4,
            Action::RouteToModel => 5,
            Action::RunLayer => 6,
            Action::ForwardToReviewQueue => 7,
            Action::Reject => 8,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Low,
    Medium,
    High,
    Critical,
}
