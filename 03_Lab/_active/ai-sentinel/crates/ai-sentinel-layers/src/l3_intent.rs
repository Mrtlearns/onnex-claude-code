// L3 — Semantic Intent Guard
// Phase 2: 256-dim hash-projection word embeddings + cosine similarity drift detection.
// No model download required — deterministic, pure-Rust, always available.

use async_trait::async_trait;
use tracing::{debug, warn};
use std::sync::Arc;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity, SessionState,
};

pub struct L3Intent {
    drift_threshold: f32,
    baseline_window: usize,
    webhook_url: Option<String>,
}

impl L3Intent {
    pub fn new(config: &AppConfig) -> Self {
        L3Intent {
            drift_threshold: config.l3_drift_threshold,
            baseline_window: config.l3_baseline_window as usize,
            webhook_url: config.l3_drift_webhook.clone(),
        }
    }

    /// Convert text to a normalized 256-dimensional embedding via hash projection.
    /// Each word is projected into the vector space using a deterministic LCG seeded by
    /// the word's FNV-1a hash. The result is the mean of all word projections, normalized.
    fn embed(text: &str) -> Vec<f32> {
        const DIM: usize = 256;
        let mut vec = vec![0.0f32; DIM];
        let words: Vec<String> = text
            .split(|c: char| !c.is_alphanumeric())
            .filter(|w| w.len() > 2)
            .map(|w| w.to_lowercase())
            .collect();

        if words.is_empty() {
            return vec;
        }

        for word in &words {
            let mut h = fnv1a(word.as_bytes());
            for i in 0..DIM {
                // Rademacher sign projection: +1 or -1 based on hash bit
                let sign = if (h >> (i % 64)) & 1 == 0 { 1.0 } else { -1.0 };
                vec[i] += sign;
                // LCG step to mix bits across dimensions
                h = h.wrapping_mul(6_364_136_223_846_793_005)
                    .wrapping_add(1_442_695_040_888_963_407);
            }
        }

        // Average
        let n = words.len() as f32;
        for v in &mut vec { *v /= n; }

        // L2-normalize so dot product == cosine similarity
        let norm: f32 = vec.iter().map(|v| v * v).sum::<f32>().sqrt();
        if norm > 1e-8 {
            for v in &mut vec { *v /= norm; }
        }

        vec
    }

    /// Cosine similarity between two normalized vectors.
    fn cosine(a: &[f32], b: &[f32]) -> f32 {
        a.iter().zip(b.iter()).map(|(x, y)| x * y).sum()
    }

    fn extract_text(payload: &serde_json::Value) -> String {
        match payload {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(m) => {
                for key in &["content", "prompt", "text", "message", "input"] {
                    if let Some(v) = m.get(*key) {
                        if let Some(s) = v.as_str() {
                            return s.to_string();
                        }
                    }
                }
                serde_json::to_string(payload).unwrap_or_default()
            }
            _ => serde_json::to_string(payload).unwrap_or_default(),
        }
    }

    async fn fire_webhook(&self, request_id: &str, similarity: f32) {
        if let Some(ref url) = self.webhook_url {
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(500))
                .build();
            if let Ok(client) = client {
                let body = serde_json::json!({
                    "event": "intent_drift",
                    "request_id": request_id,
                    "similarity": similarity,
                    "threshold": self.drift_threshold,
                });
                let _ = client.post(url).json(&body).send().await;
            }
        }
    }
}

fn fnv1a(data: &[u8]) -> u64 {
    let mut h: u64 = 14_695_981_039_346_656_037;
    for &b in data {
        h ^= b as u64;
        h = h.wrapping_mul(1_099_511_628_211);
    }
    h
}

#[async_trait]
impl Layer for L3Intent {
    fn id(&self) -> &'static str { "l3" }
    fn name(&self) -> &'static str { "Semantic Intent Guard" }

    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        let text = Self::extract_text(&req.payload);
        if text.len() < 10 {
            // Too short to embed meaningfully — skip
            return Ok(LayerResult::Pass);
        }

        let embedding = Self::embed(&text);

        if let Some(ref session) = ctx.session {
            let mut state = session.load().await
                .map_err(|e| LayerError::internal(e.to_string()))?
                .unwrap_or_else(|| SessionState::new(
                    session.session_id().to_string(),
                    req.caller_context.caller_id.clone(),
                ));

            if let Some(ref baseline) = state.embedding_baseline {
                let similarity = Self::cosine(&embedding, baseline);
                debug!(
                    request_id = %ctx.request_id,
                    similarity = similarity,
                    threshold = self.drift_threshold,
                    "L3: cosine similarity"
                );

                if similarity < self.drift_threshold {
                    warn!(
                        request_id = %ctx.request_id,
                        similarity = similarity,
                        "L3: intent drift detected"
                    );
                    self.fire_webhook(&ctx.request_id, similarity).await;
                    return Ok(LayerResult::Reject {
                        code: "INTENT_DRIFT".to_string(),
                        reason: format!(
                            "Semantic intent drift detected (similarity {:.3} < threshold {:.3})",
                            similarity, self.drift_threshold
                        ),
                        severity: Severity::High,
                    });
                }
            }

            // Update baseline: rolling mean over the last N embeddings stored compactly
            // as a single averaged vector (incremental update).
            let new_baseline = if let Some(ref baseline) = state.embedding_baseline {
                let count = state.action_count.min(self.baseline_window as u64) as f32;
                // Weighted average: old_baseline * (n-1)/n + new * 1/n
                let w_old = count / (count + 1.0);
                let w_new = 1.0 / (count + 1.0);
                let mut b = baseline.clone();
                for (bv, ev) in b.iter_mut().zip(embedding.iter()) {
                    *bv = *bv * w_old + ev * w_new;
                }
                // Re-normalize
                let norm: f32 = b.iter().map(|v| v * v).sum::<f32>().sqrt();
                if norm > 1e-8 { for v in &mut b { *v /= norm; } }
                b
            } else {
                embedding
            };

            state.embedding_baseline = Some(new_baseline);
            session.save(&state).await
                .map_err(|e| LayerError::internal(e.to_string()))?;
        }

        Ok(LayerResult::Pass)
    }
}
