/// CrowdSec CTI feed integration.
/// Fetches LLM-related threat indicators from CrowdSec CTI API.

pub async fn fetch(api_key: &str) -> anyhow::Result<(Vec<String>, Vec<String>)> {
    // CrowdSec CTI API for LLM-related indicators
    // Real integration: GET https://cti.api.crowdsec.net/v2/smoke?query=llm
    // For Phase 1: return stub + log that real key would be used
    tracing::debug!("crowdsec: fetching with key {}...", &api_key[..4.min(api_key.len())]);

    // TODO: Phase 2 — implement full CrowdSec CTI REST fetch
    // For now return empty (feed won't fail, just won't have crowdsec patterns)
    Ok((vec![], vec![]))
}
