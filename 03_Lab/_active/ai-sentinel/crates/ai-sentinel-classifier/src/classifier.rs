use std::net::IpAddr;
use crate::{ClassifyResult, LlmProvider, ProviderSignatures};
use crate::signals::{ip_asn, payload_shape, sni, url_path};

/// 5-signal cascade classifier. Returns LlmTraffic on first match.
/// Signals evaluated in priority order: SNI > URL path > payload shape > IP/ASN.
/// If no signal fires: NonLlmTraffic (pass-through without decryption).
pub fn classify(
    hostname: Option<&str>,
    url_path_str: Option<&str>,
    body_sample: Option<&str>,
    src_ip: Option<&IpAddr>,
    sigs: &ProviderSignatures,
) -> ClassifyResult {
    // Signal 1: SNI (highest confidence — exact hostname match)
    if let Some(host) = hostname {
        if sni::matches(host, sigs) {
            return ClassifyResult::LlmTraffic {
                provider: provider_from_host(host),
                signals_matched: vec!["sni".to_string()],
            };
        }
    }

    // Signal 2: URL path prefix
    if let Some(path) = url_path_str {
        if url_path::matches(path, sigs) {
            return ClassifyResult::LlmTraffic {
                provider: LlmProvider::Unknown,
                signals_matched: vec!["url_path".to_string()],
            };
        }
    }

    // Signal 3: JSON payload shape heuristic
    if let Some(body) = body_sample {
        if payload_shape::matches(body) {
            return ClassifyResult::LlmTraffic {
                provider: LlmProvider::Unknown,
                signals_matched: vec!["payload_shape".to_string()],
            };
        }
    }

    // Signal 4: IP/ASN lookup (conservative, low false-positive rate)
    if let Some(ip) = src_ip {
        if ip_asn::matches(ip) {
            return ClassifyResult::LlmTraffic {
                provider: LlmProvider::Unknown,
                signals_matched: vec!["ip_asn".to_string()],
            };
        }
    }

    ClassifyResult::NonLlmTraffic
}

fn provider_from_host(host: &str) -> LlmProvider {
    match host {
        h if h.contains("anthropic.com") => LlmProvider::Anthropic,
        h if h.contains("openai.com") => LlmProvider::OpenAi,
        h if h.contains("googleapis.com") => LlmProvider::Google,
        h if h.contains("groq.com") => LlmProvider::Groq,
        h if h.contains("mistral.ai") => LlmProvider::Mistral,
        _ => LlmProvider::Unknown,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ProviderSignatures;

    fn sigs() -> ProviderSignatures { ProviderSignatures::default() }

    #[test]
    fn anthropic_sni_classified() {
        let r = classify(Some("api.anthropic.com"), None, None, None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { provider: LlmProvider::Anthropic, .. }));
    }

    #[test]
    fn openai_sni_classified() {
        let r = classify(Some("api.openai.com"), None, None, None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { provider: LlmProvider::OpenAi, .. }));
    }

    #[test]
    fn gemini_sni_classified() {
        let r = classify(Some("generativelanguage.googleapis.com"), None, None, None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { provider: LlmProvider::Google, .. }));
    }

    #[test]
    fn groq_sni_classified() {
        let r = classify(Some("api.groq.com"), None, None, None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { provider: LlmProvider::Groq, .. }));
    }

    #[test]
    fn github_not_classified() {
        let body = r#"{"ref":"main","repository":{"name":"my-repo"}}"#;
        let r = classify(Some("github.com"), Some("/repos/owner/repo"), Some(body), None, &sigs());
        assert!(matches!(r, ClassifyResult::NonLlmTraffic));
    }

    #[test]
    fn stripe_not_classified() {
        let r = classify(Some("api.stripe.com"), Some("/v1/charges"), None, None, &sigs());
        assert!(matches!(r, ClassifyResult::NonLlmTraffic));
    }

    #[test]
    fn npm_not_classified() {
        let r = classify(Some("registry.npmjs.org"), Some("/@scope/package"), None, None, &sigs());
        assert!(matches!(r, ClassifyResult::NonLlmTraffic));
    }

    #[test]
    fn llm_body_without_sni_classified_by_payload() {
        let body = r#"{"model":"claude-haiku-4-5","messages":[{"role":"user","content":"hi"}]}"#;
        let r = classify(None, None, Some(body), None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { .. }));
    }

    #[test]
    fn known_llm_url_path_classified() {
        let r = classify(None, Some("/v1/chat/completions"), None, None, &sigs());
        assert!(matches!(r, ClassifyResult::LlmTraffic { .. }));
    }
}
