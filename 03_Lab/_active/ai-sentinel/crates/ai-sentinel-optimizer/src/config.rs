use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Per-module optimizer config — serialized to/from YAML in the module config store.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizerConfig {
    #[serde(default = "default_true")]
    pub cache_enabled: bool,
    #[serde(default = "default_ttl_secs")]
    pub cache_ttl_secs: u64,
    #[serde(default = "default_cache_cap")]
    pub cache_max_entries: usize,

    #[serde(default = "default_true")]
    pub routing_enabled: bool,
    /// Per-target-complexity downgrade table. Key = original model, Value = replacement.
    /// Applied only when the prompt is classified `Simple`.
    #[serde(default)]
    pub simple_downgrade: HashMap<String, String>,

    #[serde(default = "default_true")]
    pub compression_enabled: bool,
    /// Strip RAG docs whose advertised relevance score falls below this threshold.
    #[serde(default = "default_rag_threshold")]
    pub rag_relevance_threshold: f32,
}

fn default_true() -> bool { true }
fn default_ttl_secs() -> u64 { 24 * 60 * 60 }
fn default_cache_cap() -> usize { 10_000 }
fn default_rag_threshold() -> f32 { 0.4 }

impl Default for OptimizerConfig {
    fn default() -> Self {
        let mut simple_downgrade = HashMap::new();
        simple_downgrade.insert("claude-opus-4-7".into(), "claude-haiku-4-5".into());
        simple_downgrade.insert("claude-3-opus".into(), "claude-3-5-haiku".into());
        simple_downgrade.insert("gpt-4".into(), "gpt-4o-mini".into());
        simple_downgrade.insert("gpt-4o".into(), "gpt-4o-mini".into());

        Self {
            cache_enabled: true,
            cache_ttl_secs: default_ttl_secs(),
            cache_max_entries: default_cache_cap(),
            routing_enabled: true,
            simple_downgrade,
            compression_enabled: true,
            rag_relevance_threshold: default_rag_threshold(),
        }
    }
}
