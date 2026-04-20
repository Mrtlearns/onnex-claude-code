use crate::ProviderSignatures;

/// Signal 1: exact SNI hostname match against known LLM provider list.
pub fn matches(hostname: &str, sigs: &ProviderSignatures) -> bool {
    sigs.sni_exact.iter().any(|h| h.eq_ignore_ascii_case(hostname))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ProviderSignatures;

    fn sigs() -> ProviderSignatures { ProviderSignatures::default() }

    #[test]
    fn known_providers_match() {
        let s = sigs();
        assert!(matches("api.anthropic.com", &s));
        assert!(matches("api.openai.com", &s));
        assert!(matches("generativelanguage.googleapis.com", &s));
        assert!(matches("api.groq.com", &s));
    }

    #[test]
    fn non_llm_hosts_do_not_match() {
        let s = sigs();
        assert!(!matches("github.com", &s));
        assert!(!matches("stripe.com", &s));
        assert!(!matches("registry.npmjs.org", &s));
        assert!(!matches("google.com", &s));
        assert!(!matches("api.github.com", &s));
    }
}
