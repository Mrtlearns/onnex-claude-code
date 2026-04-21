pub mod classifier;
pub mod signals;

pub use classifier::classify;

/// Known LLM providers.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LlmProvider {
    Anthropic,
    OpenAi,
    Google,
    Groq,
    Mistral,
    Unknown,
}

/// Result of the 5-signal classifier cascade.
#[derive(Debug, Clone)]
pub enum ClassifyResult {
    /// Traffic identified as LLM API call — should be inspected.
    LlmTraffic {
        provider: LlmProvider,
        signals_matched: Vec<String>,
    },
    /// Non-LLM traffic — TCP tunnel without decryption.
    NonLlmTraffic,
}

impl ClassifyResult {
    pub fn is_llm(&self) -> bool {
        matches!(self, ClassifyResult::LlmTraffic { .. })
    }
}

/// Static provider signatures used by signal modules.
/// In Phase 5, this will be hot-reloaded from the feed worker.
pub struct ProviderSignatures {
    pub sni_exact: Vec<String>,
    pub url_path_prefixes: Vec<String>,
}

impl Default for ProviderSignatures {
    fn default() -> Self {
        ProviderSignatures {
            sni_exact: vec![
                "api.anthropic.com".to_string(),
                "api.openai.com".to_string(),
                "api.openai.azure.com".to_string(),
                "generativelanguage.googleapis.com".to_string(),
                "api.groq.com".to_string(),
                "api.mistral.ai".to_string(),
                "api.cohere.com".to_string(),
                "api.together.xyz".to_string(),
                "api.perplexity.ai".to_string(),
                "openrouter.ai".to_string(),
            ],
            url_path_prefixes: vec![
                "/v1/messages".to_string(),
                "/v1/chat/completions".to_string(),
                "/v1/completions".to_string(),
                "/v1/generateContent".to_string(),
                "/v1/streamGenerateContent".to_string(),
                "/openai/deployments".to_string(),
            ],
        }
    }
}
