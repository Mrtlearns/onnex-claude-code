use serde::{Deserialize, Serialize};
use config::{Config, ConfigError, Environment, File};
use std::collections::HashMap;

#[derive(Debug, Clone, Deserialize, Serialize, Default)]
pub struct AppConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    #[serde(default)]
    pub log_level: String,

    // Auth
    pub jwt_secret: Option<String>,
    #[serde(default)]
    pub api_keys: Vec<String>,   // pre-hashed SHA-256 hex strings
    pub admin_token: Option<String>,
    pub trust_secret: Option<String>,

    // Store
    #[serde(default = "default_store")]
    pub store_backend: String,
    pub database_url: Option<String>,
    pub redis_url: Option<String>,

    // Telemetry
    #[serde(default = "default_telemetry_level")]
    pub telemetry_level: String,
    #[serde(default = "default_telemetry_backend")]
    pub telemetry_backend: String,
    #[serde(default = "default_true")]
    pub telemetry_pii_redact: bool,

    // Feed
    #[serde(default = "default_feed_interval")]
    pub feed_interval_secs: u64,
    pub crowdsec_api_key: Option<String>,
    pub nvd_api_key: Option<String>,
    pub custom_feed_path: Option<String>,

    // Rate limits
    #[serde(default = "default_rate_actions")]
    pub rate_max_actions_per_hour: u64,
    #[serde(default = "default_rate_cost")]
    pub rate_max_cost_per_day: f64,
    #[serde(default = "default_rate_tokens")]
    pub rate_max_tokens_per_request: u32,

    // PII
    pub presidio_url: Option<String>,

    // Layer toggles
    #[serde(default = "default_true")]
    pub layer_l0_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l1_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l2_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l3_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l4_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l5_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l6_enabled: bool,
    #[serde(default = "default_true")]
    pub layer_l7_enabled: bool,

    // RBAC roles path
    pub rbac_roles_path: Option<String>,

    // L3 semantic drift
    #[serde(default = "default_l3_drift_threshold")]
    pub l3_drift_threshold: f32,
    #[serde(default = "default_l3_baseline_window")]
    pub l3_baseline_window: u32,
    pub l3_drift_webhook: Option<String>,
}

// Hash-projection embeddings produce near-zero similarity between related but lexically
// diverse sentences. -0.1 catches only strongly anti-correlated topic shifts.
// For real semantic embeddings (future), use 0.7-0.85.
fn default_l3_drift_threshold() -> f32 { -0.1 }
fn default_l3_baseline_window() -> u32 { 5 }
fn default_host() -> String { "0.0.0.0".to_string() }
fn default_port() -> u16 { 8080 }
fn default_store() -> String { "memory".to_string() }
fn default_telemetry_level() -> String { "standard".to_string() }
fn default_telemetry_backend() -> String { "stdout".to_string() }
fn default_feed_interval() -> u64 { 3600 }
fn default_rate_actions() -> u64 { 1000 }
fn default_rate_cost() -> f64 { 100.0 }
fn default_rate_tokens() -> u32 { 100_000 }
fn default_true() -> bool { true }

impl AppConfig {
    pub fn load() -> Result<Self, ConfigError> {
        let config_dir = std::env::var("AI_SENTINEL_CONFIG_DIR")
            .unwrap_or_else(|_| "./config".to_string());

        let profile = std::env::var("AI_SENTINEL_PROFILE")
            .unwrap_or_else(|_| "default".to_string());

        Config::builder()
            .add_source(File::with_name(&format!("{}/default", config_dir)).required(false))
            .add_source(File::with_name(&format!("{}/{}", config_dir, profile)).required(false))
            .add_source(
                Environment::with_prefix("AI_SENTINEL")
                    .separator("_")
                    .list_separator(","),
            )
            .build()?
            .try_deserialize()
    }
}
