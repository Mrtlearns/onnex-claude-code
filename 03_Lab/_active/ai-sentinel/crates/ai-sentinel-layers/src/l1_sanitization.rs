use async_trait::async_trait;
use regex::RegexSet;
use tracing::{debug, warn};
use std::sync::Arc;

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
};

// Injection patterns (seed set — augmented from L2.3 feed at runtime)
const INJECTION_PATTERNS: &[&str] = &[
    r"(?i)ignore\s+(all\s+)?previous\s+instructions",
    r"(?i)disregard\s+(your\s+)?(system\s+prompt|instructions)",
    r"(?i)you\s+are\s+now\s+(acting\s+as|playing|pretending\s+to\s+be)",
    r"(?i)(jailbreak|bypass|override)\s+(your\s+)?(safety|filter|guardrail|restriction)",
    r"(?i)forget\s+(everything|all)\s+(you\s+)?(were\s+)?(told|instructed|trained)",
    r"(?i)(do\s+not\s+follow|don'?t\s+follow)\s+(your\s+)?(rules|guidelines|restrictions)",
    r"(?i)(reveal|show|print|output|display)\s+(your\s+)?(system\s+prompt|instructions|training)",
    r"(?i)act\s+as\s+(if\s+you\s+(are|were)\s+)?(a\s+)?(?:evil|uncensored|unfiltered|dan)",
    r"(?i)new\s+instructions?\s*:",
    r"(?i)(you\s+must\s+now|from\s+now\s+on)\s+(ignore|forget|bypass)",
    r"<\|im_start\|>system",
    r"\[INST\].*ignore.*\[/INST\]",
];

// PII regex fallback patterns
const PII_PATTERNS: &[(&str, &str)] = &[
    (r"\b\d{3}-\d{2}-\d{4}\b", "SSN"),
    (r"\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b", "PHONE"),
    (r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b", "EMAIL"),
    (r"\b4[0-9]{12}(?:[0-9]{3})?\b", "CREDIT_CARD_VISA"),
    (r"\b5[1-5][0-9]{14}\b", "CREDIT_CARD_MC"),
];

pub struct L1Sanitization {
    injection_set: RegexSet,
    pii_patterns: Vec<(regex::Regex, String)>,
    max_tokens: u32,
    presidio_url: Option<String>,
    strip_pii: bool,
}

impl L1Sanitization {
    pub fn new(config: &AppConfig) -> anyhow::Result<Self> {
        let injection_set = RegexSet::new(INJECTION_PATTERNS)
            .map_err(|e| anyhow::anyhow!("L1 injection regex compile: {}", e))?;

        let pii_patterns = PII_PATTERNS
            .iter()
            .map(|(pat, label)| {
                regex::Regex::new(pat)
                    .map(|r| (r, label.to_string()))
                    .map_err(|e| anyhow::anyhow!("L1 PII regex {}: {}", label, e))
            })
            .collect::<anyhow::Result<Vec<_>>>()?;

        Ok(L1Sanitization {
            injection_set,
            pii_patterns,
            max_tokens: config.rate_max_tokens_per_request,
            presidio_url: config.presidio_url.clone(),
            strip_pii: true, // Always strip rather than reject in Phase 1
        })
    }

    fn estimate_tokens(text: &str) -> u32 {
        // Rough heuristic: 1 token ≈ 4 chars
        (text.len() as u32).saturating_div(4)
    }

    fn extract_text(payload: &serde_json::Value) -> String {
        match payload {
            serde_json::Value::String(s) => s.clone(),
            serde_json::Value::Object(m) => {
                // Try common keys
                for key in &["content", "prompt", "text", "message", "input"] {
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
                result = re.replace_all(&result, &format!("[REDACTED_{}]", label)).to_string();
                stripped = true;
            }
        }
        (result, stripped)
    }

    async fn call_presidio(&self, text: &str) -> Option<String> {
        let url = self.presidio_url.as_ref()?;
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(10))
            .build()
            .ok()?;

        let body = serde_json::json!({
            "text": text,
            "language": "en",
        });

        let resp = client
            .post(&format!("{}/analyze", url))
            .json(&body)
            .send()
            .await
            .ok()?;

        if !resp.status().is_success() {
            return None;
        }

        // Parse Presidio response and redact entities
        let entities: Vec<serde_json::Value> = resp.json().await.ok()?;
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
impl Layer for L1Sanitization {
    fn id(&self) -> &'static str { "l1" }
    fn name(&self) -> &'static str { "Input Sanitization" }
    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, _ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        let text = Self::extract_text(&req.payload);

        // 1. Token budget check (0 = unlimited)
        let tokens = Self::estimate_tokens(&text);
        if self.max_tokens > 0 && tokens > self.max_tokens {
            return Ok(LayerResult::Reject {
                code: "TOKEN_BUDGET_EXCEEDED".to_string(),
                reason: format!("Estimated {} tokens exceeds limit of {}", tokens, self.max_tokens),
                severity: Severity::Medium,
            });
        }

        // 2. Injection detection
        if self.injection_set.is_match(&text) {
            let matches: Vec<&str> = self.injection_set
                .patterns()
                .iter()
                .enumerate()
                .filter(|(i, _)| self.injection_set.matches(&text).matched(*i))
                .map(|(_, p)| p.as_str())
                .collect();
            debug!(patterns = ?matches, "L1: injection detected");
            return Ok(LayerResult::Reject {
                code: "PROMPT_INJECTION".to_string(),
                reason: "Prompt injection pattern detected".to_string(),
                severity: Severity::High,
            });
        }

        // 3. PII detection — try Presidio first, fall back to regex
        let (cleaned, pii_found) = if let Some(redacted) = self.call_presidio(&text).await {
            let changed = redacted != text;
            (redacted, changed)
        } else {
            self.strip_pii_regex(&text)
        };

        if pii_found {
            // Return mutated payload with PII stripped
            let mut new_payload = req.payload.clone();
            match &mut new_payload {
                serde_json::Value::String(s) => *s = cleaned,
                serde_json::Value::Object(m) => {
                    for key in &["content", "prompt", "text", "message", "input"] {
                        if m.contains_key(*key) {
                            m.insert(key.to_string(), serde_json::Value::String(cleaned.clone()));
                            break;
                        }
                    }
                }
                _ => {}
            }
            debug!("L1: PII stripped from payload");
            return Ok(LayerResult::Mutate { payload: new_payload });
        }

        Ok(LayerResult::Pass)
    }
}
