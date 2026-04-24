//! OpenAI-compatible upstream client (OpenRouter is the default target).
//!
//! Live mode posts to `{AI_SENTINEL_UPSTREAM_URL}/v1/chat/completions`; simulated mode
//! short-circuits to a synthetic stub response so offline runs cost nothing.

use crate::contract::{ChatUpstreamMode, UpstreamBody};
use serde::{Deserialize, Serialize};
use std::time::Duration;

pub struct UpstreamClient {
    base_url: String,
    api_key: Option<String>,
    http: reqwest::Client,
}

impl UpstreamClient {
    pub fn new(base_url: String, api_key: Option<String>) -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("ai-sentinel-testmode/0.1")
            .build()
            .expect("reqwest client");
        Self { base_url, api_key, http }
    }

    /// Dispatch to live or simulated backend.
    pub async fn call(
        &self,
        mode: ChatUpstreamMode,
        model: &str,
        system: Option<&str>,
        prompt: &str,
    ) -> anyhow::Result<UpstreamBody> {
        match mode {
            ChatUpstreamMode::Simulated => Ok(simulated_body(model, prompt)),
            ChatUpstreamMode::Live => self.live(model, system, prompt).await,
        }
    }

    async fn live(
        &self,
        model: &str,
        system: Option<&str>,
        prompt: &str,
    ) -> anyhow::Result<UpstreamBody> {
        let mut messages: Vec<ChatMessage> = Vec::new();
        if let Some(s) = system {
            messages.push(ChatMessage { role: "system", content: s.to_string() });
        }
        messages.push(ChatMessage { role: "user", content: prompt.to_string() });

        let req = OpenAiRequest { model: model.to_string(), messages, stream: false };
        let url = format!("{}/v1/chat/completions", self.base_url.trim_end_matches('/'));
        let mut builder = self.http.post(&url).json(&req);
        if let Some(key) = &self.api_key {
            builder = builder.bearer_auth(key);
        }
        // OpenRouter best-practice headers (harmless to include against other providers).
        builder = builder
            .header("HTTP-Referer", "https://ai-sentinel.on-nex.us")
            .header("X-Title", "AI-Sentinel Testing Mode");

        let resp = builder.send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(anyhow::anyhow!("upstream HTTP {status}: {body}"));
        }
        let r: OpenAiResponse = resp.json().await?;
        let content = r
            .choices
            .into_iter()
            .next()
            .map(|c| c.message.content)
            .unwrap_or_default();
        let tokens = r.usage.map(|u| u.total_tokens).unwrap_or(0);
        let model_used = r.model.unwrap_or_else(|| model.to_string());
        Ok(UpstreamBody { response: content, model: model_used, tokens })
    }
}

fn simulated_body(model: &str, prompt: &str) -> UpstreamBody {
    let preview: String = prompt.chars().take(60).collect();
    UpstreamBody {
        response: format!(
            "[simulated] AI-Sentinel allowed this prompt through. A real LLM would now \
             generate a response to: \"{preview}...\""
        ),
        model: format!("simulated:{model}"),
        tokens: 0,
    }
}

// ─── OpenAI-compatible wire types ─────────────────────────────────────────────

#[derive(Serialize)]
struct OpenAiRequest {
    model: String,
    messages: Vec<ChatMessage>,
    stream: bool,
}

#[derive(Serialize)]
struct ChatMessage {
    role: &'static str,
    content: String,
}

#[derive(Deserialize)]
struct OpenAiResponse {
    #[serde(default)]
    model: Option<String>,
    choices: Vec<Choice>,
    #[serde(default)]
    usage: Option<Usage>,
}

#[derive(Deserialize)]
struct Choice {
    message: OaMessage,
}

#[derive(Deserialize)]
struct OaMessage {
    #[serde(default)]
    content: String,
}

#[derive(Deserialize)]
struct Usage {
    #[serde(default)]
    total_tokens: u32,
}
