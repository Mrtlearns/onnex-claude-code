/// NVD (National Vulnerability Database) feed integration.
/// Fetches CVEs relevant to LLM/AI tooling.

pub async fn fetch(api_key: &str) -> anyhow::Result<(Vec<String>, Vec<String>)> {
    // NVD API: GET https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=LLM
    tracing::debug!("nvd: fetching with key {}...", &api_key[..4.min(api_key.len())]);

    // TODO: Phase 2 — implement full NVD REST fetch with keywordSearch=LLM+agent
    // Returns (tool_patterns, cve_ids)
    Ok((vec![], vec![]))
}
