//! Lightweight heuristic complexity classifier.
//!
//! Routes "simple" prompts (short, no reasoning keywords) to cheaper models per the
//! module's `simple_downgrade` table. Not ML — deliberately cheap. Good enough to
//! capture the "what is X?" and "summarize Y" bulk that drives 60-80% of queries.

use crate::config::OptimizerConfig;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ComplexityClass {
    Simple,
    Moderate,
    Complex,
}

pub struct ModelRouter;

impl ModelRouter {
    /// Classify a prompt. Heuristics:
    /// - char count < 200 + no reasoning keywords = Simple
    /// - char count < 600                          = Moderate
    /// - otherwise                                 = Complex
    pub fn classify(prompt: &str) -> ComplexityClass {
        let trimmed = prompt.trim();
        let chars = trimmed.chars().count();
        let reasoning_markers = [
            "analyze",
            "compare",
            "step by step",
            "derivation",
            "proof",
            "architecture",
            "refactor",
            "design",
            "debug",
            "why ",
            "reason",
            "implement",
        ];
        let has_reasoning = reasoning_markers
            .iter()
            .any(|m| trimmed.to_ascii_lowercase().contains(m));
        let question_count = trimmed.chars().filter(|c| *c == '?').count();

        if chars < 200 && !has_reasoning && question_count <= 1 {
            ComplexityClass::Simple
        } else if chars < 600 && !has_reasoning {
            ComplexityClass::Moderate
        } else {
            ComplexityClass::Complex
        }
    }

    /// Decide a replacement model (or None). Returns the new model if routing is enabled
    /// and the classifier says Simple and the current model has a configured downgrade.
    pub fn route<'a>(
        cfg: &'a OptimizerConfig,
        current_model: &str,
        prompt: &str,
    ) -> Option<&'a str> {
        if !cfg.routing_enabled {
            return None;
        }
        if Self::classify(prompt) != ComplexityClass::Simple {
            return None;
        }
        cfg.simple_downgrade.get(current_model).map(|s| s.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn short_factoid_is_simple() {
        assert_eq!(ModelRouter::classify("What is the capital of France?"), ComplexityClass::Simple);
    }

    #[test]
    fn reasoning_keywords_escalate() {
        assert_eq!(
            ModelRouter::classify("Please analyze the reasoning behind this."),
            ComplexityClass::Complex
        );
    }

    #[test]
    fn long_prompt_is_complex() {
        let p = "x".repeat(700);
        assert_eq!(ModelRouter::classify(&p), ComplexityClass::Complex);
    }

    #[test]
    fn route_downgrades_simple_opus() {
        let cfg = OptimizerConfig::default();
        let target = ModelRouter::route(&cfg, "claude-opus-4-7", "What is 2+2?");
        assert_eq!(target, Some("claude-haiku-4-5"));
    }

    #[test]
    fn route_skips_complex() {
        let cfg = OptimizerConfig::default();
        let target = ModelRouter::route(
            &cfg,
            "claude-opus-4-7",
            "Please implement a red-black tree and analyze the worst-case step by step.",
        );
        assert!(target.is_none());
    }
}
