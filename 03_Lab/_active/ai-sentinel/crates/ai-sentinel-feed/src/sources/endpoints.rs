/// Hardcoded LLM provider endpoint data for Phase 4 gateway.
/// Extended dynamically in Phase 5 via feed refresh.

pub struct LlmProviderList {
    pub sni_exact: Vec<&'static str>,
    pub url_path_prefixes: Vec<&'static str>,
}

pub fn phase4_providers() -> LlmProviderList {
    LlmProviderList {
        sni_exact: vec![
            "api.anthropic.com",
            "api.openai.com",
            "api.openai.azure.com",
            "generativelanguage.googleapis.com",
            "api.groq.com",
            "api.mistral.ai",
            "api.cohere.com",
            "api.together.xyz",
            "api.perplexity.ai",
            "openrouter.ai",
        ],
        url_path_prefixes: vec![
            "/v1/messages",
            "/v1/chat/completions",
            "/v1/completions",
            "/v1/generateContent",
            "/v1/streamGenerateContent",
            "/openai/deployments",
        ],
    }
}

/// Convert provider list into regex-compatible patterns for SignatureSet.
pub fn sni_patterns() -> Vec<String> {
    let providers = phase4_providers();
    providers
        .sni_exact
        .iter()
        .map(|h| format!("^{}$", regex::escape(h)))
        .collect()
}

pub fn url_path_patterns() -> Vec<String> {
    let providers = phase4_providers();
    providers
        .url_path_prefixes
        .iter()
        .map(|p| format!("^{}", regex::escape(p)))
        .collect()
}
