// L6 — Output Inspection
// Phase 2: SSRF protection, exfiltration pattern detection, egress PII scan.

use async_trait::async_trait;
use regex::{Regex, RegexSet};
use tracing::debug;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};

/// SSRF: private IP ranges + cloud metadata endpoints
const SSRF_PATTERNS: &[&str] = &[
    // IPv4 private ranges
    r"https?://10\.\d{1,3}\.\d{1,3}\.\d{1,3}",
    r"https?://172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}",
    r"https?://192\.168\.\d{1,3}\.\d{1,3}",
    r"https?://127\.\d{1,3}\.\d{1,3}\.\d{1,3}",
    r"https?://0\.0\.0\.0",
    // Cloud metadata endpoints
    r"169\.254\.169\.254",
    r"169\.254\.170\.2",
    r"metadata\.google\.internal",
    r"169\.254\.169\.254/latest/meta-data",
    // IPv6 loopback and link-local
    r"https?://\[::1\]",
    r"https?://\[fe80::",
    // localhost variants
    r"https?://localhost[:/]",
    r"https?://\[0:0:0:0:0:0:0:1\]",
];

/// Exfiltration: patterns that suggest bulk data exfiltration
const EXFIL_PATTERNS: &[&str] = &[
    // Large base64 block (>100 chars of base64 chars)
    r"[A-Za-z0-9+/]{100,}={0,2}",
    // PGP/GPG message blocks
    r"-----BEGIN PGP",
    r"-----BEGIN RSA PRIVATE KEY",
    r"-----BEGIN PRIVATE KEY",
    r"-----BEGIN CERTIFICATE",
    // SQL dump markers
    r"(?i)INSERT INTO .{1,100} VALUES",
    r"(?i)CREATE TABLE .{1,60}\(",
    // AWS credential patterns
    r"AKIA[0-9A-Z]{16}",
    // JWT token pattern (header.payload.sig)
    r"eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+",
    // Credential keyword dumps
    r"(?i)(password|passwd|secret|api.?key|access.?token)\s*[:=]\s*\S{8,}",
];

