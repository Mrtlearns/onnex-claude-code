/// OWASP LLM Top 10 — bundled static patterns.
/// These cover the most common LLM-specific attack signatures.
pub fn load() -> (Vec<String>, Vec<String>) {
    let patterns = vec![
        // LLM01: Prompt Injection
        r"(?i)ignore\s+(all\s+)?previous\s+instructions".to_string(),
        r"(?i)disregard\s+(your\s+)?(system\s+prompt|instructions)".to_string(),
        r"(?i)you\s+are\s+now\s+(acting\s+as|playing|pretending\s+to\s+be)".to_string(),
        r"(?i)(jailbreak|bypass|override)\s+(your\s+)?(safety|filter|guardrail|restriction)".to_string(),
        r"(?i)forget\s+(everything|all)\s+(you\s+)?(were\s+)?(told|instructed|trained)".to_string(),
        r"(?i)(do\s+not\s+follow|don'?t\s+follow)\s+(your\s+)?(rules|guidelines|restrictions)".to_string(),
        r"(?i)(system\s+prompt|system\s+message)\s*[:=]".to_string(),
        r"(?i)(reveal|show|print|output|display)\s+(your\s+)?(system\s+prompt|instructions|training)".to_string(),
        r"(?i)act\s+as\s+(if\s+you\s+(are|were)\s+)?(a\s+)?(?:evil|uncensored|unfiltered|dan|dAN)".to_string(),
        r"(?i)new\s+instructions?\s*:".to_string(),
        // LLM02: Insecure Output Handling
        r"<script[^>]*>.*?</script>".to_string(),
        r"(?i)javascript\s*:".to_string(),
        // LLM06: Excessive Agency
        r"(?i)(execute|run|eval)\s+(arbitrary|any|all)\s+(code|command|script)".to_string(),
        // LLM07: Model Theft
        r"(?i)(extract|dump|copy|steal)\s+(the\s+)?(model|weights|training\s+data)".to_string(),
    ];

    let cve_ids = vec![
        "OWASP-LLM-01".to_string(),
        "OWASP-LLM-02".to_string(),
        "OWASP-LLM-06".to_string(),
        "OWASP-LLM-07".to_string(),
    ];

    (patterns, cve_ids)
}
