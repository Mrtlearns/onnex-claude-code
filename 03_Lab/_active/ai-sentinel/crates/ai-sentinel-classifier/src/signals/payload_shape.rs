/// Signal 3: JSON body shape heuristic — does this look like an LLM API request?
/// Checks for the presence of "messages" array + "model" key (Anthropic/OpenAI pattern)
/// or "contents" array (Gemini pattern).
pub fn matches(body_sample: &str) -> bool {
    if body_sample.is_empty() {
        return false;
    }
    let b = body_sample.as_bytes();
    // Fast byte scan — no JSON parsing, no allocation
    let has_messages = memmem(b, b"\"messages\"");
    let has_model = memmem(b, b"\"model\"");
    let has_contents = memmem(b, b"\"contents\"");
    let has_prompt = memmem(b, b"\"prompt\"");

    (has_messages && has_model) || has_contents || (has_prompt && has_model)
}

fn memmem(haystack: &[u8], needle: &[u8]) -> bool {
    haystack.windows(needle.len()).any(|w| w == needle)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn anthropic_body_matches() {
        let body = r#"{"model":"claude-haiku-4-5","messages":[{"role":"user","content":"hi"}],"max_tokens":10}"#;
        assert!(matches(body));
    }

    #[test]
    fn openai_body_matches() {
        let body = r#"{"model":"gpt-4o","messages":[{"role":"user","content":"hi"}]}"#;
        assert!(matches(body));
    }

    #[test]
    fn gemini_body_matches() {
        let body = r#"{"contents":[{"parts":[{"text":"hi"}]}]}"#;
        assert!(matches(body));
    }

    #[test]
    fn stripe_body_does_not_match() {
        let body = r#"{"amount":1000,"currency":"usd","source":"tok_visa"}"#;
        assert!(!matches(body));
    }

    #[test]
    fn empty_body_does_not_match() {
        assert!(!matches(""));
    }
}
