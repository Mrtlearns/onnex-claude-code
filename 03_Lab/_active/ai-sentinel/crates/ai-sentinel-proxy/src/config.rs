use serde::Deserialize;
use anyhow::Result;

#[derive(Debug, Clone, Deserialize)]
pub struct GatewayConfig {
    pub proxy: ProxyConfig,
    pub tls: TlsConfig,
    pub providers: ProvidersConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProxyConfig {
    pub bind_addr: String,
    /// If true: pass traffic through on pipeline error. If false: return 503 on error.
    #[serde(default)]
    pub fail_open: bool,
}

#[derive(Debug, Clone, Deserialize)]
pub struct TlsConfig {
    /// Path to the Onnex CA certificate PEM file
    pub ca_cert: String,
    /// Path to the Onnex CA private key PEM file
    pub ca_key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ProvidersConfig {
    /// Exact hostnames that are considered LLM provider endpoints
    pub allowed_hosts: Vec<String>,
    /// URL path prefixes that identify LLM API requests
    pub url_path_patterns: Vec<String>,
}

impl GatewayConfig {
    pub fn load(path: &str) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let cfg: GatewayConfig = toml::from_str(&content)?;
        Ok(cfg)
    }
}
