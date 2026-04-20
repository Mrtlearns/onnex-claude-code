use std::sync::{Arc, RwLock};
use serde::{Deserialize, Serialize};
use regex::RegexSet;

/// A compiled set of threat signatures loaded from feed sources.
#[derive(Debug, Default)]
pub struct SignatureSet {
    /// Patterns for prompt/payload threat matching
    pub injection_patterns: Vec<String>,
    /// Tool names/patterns mapped from CVEs
    pub cve_tool_patterns: Vec<String>,
    /// CVE IDs for informational metadata
    pub cve_ids: Vec<String>,
    /// Compiled regex for fast matching
    compiled_injection: Option<RegexSet>,
    compiled_tools: Option<RegexSet>,

    // ── Gateway fields (Phase 4) ──────────────────────────────────────────────

    /// Known LLM provider hostnames for SNI matching (e.g. "api.anthropic.com")
    pub sni_patterns: Vec<String>,
    /// URL path prefixes that indicate LLM API traffic (e.g. "/v1/messages")
    pub url_path_patterns: Vec<String>,
    /// Compiled regex for SNI matching
    compiled_sni: Option<RegexSet>,
    /// Compiled regex for URL path matching
    compiled_url_paths: Option<RegexSet>,
}

impl SignatureSet {
    pub fn new(
        injection_patterns: Vec<String>,
        cve_tool_patterns: Vec<String>,
        cve_ids: Vec<String>,
    ) -> Self {
        let compiled_injection = RegexSet::new(&injection_patterns).ok();
        let compiled_tools = RegexSet::new(&cve_tool_patterns).ok();
        SignatureSet {
            injection_patterns,
            cve_tool_patterns,
            cve_ids,
            compiled_injection,
            compiled_tools,
            sni_patterns: Vec::new(),
            url_path_patterns: Vec::new(),
            compiled_sni: None,
            compiled_url_paths: None,
        }
    }

    pub fn with_provider_data(mut self, sni_patterns: Vec<String>, url_path_patterns: Vec<String>) -> Self {
        self.compiled_sni = RegexSet::new(&sni_patterns).ok();
        self.compiled_url_paths = RegexSet::new(&url_path_patterns).ok();
        self.sni_patterns = sni_patterns;
        self.url_path_patterns = url_path_patterns;
        self
    }

    pub fn matches_threat(&self, text: &str) -> bool {
        if let Some(ref rs) = self.compiled_injection {
            return rs.is_match(text);
        }
        false
    }

    pub fn matches_tool_cve(&self, tool_name: &str) -> bool {
        if let Some(ref rs) = self.compiled_tools {
            return rs.is_match(tool_name);
        }
        false
    }

    /// Returns true if the hostname matches a known LLM provider SNI pattern.
    pub fn matches_sni(&self, hostname: &str) -> bool {
        if let Some(ref rs) = self.compiled_sni {
            return rs.is_match(hostname);
        }
        // Fallback: exact match in list
        self.sni_patterns.iter().any(|p| p == hostname)
    }

    /// Returns true if the URL path matches a known LLM API path pattern.
    pub fn matches_url_path(&self, path: &str) -> bool {
        if let Some(ref rs) = self.compiled_url_paths {
            return rs.is_match(path);
        }
        self.url_path_patterns.iter().any(|p| path.starts_with(p.as_str()))
    }

    pub fn pattern_count(&self) -> usize {
        self.injection_patterns.len() + self.cve_tool_patterns.len()
    }

    pub fn cve_count(&self) -> usize {
        self.cve_ids.len()
    }
}

/// Thread-safe container for the live signature set.
/// Supports atomic hot-swap with zero service restart.
#[derive(Clone)]
pub struct LiveSignatures {
    inner: Arc<RwLock<Arc<SignatureSet>>>,
}

impl LiveSignatures {
    pub fn new(initial: SignatureSet) -> Self {
        LiveSignatures {
            inner: Arc::new(RwLock::new(Arc::new(initial))),
        }
    }

    /// Get the current signature set. Readers never block.
    pub fn get(&self) -> Arc<SignatureSet> {
        self.inner.read().unwrap().clone()
    }

    /// Atomically swap in a new signature set.
    /// Writer locks for microseconds, readers not affected.
    pub fn swap(&self, new_set: SignatureSet) {
        let mut guard = self.inner.write().unwrap();
        *guard = Arc::new(new_set);
    }

    pub fn stats(&self) -> SignatureStats {
        let set = self.get();
        SignatureStats {
            pattern_count: set.pattern_count(),
            cve_count: set.cve_count(),
        }
    }
}

impl Default for LiveSignatures {
    fn default() -> Self {
        LiveSignatures::new(SignatureSet::default())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureStats {
    pub pattern_count: usize,
    pub cve_count: usize,
}
