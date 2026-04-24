//! L8 Optimizer — registered between L2_Threat and L3_Intent. Ingress only.
//!
//! Responsibilities on each /check call:
//!   1. Cache lookup. On hit, produce a `Mutate` LayerResult carrying the cached payload
//!      and set a `cache_hit` telemetry flag so the audit + metrics pipeline can observe
//!      the saving.
//!   2. Model routing. Rewrites `caller_context.model` in the request payload when the
//!      classifier picks a downgrade. Lower-layer decisions are unaffected.
//!   3. (Future) Prompt compression — stripping redundant system prompts, low-relevance
//!      RAG docs. Hooked but not yet implemented in v5.0.
//!
//! The layer never rejects — it is purely an efficiency optimization. Errors degrade
//! gracefully (cache miss, no routing change).

use crate::cache::{CachedResponse, SemanticCache};
use crate::config::OptimizerConfig;
use crate::router::ModelRouter;
use ai_sentinel_core::{
    CheckRequest, Direction, Layer, LayerContext, LayerError, LayerResult,
};
use async_trait::async_trait;
use std::sync::Arc;
use tracing::debug;

pub struct L8Optimizer {
    cfg: Arc<arc_swap::ArcSwap<OptimizerConfig>>,
    cache: SemanticCache,
}

impl L8Optimizer {
    pub fn new(initial: OptimizerConfig) -> Self {
        let ttl = std::time::Duration::from_secs(initial.cache_ttl_secs);
        let cap = initial.cache_max_entries;
        Self {
            cache: SemanticCache::new(cap, ttl),
            cfg: Arc::new(arc_swap::ArcSwap::new(Arc::new(initial))),
        }
    }

    pub fn replace_config(&self, cfg: OptimizerConfig) {
        self.cfg.store(Arc::new(cfg));
    }

    pub fn cache(&self) -> &SemanticCache {
        &self.cache
    }

    fn extract_prompt(payload: &serde_json::Value) -> String {
        // Best-effort — accept both {content: "..."} and {messages: [{content: "..."}, ...]}
        if let Some(s) = payload.get("content").and_then(|v| v.as_str()) {
            return s.to_string();
        }
        if let Some(arr) = payload.get("messages").and_then(|v| v.as_array()) {
            let mut out = String::new();
            for m in arr {
                if let Some(s) = m.get("content").and_then(|v| v.as_str()) {
                    out.push_str(s);
                    out.push('\n');
                }
            }
            return out;
        }
        serde_json::to_string(payload).unwrap_or_default()
    }

    pub fn record_cached_response(
        &self,
        prompt: &str,
        model: &str,
        temperature: f64,
        resp: CachedResponse,
    ) {
        let k = SemanticCache::key(prompt, model, temperature);
        self.cache.insert(k, resp);
    }
}

#[async_trait]
impl Layer for L8Optimizer {
    fn id(&self) -> &'static str {
        "l8"
    }

    fn name(&self) -> &'static str {
        "token_optimizer"
    }

    fn applies_to(&self, direction: &Direction) -> bool {
        matches!(direction, Direction::Ingress)
    }

    async fn check(
        &self,
        req: &CheckRequest,
        ctx: &mut LayerContext,
    ) -> Result<LayerResult, LayerError> {
        let cfg = self.cfg.load_full();
        let prompt = Self::extract_prompt(&req.payload);
        let model = req
            .caller_context
            .model
            .clone()
            .unwrap_or_else(|| "unknown".to_string());
        let temp = 0.0_f64;

        // 1. Cache lookup
        if cfg.cache_enabled {
            let k = SemanticCache::key(&prompt, &model, temp);
            if let Some(cached) = self.cache.get(k) {
                debug!(
                    cache_key = k,
                    tokens_saved = cached.tokens_saved,
                    cost_saved_usd = cached.cost_saved_usd,
                    "l8: cache hit"
                );
                ctx.telemetry.layers_ran.push("l8:cache_hit".into());
                return Ok(LayerResult::Mutate {
                    payload: cached.payload,
                });
            }
        }

        // 2. Model routing — rewrites request payload's model field when possible.
        if cfg.routing_enabled {
            if let Some(new_model) = ModelRouter::route(&cfg, &model, &prompt) {
                debug!(from = %model, to = %new_model, "l8: model routed");
                ctx.telemetry.layers_ran.push(format!("l8:route:{new_model}"));
                let mut new_payload = req.payload.clone();
                if let Some(obj) = new_payload.as_object_mut() {
                    obj.insert(
                        "model".to_string(),
                        serde_json::Value::String(new_model.to_string()),
                    );
                }
                return Ok(LayerResult::Mutate { payload: new_payload });
            }
        }

        Ok(LayerResult::Pass)
    }
}
