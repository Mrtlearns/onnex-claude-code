use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use regex::Regex;
use tracing::debug;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};
use ai_sentinel_feed::LiveSignatures;

/// RBAC role definition.
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RbacRole {
    pub allowed_tools: Vec<String>,
    #[serde(default)]
    pub forbidden_args: Vec<ForbiddenArg>,
    #[serde(default)]
    pub destructive_override: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ForbiddenArg {
    pub tool: String,
    pub pattern: String,
}

/// Destructive tool name patterns — deny by default.
const DESTRUCTIVE_PATTERNS: &[&str] = &[
    "drop", "delete", "truncate", "format", "wipe", "destroy", "purge", "rm",
];

pub struct L4Tools {
    roles: HashMap<String, RbacRole>,
    signatures: LiveSignatures,
}

impl L4Tools {
    pub fn new(config: &AppConfig, signatures: LiveSignatures) -> anyhow::Result<Self> {
        let roles = if let Some(ref path) = config.rbac_roles_path {
            let content = std::fs::read_to_string(path)?;
            serde_json::from_str(&content)?
        } else {
            // Default: empty roles (all tools allowed for any role)
            HashMap::new()
        };

        Ok(L4Tools { roles, signatures })
    }

    fn is_destructive(tool_name: &str) -> bool {
        let lower = tool_name.to_lowercase();
        DESTRUCTIVE_PATTERNS.iter().any(|p| lower.contains(p))
    }
}

#[async_trait]
impl Layer for L4Tools {
    fn id(&self) -> &'static str { "l4" }
    fn name(&self) -> &'static str { "Tool & Action Authorization" }

    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, _ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        let manifest = match &req.tool_manifest {
            Some(m) => m,
            None => return Ok(LayerResult::Pass), // No tool manifest — skip L4
        };

        let tool_name = &manifest.tool_name;

        // 1. CVE-mapped tool patterns from threat feed
        let sigs = self.signatures.get();
        if sigs.matches_tool_cve(tool_name) {
            return Ok(LayerResult::Reject {
                code: "TOOL_CVE".to_string(),
                reason: format!("Tool '{}' matches a known CVE pattern", tool_name),
                severity: Severity::Critical,
            });
        }

        // 2. Destructive action gate
        if Self::is_destructive(tool_name) {
            // Check if role allows override
            let role_name = req.tool_manifest.as_ref()
                .and_then(|m| m.role.as_deref())
                .unwrap_or("default");

            let override_allowed = self.roles.get(role_name)
                .map(|r| r.destructive_override)
                .unwrap_or(false);

            if !override_allowed {
                return Ok(LayerResult::Reject {
                    code: "DESTRUCTIVE_TOOL_DENIED".to_string(),
                    reason: format!("Destructive tool '{}' is denied by policy", tool_name),
                    severity: Severity::High,
                });
            }
        }

        // 3. RBAC allowed tools check
        if !self.roles.is_empty() {
            let role_name = req.tool_manifest.as_ref()
                .and_then(|m| m.role.as_deref())
                .unwrap_or("default");

            if let Some(role) = self.roles.get(role_name) {
                let allowed = role.allowed_tools.iter().any(|t| t == tool_name || t == "*");
                if !allowed {
                    return Ok(LayerResult::Reject {
                        code: "TOOL_NOT_AUTHORIZED".to_string(),
                        reason: format!("Tool '{}' not in allowed list for role '{}'", tool_name, role_name),
                        severity: Severity::Medium,
                    });
                }

                // 4. Forbidden args check
                let tool_args_str = manifest.tool_args.to_string();
                for forbidden in role.forbidden_args.iter().filter(|f| f.tool == *tool_name || f.tool == "*") {
                    match Regex::new(&forbidden.pattern) {
                        Ok(re) if re.is_match(&tool_args_str) => {
                            return Ok(LayerResult::Reject {
                                code: "FORBIDDEN_ARGS".to_string(),
                                reason: format!("Tool args match forbidden pattern '{}'", forbidden.pattern),
                                severity: Severity::High,
                            });
                        }
                        _ => {}
                    }
                }
            }
        }

        // NOTE: Caller-supplied manifest.allowed_tools is intentionally NOT checked here.
        // A caller cannot authorize itself — authorization is enforced via server-side
        // RBAC roles (step 3) only.

        debug!("L4: tool '{}' authorized", tool_name);
        Ok(LayerResult::Pass)
    }
}
