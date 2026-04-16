use async_trait::async_trait;
use tracing::debug;
use std::collections::HashSet;

use ai_sentinel_core::{
    Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};

/// Allowed environment variable names for MCP subprocess execution.
const ALLOWED_ENV_VARS: &[&str] = &[
    "PATH", "HOME", "USER", "LANG", "LC_ALL", "TERM", "SHELL", "TMPDIR",
];

pub struct L2Mcp;

impl L2Mcp {
    pub fn new() -> Self { L2Mcp }
}

impl Default for L2Mcp {
    fn default() -> Self { L2Mcp }
}

#[async_trait]
impl Layer for L2Mcp {
    fn id(&self) -> &'static str { "l2.4" }
    fn name(&self) -> &'static str { "MCP Environment Filter" }
    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, _ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        // Check if payload contains an env dict (MCP subprocess pattern)
        let env_obj = match &req.payload {
            serde_json::Value::Object(m) => m.get("env"),
            _ => None,
        };

        let env_map = match env_obj {
            Some(serde_json::Value::Object(m)) => m,
            _ => return Ok(LayerResult::Pass), // No env dict — not an MCP call
        };

        let allowed: HashSet<&str> = ALLOWED_ENV_VARS.iter().copied().collect();
        let violations: Vec<String> = env_map
            .keys()
            .filter(|k| !allowed.contains(k.as_str()))
            .cloned()
            .collect();

        if violations.is_empty() {
            return Ok(LayerResult::Pass);
        }

        // Strip forbidden env vars and return mutated payload
        let mut new_payload = req.payload.clone();
        if let serde_json::Value::Object(ref mut m) = new_payload {
            if let Some(serde_json::Value::Object(ref mut env)) = m.get_mut("env") {
                for k in &violations {
                    env.remove(k);
                }
            }
        }

        debug!("L2Mcp: stripped forbidden env vars: {:?}", violations);
        Ok(LayerResult::Mutate { payload: new_payload })
    }
}
