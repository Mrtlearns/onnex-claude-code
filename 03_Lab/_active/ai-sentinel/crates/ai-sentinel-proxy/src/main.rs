mod cert_gen;
mod config;
mod proxy;
mod upstream;

use anyhow::Result;
use tracing::info;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    // rustls requires exactly one crypto provider to be installed before any TLS usage.
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("failed to install ring CryptoProvider");

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let config_path = std::env::var("CONFIG_PATH").unwrap_or_else(|_| "config/gateway.toml".to_string());
    let cfg = config::GatewayConfig::load(&config_path)?;

    info!(bind_addr = %cfg.proxy.bind_addr, "ai-sentinel-proxy starting");
    proxy::run(cfg).await
}
