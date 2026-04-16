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
        }
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
