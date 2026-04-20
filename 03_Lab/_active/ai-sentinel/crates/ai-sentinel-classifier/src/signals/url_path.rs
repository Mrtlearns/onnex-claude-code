use crate::ProviderSignatures;

/// Signal 2: URL path prefix match against known LLM API path list.
pub fn matches(url_path: &str, sigs: &ProviderSignatures) -> bool {
    sigs.url_path_prefixes.iter().any(|p| url_path.starts_with(p.as_str()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ProviderSignatures;

    fn sigs() -> ProviderSignatures { ProviderSignatures::default() }

    #[test]
    fn llm_paths_match() {
        let s = sigs();
        assert!(matches("/v1/messages", &s));
        assert!(matches("/v1/messages?stream=true", &s));
        assert!(matches("/v1/chat/completions", &s));
        assert!(matches("/v1/generateContent", &s));
    }

    #[test]
    fn non_llm_paths_do_not_match() {
        let s = sigs();
        assert!(!matches("/repos/owner/repo", &s));
        assert!(!matches("/v1/charges", &s));
        assert!(!matches("/", &s));
    }
}