/// PII patterns for egress (same as L1 but applied to Egress)
const EGRESS_PII_PATTERNS: &[(&str, &str)] = &[
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
    (r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b", "PHONE"),
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", "EMAIL"),
    (r"\b4[0-9]{12}(?:[0-9]{3})?\b", "CREDIT_CARD_VISA"),
    (r"\b5[1-5][0-9]{14}\b", "CREDIT_CARD_MC"),
];

pub struct L6Output {
    ssrf_set: RegexSet,
    exfil_set: RegexSet,
    pii_patterns: Vec<(Regex, String)>,
    presidio_url: Option<String>,
}

impl L6Output {
    pub fn new(config: &AppConfig) -> anyhow::Result<Self> {
        let ssrf_set = RegexSet::new(SSRF_PATTERNS)
            .map_err(|e| anyhow::anyhow!("L6 SSRF regex compile: {}", e))?;
        let exfil_set = RegexSet::new(EXFIL_PATTERNS)
            .map_err(|e| anyhow::anyhow!("L6 exfil regex compile: {}", e))?;
        let pii_patterns = EGRESS_PII_PATTERNS
            .iter()
            .map(|(pat, label)| {
                Regex::new(pat)
                    .map(|r| (r, label.to_string()))
                    .map_err(|e| anyhow::anyhow!("L6 PII regex {}: {}", label, e))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        Ok(L6Output {
            ssrf_set,
            exfil_set,
            pii_patterns,
            presidio_url: config.presidio_url.clone(),
        })
    }

    fn extract_text(payload: &serde_json::Value) -> String {
        match payload {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(m) => {
                for key in &["content", "output", "text", "response", "message", "result"] {
                    if let Some(v) = m.get(*key) {
                        if let Some(s) = v.as_str() {
                            return s.to_string();
                        }
                    }
                }
                serde_json::to_string(payload).unwrap_or_default()
            }
            _ => serde_json::to_string(payload).unwrap_or_default(),
        }
    }

    fn strip_pii_regex(&self, text: &str) -> (String, bool) {
        let mut result = text.to_string();
        let mut stripped = false;
        for (re, label) in &self.pii_patterns {
            if re.is_match(&result) {
                result = re.replace_all(&result, format!("[REDACTED_{}]", label).as_str()).to_string();
                stripped = true;
            }
        }
        (result, stripped)
    }

    async fn call_presidio(&self, text: &str) -> Option<String> {
        let url = self.presidio_url.as_ref()?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(20))
            .build()
            .ok()?;

        let body = serde_json::json!({ "text": text, "language": "en" });
        let resp = client
            .post(&format!("{}/analyze", url))
            .json(&body)
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() { return None; }

        let entities: Vec<serde_json::Value> = resp.json().await.ok()?;
        if entities.is_empty() { return None; }

        let mut result = text.to_string();
        let mut offset: i64 = 0;
        let mut sorted = entities.clone();
        sorted.sort_by_key(|e| e["start"].as_i64().unwrap_or(0));

        for entity in sorted {
            let start = entity["start"].as_i64()? as usize;
            let end = entity["end"].as_i64()? as usize;
            let entity_type = entity["entity_type"].as_str().unwrap_or("PII");
            let replacement = format!("[REDACTED_{}]", entity_type);
            let adj_start = (start as i64 + offset) as usize;
            let adj_end = (end as i64 + offset) as usize;
            if adj_end <= result.len() {
                let old_len = adj_end - adj_start;
                result.replace_range(adj_start..adj_end, &replacement);
                offset += replacement.len() as i64 - old_len as i64;
            }
        }
        Some(result)
    }
}

#[async_trait]
impl Layer for L6Output {
    fn id(&self) -> &'static str { "l6" }
    fn name(&self) -> &'static str { "Output Inspection" }

    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Egress
    }

    async fn check(&self, req: &CheckRequest, ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        let text = Self::extract_text(&req.payload);

        // 1. SSRF URL detection
        if self.ssrf_set.is_match(&text) {
            let matched: Vec<&str> = self.ssrf_set.patterns()
                .iter()
                .enumerate()
                .filter(|(i, _)| self.ssrf_set.matches(&text).matched(*i))
                .map(|(_, p)| p.as_str())
                .collect();
            debug!(request_id = %ctx.request_id, patterns = ?matched, "L6: SSRF URL detected");
            return Ok(LayerResult::Reject {
                code: "SSRF_URL".to_string(),
                reason: "Egress payload contains private/metadata IP URL (SSRF risk)".to_string(),
                severity: Severity::Critical,
            });
        }

        // 2. Exfiltration pattern detection
        if self.exfil_set.is_match(&text) {
            let matched: Vec<&str> = self.exfil_set.patterns()
                .iter()
                .enumerate()
                .filter(|(i, _)| self.exfil_set.matches(&text).matched(*i))
                .map(|(_, p)| p.as_str())
                .collect();
            debug!(request_id = %ctx.request_id, patterns = ?matched, "L6: exfiltration pattern detected");
            return Ok(LayerResult::Reject {
                code: "EXFILTRATION_PATTERN".to_string(),
                reason: "Egress payload matches exfiltration pattern".to_string(),
                severity: Severity::High,
            });
        }

        // 3. Egress PII scan — strip (mutate), don't reject
        let (cleaned, pii_found) = if let Some(redacted) = self.call_presidio(&text).await {
            let changed = redacted != text;
            (redacted, changed)
        } else {
            self.strip_pii_regex(&text)
        };

        if pii_found {
            debug!(request_id = %ctx.request_id, "L6: PII stripped from egress payload");
            let mut new_payload = req.payload.clone();
            match &mut new_payload {
                serde_json::Value::String(s) => *s = cleaned,
                serde_json::Value::Object(m) => {
                    for key in &["content", "output", "text", "response", "message", "result"] {
                        if m.contains_key(*key) {
                            m.insert(key.to_string(), serde_json::Value::String(cleaned.clone()));
                            break;
                        }
                    }
                }
                _ => {}
            }
            return Ok(LayerResult::Mutate { payload: new_payload });
        }

        Ok(LayerResult::Pass)
    }
}
