use std::sync::Arc;
use tokio::time::{Duration, interval};
use tracing::{info, warn, error};

use crate::{
    signature_set::{LiveSignatures, SignatureSet},
    sources::{crowdsec, nvd, owasp, custom},
};
use ai_sentinel_core::AppConfig;

/// Background feed worker. Polls all sources and hot-swaps signatures.
pub struct FeedWorker {
    signatures: LiveSignatures,
    config: Arc<AppConfig>,
}

impl FeedWorker {
    pub fn new(signatures: LiveSignatures, config: Arc<AppConfig>) -> Self {
        FeedWorker { signatures, config }
    }

    /// Spawn the background polling task and return a refresh trigger.
    pub fn spawn(self) -> tokio::sync::mpsc::Sender<()> {
        let (tx, mut rx) = tokio::sync::mpsc::channel::<()>(4);
        let interval_secs = self.config.feed_interval_secs;

        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(interval_secs));

            loop {
                tokio::select! {
                    _ = ticker.tick() => {
                        info!("feed: scheduled refresh");
                        self.refresh().await;
                    }
                    Some(_) = rx.recv() => {
                        info!("feed: manual refresh triggered");
                        self.refresh().await;
                    }
                }
            }
        });

        tx
    }

    async fn refresh(&self) {
        let mut injection_patterns: Vec<String> = Vec::new();
        let mut cve_tool_patterns: Vec<String> = Vec::new();
        let mut cve_ids: Vec<String> = Vec::new();

        // OWASP LLM Top 10 (bundled — always succeeds)
        let (mut owasp_patterns, _) = owasp::load();
        injection_patterns.append(&mut owasp_patterns);

        // Custom feed (file or URL)
        if let Some(ref path) = self.config.custom_feed_path {
            match custom::load(path).await {
                Ok((mut patterns, mut tools, mut ids)) => {
                    injection_patterns.append(&mut patterns);
                    cve_tool_patterns.append(&mut tools);
                    cve_ids.append(&mut ids);
                }
                Err(e) => warn!("custom feed error: {}", e),
            }
        }

        // CrowdSec CTI (optional — skip if no API key)
        if let Some(ref key) = self.config.crowdsec_api_key {
            match crowdsec::fetch(key).await {
                Ok((mut patterns, mut ids)) => {
                    injection_patterns.append(&mut patterns);
                    cve_ids.append(&mut ids);
                }
                Err(e) => warn!("crowdsec feed error: {}", e),
            }
        }

        // NVD (optional — skip if no API key)
        if let Some(ref key) = self.config.nvd_api_key {
            match nvd::fetch(key).await {
                Ok((mut tools, mut ids)) => {
                    cve_tool_patterns.append(&mut tools);
                    cve_ids.append(&mut ids);
                }
                Err(e) => warn!("nvd feed error: {}", e),
            }
        }

        let new_set = SignatureSet::new(injection_patterns, cve_tool_patterns, cve_ids);
        let count = new_set.pattern_count();
        self.signatures.swap(new_set);
        info!(patterns = count, "feed: hot-swap complete");
    }
}
