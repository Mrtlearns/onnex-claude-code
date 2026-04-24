//! Embedder trait + Ollama HTTP impl.
//!
//! Ollama is the default because it runs locally on the same homelab GPUs. 768 dims match
//! `nomic-embed-text`. Swap to a remote provider by implementing `Embedder`.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};

pub const EMBED_DIMS: usize = 768;

#[async_trait]
pub trait Embedder: Send + Sync {
    async fn embed(&self, text: &str) -> anyhow::Result<Vec<f32>>;
}

/// Ollama `/api/embeddings` client. Model defaults to `nomic-embed-text`.
pub struct OllamaEmbedder {
    base_url: String,
    model: String,
    client: reqwest::Client,
}

impl OllamaEmbedder {
    pub fn new(base_url: impl Into<String>, model: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            model: model.into(),
            client: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("reqwest client"),
        }
    }
}

#[derive(Serialize)]
struct OllamaEmbedReq<'a> {
    model: &'a str,
    prompt: &'a str,
}

#[derive(Deserialize)]
struct OllamaEmbedResp {
    embedding: Vec<f32>,
}

#[async_trait]
impl Embedder for OllamaEmbedder {
    async fn embed(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        let url = format!("{}/api/embeddings", self.base_url.trim_end_matches('/'));
        let resp: OllamaEmbedResp = self
            .client
            .post(&url)
            .json(&OllamaEmbedReq {
                model: &self.model,
                prompt: text,
            })
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        if resp.embedding.len() != EMBED_DIMS {
            return Err(anyhow::anyhow!(
                "embedder returned {} dims, expected {}",
                resp.embedding.len(),
                EMBED_DIMS
            ));
        }
        Ok(resp.embedding)
    }
}

/// Deterministic mock for tests — produces a dims-correct vector from the input.
pub struct MockEmbedder;

#[async_trait]
impl Embedder for MockEmbedder {
    async fn embed(&self, text: &str) -> anyhow::Result<Vec<f32>> {
        let mut out = vec![0f32; EMBED_DIMS];
        for (i, b) in text.bytes().enumerate() {
            out[i % EMBED_DIMS] += b as f32 / 255.0;
        }
        Ok(out)
    }
}
