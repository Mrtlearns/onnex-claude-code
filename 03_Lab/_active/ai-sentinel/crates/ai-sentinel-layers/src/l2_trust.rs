use async_trait::async_trait;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use hex;
use chrono::Utc;
use tracing::debug;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};

type HmacSha256 = Hmac<Sha256>;

const REPLAY_WINDOW_SECS: i64 = 60;

pub struct L2Trust {
    trust_secret: Option<String>,
}

impl L2Trust {
    pub fn new(config: &AppConfig) -> Self {
        L2Trust {
            trust_secret: config.trust_secret.clone(),
        }
    }

    /// Trust token format: "agent_id:timestamp_unix:hmac_hex"
    fn validate_token(&self, token: &str, secret: &str) -> Result<(String, i64), String> {
        let parts: Vec<&str> = token.splitn(3, ':').collect();
        if parts.len() != 3 {
            return Err("invalid trust token format".to_string());
        }

        let agent_id = parts[0];
        let timestamp: i64 = parts[1].parse()
            .map_err(|_| "invalid timestamp in trust token")?;
        let provided_hmac = parts[2];

        // Check timestamp window
        let now = Utc::now().timestamp();
        let age = now - timestamp;
        if age > REPLAY_WINDOW_SECS || age < -5 {
            return Err(format!("trust token expired or clock skew too large (age={}s)", age));
        }

        // Verify HMAC
        let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
            .map_err(|e| format!("HMAC init error: {}", e))?;
        mac.update(agent_id.as_bytes());
        mac.update(b":");
        mac.update(parts[1].as_bytes());
        let expected = hex::encode(mac.finalize().into_bytes());

        if expected != provided_hmac {
            return Err("trust token HMAC mismatch".to_string());
        }

        Ok((agent_id.to_string(), timestamp))
    }
}

#[async_trait]
impl Layer for L2Trust {
    fn id(&self) -> &'static str { "l2.2" }
    fn name(&self) -> &'static str { "Trust Chain Verification" }
    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        // Only applies if a trust token is present
        let token = match &req.caller_context.trust_token {
            Some(t) => t,
            None => return Ok(LayerResult::Pass),
        };

        let secret = match &self.trust_secret {
            Some(s) => s,
            None => {
                debug!("L2Trust: no trust_secret configured, skipping trust chain validation");
                return Ok(LayerResult::Pass);
            }
        };

        match self.validate_token(token, secret) {
            Ok((agent_id, timestamp)) => {
                // Check replay: has this (agent_id, timestamp) been seen?
                if let Some(ref session) = ctx.session {
                    if let Ok(Some(mut state)) = session.load().await {
                        let key = format!("{}:{}", agent_id, timestamp);
                        let now = Utc::now().timestamp();

                        // Evict expired entries
                        state.seen_trust_tokens.retain(|_, expiry| *expiry > now);

                        if state.seen_trust_tokens.contains_key(&key) {
                            return Ok(LayerResult::Reject {
                                code: "TRUST_REPLAY".to_string(),
                                reason: "Trust token replay detected".to_string(),
                                severity: Severity::High,
                            });
                        }

                        // Record this token as seen
                        state.seen_trust_tokens.insert(key, now + REPLAY_WINDOW_SECS);
                        let _ = session.save(&state).await;
                    }
                }
                debug!("L2Trust: trust chain validated for agent {}", agent_id);
                Ok(LayerResult::Pass)
            }
            Err(reason) => Ok(LayerResult::Reject {
                code: "TRUST_INVALID".to_string(),
                reason,
                severity: Severity::High,
            }),
        }
    }
}
