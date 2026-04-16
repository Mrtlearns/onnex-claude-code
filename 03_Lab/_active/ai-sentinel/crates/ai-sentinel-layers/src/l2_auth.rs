use async_trait::async_trait;
use sha2::{Sha256, Digest};
use hex;
use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
use serde::{Deserialize, Serialize};
use tracing::debug;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};

#[derive(Debug, Serialize, Deserialize)]
struct JwtClaims {
    sub: Option<String>,
    exp: Option<usize>,
    iat: Option<usize>,
}

pub struct L2Auth {
    jwt_secret: Option<String>,
    api_key_hashes: Vec<String>,
}

impl L2Auth {
    pub fn new(config: &AppConfig) -> Self {
        L2Auth {
            jwt_secret: config.jwt_secret.clone(),
            api_key_hashes: config.api_keys.clone(),
        }
    }

    fn hash_key(key: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(key.as_bytes());
        hex::encode(hasher.finalize())
    }

    fn validate_jwt(&self, token: &str) -> bool {
        let secret = match &self.jwt_secret {
            Some(s) => s,
            None => return false,
        };
        let key = DecodingKey::from_secret(secret.as_bytes());
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;
        decode::<JwtClaims>(token, &key, &validation).is_ok()
    }

    fn validate_api_key(&self, key: &str) -> bool {
        if self.api_key_hashes.is_empty() {
            // No API keys configured — allow all (dev mode)
            debug!("L2Auth: no API keys configured, allowing all");
            return true;
        }
        let hash = Self::hash_key(key);
        self.api_key_hashes.iter().any(|h| h == &hash)
    }
}

#[async_trait]
impl Layer for L2Auth {
    fn id(&self) -> &'static str { "l2.1" }
    fn name(&self) -> &'static str { "Identity Authentication" }
    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, _ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        // Check API key hash
        if let Some(ref key_hash) = req.caller_context.api_key_hash {
            if self.api_key_hashes.is_empty() {
                // Dev mode — no keys configured
                return Ok(LayerResult::Pass);
            }
            if self.api_key_hashes.iter().any(|h| h == key_hash) {
                return Ok(LayerResult::Pass);
            }
            // Try treating it as raw key
            if self.validate_api_key(key_hash) {
                return Ok(LayerResult::Pass);
            }
        }

        // Check trust token (for agent-to-agent; L2.2 validates further)
        if req.caller_context.trust_token.is_some() {
            return Ok(LayerResult::Pass);
        }

        // If no API keys configured, allow through in dev mode
        if self.api_key_hashes.is_empty() && self.jwt_secret.is_none() {
            debug!("L2Auth: dev mode — no credentials configured, allowing");
            return Ok(LayerResult::Pass);
        }

        Ok(LayerResult::Reject {
            code: "AUTH_MISSING".to_string(),
            reason: "No valid API key or token provided".to_string(),
            severity: Severity::High,
        })
    }
}
