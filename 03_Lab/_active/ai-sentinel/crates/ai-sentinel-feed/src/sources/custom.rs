use std::path::Path;
use serde::{Deserialize, Serialize};

/// Custom feed format: JSON file with injection patterns, tool patterns, CVE IDs.
#[derive(Debug, Deserialize, Serialize, Default)]
pub struct CustomFeed {
    #[serde(default)]
    pub injection_patterns: Vec<String>,
    #[serde(default)]
    pub cve_tool_patterns: Vec<String>,
    #[serde(default)]
    pub cve_ids: Vec<String>,
}

pub async fn load(path_or_url: &str) -> anyhow::Result<(Vec<String>, Vec<String>, Vec<String>)> {
    let content = if path_or_url.starts_with("http://") || path_or_url.starts_with("https://") {
        // Fetch from URL
        let resp = reqwest::get(path_or_url).await?;
        resp.text().await?
    } else {
        // Read from file
        tokio::fs::read_to_string(path_or_url).await?
    };

    let feed: CustomFeed = serde_json::from_str(&content)
        .map_err(|e| anyhow::anyhow!("custom feed parse error: {}", e))?;

    Ok((feed.injection_patterns, feed.cve_tool_patterns, feed.cve_ids))
}
