//! Summarization worker — every `interval` scans callers with unsummarized entries,
//! asks the LLM for a short summary, and writes to `context_summaries`.
//!
//! This is the "model-agnostic" de-moat: summaries are stored as plain text + embedding,
//! decoupled from the original provider. If a customer moves from Anthropic to a local
//! model, their context bank is intact.

use crate::embedder::Embedder;
use crate::store::ContextStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SummarizationConfig {
    /// Ollama generate endpoint (or anything OpenAI-compatible).
    pub ollama_base_url: String,
    /// Model to use for summarization — small + local by default.
    pub summarize_model: String,
    /// How often the worker runs, in seconds.
    pub interval_secs: u64,
    /// Max entries to summarize per caller per pass.
    pub batch_per_caller: i64,
}

impl Default for SummarizationConfig {
    fn default() -> Self {
        Self {
            ollama_base_url: "http://10.10.110.36:11434".to_string(),
            summarize_model: "llama3.2:3b".to_string(),
            interval_secs: 12 * 60 * 60,
            batch_per_caller: 200,
        }
    }
}

pub struct SummarizationWorker;

impl SummarizationWorker {
    pub fn spawn(
        store: ContextStore,
        embedder: Arc<dyn Embedder>,
        cfg: SummarizationConfig,
    ) {
        tokio::spawn(async move {
            info!(
                interval_secs = cfg.interval_secs,
                model = %cfg.summarize_model,
                "context: summarizer starting"
            );
            let mut tick = tokio::time::interval(std::time::Duration::from_secs(cfg.interval_secs));
            let http = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(120))
                .build()
                .expect("reqwest");
            loop {
                tick.tick().await;
                let callers = match store.distinct_callers_with_unsummarized().await {
                    Ok(c) => c,
                    Err(e) => {
                        warn!(error = %e, "summarizer: query callers failed");
                        continue;
                    }
                };
                for caller in callers {
                    if let Err(e) = Self::summarize_one(
                        &store,
                        &embedder,
                        &http,
                        &cfg,
                        &caller,
                    )
                    .await
                    {
                        warn!(error = %e, caller = %caller, "summarizer: caller pass failed");
                    }
                }
            }
        });
    }

    async fn summarize_one(
        store: &ContextStore,
        embedder: &Arc<dyn Embedder>,
        http: &reqwest::Client,
        cfg: &SummarizationConfig,
        caller_id: &str,
    ) -> anyhow::Result<()> {
        let entries = store.unsummarized(caller_id, cfg.batch_per_caller).await?;
        if entries.is_empty() {
            return Ok(());
        }
        let ids: Vec<i64> = entries.iter().map(|(id, _, _)| *id).collect();
        let prompt = Self::build_prompt(&entries);
        let summary = Self::llm_generate(http, cfg, &prompt).await?;
        let emb = embedder.embed(&summary).await?;
        store.insert_summary(caller_id, &summary, &emb, &ids).await?;
        store.mark_summarized(&ids).await?;
        info!(caller_id, entries = ids.len(), "summarizer: caller pass complete");
        Ok(())
    }

    fn build_prompt(entries: &[(i64, String, String)]) -> String {
        let mut out = String::from(
            "Summarize the following conversation turns into 3-5 bullet points. Keep only \
facts, decisions, and user preferences. Omit greetings and filler.\n\n",
        );
        for (_, role, content) in entries {
            out.push_str(&format!("[{role}] {content}\n"));
        }
        out
    }

    async fn llm_generate(
        http: &reqwest::Client,
        cfg: &SummarizationConfig,
        prompt: &str,
    ) -> anyhow::Result<String> {
        #[derive(Serialize)]
        struct Req<'a> {
            model: &'a str,
            prompt: &'a str,
            stream: bool,
        }
        #[derive(Deserialize)]
        struct Resp {
            response: String,
        }
        let url = format!("{}/api/generate", cfg.ollama_base_url.trim_end_matches('/'));
        let r: Resp = http
            .post(&url)
            .json(&Req {
                model: &cfg.summarize_model,
                prompt,
                stream: false,
            })
            .send()
            .await?
            .error_for_status()?
            .json()
            .await?;
        Ok(r.response.trim().to_string())
    }
}
