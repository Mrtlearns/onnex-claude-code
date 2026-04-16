use async_trait::async_trait;
use std::sync::Arc;
use tracing::debug;

use ai_sentinel_core::{
    Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};
use ai_sentinel_feed::LiveSignatures;

pub struct L2Threat {
    signatures: LiveSignatures,
}

impl L2Threat {
    pub fn new(signatures: LiveSignatures) -> Self {
        L2Threat { signatures }
    }

    fn extract_text(payload: &serde_json::Value) -> String {
        match payload {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(m) => {
                for key in &["content", "prompt", "text", "message"] {
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
}

#[async_trait]
impl Layer for L2Threat {
    fn id(&self) -> &'static str { "l2.3" }
    fn name(&self) -> &'static str { "Threat Intelligence Matching" }
    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, _ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        let sigs = self.signatures.get();

        if sigs.pattern_count() == 0 {
            return Ok(LayerResult::Pass);
        }

        let text = Self::extract_text(&req.payload);
        if sigs.matches_threat(&text) {
            debug!("L2Threat: threat signature match");
            return Ok(LayerResult::Reject {
                code: "THREAT_SIGNATURE_MATCH".to_string(),
                reason: "Payload matches live threat intelligence signature".to_string(),
                severity: Severity::Critical,
            });
        }

        Ok(LayerResult::Pass)
    }
}
