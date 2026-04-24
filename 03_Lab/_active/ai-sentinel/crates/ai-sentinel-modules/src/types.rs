use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;

/// Discriminator for a pluggable module.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleKind {
    Rules,
    Optimizer,
    ContextBank,
}

impl ModuleKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModuleKind::Rules => "rules",
            ModuleKind::Optimizer => "optimizer",
            ModuleKind::ContextBank => "context_bank",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "rules" => Some(ModuleKind::Rules),
            "optimizer" => Some(ModuleKind::Optimizer),
            "context_bank" => Some(ModuleKind::ContextBank),
            _ => None,
        }
    }
}

impl fmt::Display for ModuleKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

/// Commercial tier gate. Deployments set `AI_SENTINEL_LICENSE_TIER`; modules above that
/// tier are hidden from `/admin/modules` and cannot be enabled.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LicenseTier {
    Basic,
    Pro,
    Enterprise,
}

impl LicenseTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            LicenseTier::Basic => "basic",
            LicenseTier::Pro => "pro",
            LicenseTier::Enterprise => "enterprise",
        }
    }

    pub fn parse(s: &str) -> Self {
        match s.to_ascii_lowercase().as_str() {
            "pro" => LicenseTier::Pro,
            "enterprise" => LicenseTier::Enterprise,
            _ => LicenseTier::Basic,
        }
    }

    /// Returns true if a module of `required` tier is usable by a deployment at `self` tier.
    pub fn covers(self, required: LicenseTier) -> bool {
        self.rank() >= required.rank()
    }

    fn rank(self) -> u8 {
        match self {
            LicenseTier::Basic => 0,
            LicenseTier::Pro => 1,
            LicenseTier::Enterprise => 2,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Module {
    pub id: i64,
    pub kind: ModuleKind,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub current_version: i32,
    pub license_tier: LicenseTier,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NewModule {
    pub kind: ModuleKind,
    pub name: String,
    pub description: String,
    pub license_tier: LicenseTier,
    pub initial_config_yaml: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleUpdate {
    pub config_yaml: String,
    pub description: Option<String>,
    pub expected_version: i32, // optimistic concurrency / ETag guard
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleVersion {
    pub id: i64,
    pub module_id: i64,
    pub version: i32,
    pub config_yaml: String,
    pub config_hash: String,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ModuleAction {
    Create,
    Update,
    Enable,
    Disable,
    Revert,
    Delete,
}

impl ModuleAction {
    pub fn as_str(&self) -> &'static str {
        match self {
            ModuleAction::Create => "create",
            ModuleAction::Update => "update",
            ModuleAction::Enable => "enable",
            ModuleAction::Disable => "disable",
            ModuleAction::Revert => "revert",
            ModuleAction::Delete => "delete",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModuleAuditRecord {
    pub id: i64,
    pub prev_hash: String,
    pub record_hash: String,
    pub module_id: Option<i64>,
    pub action: ModuleAction,
    pub actor: String,
    pub timestamp: DateTime<Utc>,
    pub before_version: Option<i32>,
    pub after_version: Option<i32>,
    pub diff_json: Option<serde_json::Value>,
}
