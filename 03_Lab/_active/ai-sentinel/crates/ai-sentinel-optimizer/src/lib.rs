//! AI-Sentinel Token Optimizer (L8).
//!
//! Three capabilities packaged as one module:
//! 1. **Semantic cache** — hash `(normalized_prompt, model, temperature)` → cached response.
//!    Avoids re-querying the upstream LLM for identical or near-identical prompts.
//! 2. **Model routing** — heuristic complexity classifier routes low-complexity prompts to
//!    cheaper models (e.g. `claude-opus-*` → `claude-haiku-*`) per module-local config.
//! 3. **Prompt compression** — deduplicates repeated system prompts, prunes low-relevance
//!    RAG docs before the upstream request leaves the gateway.
//!
//! The cache is primary in-memory (DashMap + LRU cap); Postgres is a restart snapshot.

pub mod cache;
pub mod config;
pub mod layer;
pub mod router;

pub use cache::{CachedResponse, SemanticCache};
pub use config::OptimizerConfig;
pub use layer::L8Optimizer;
pub use router::{ComplexityClass, ModelRouter};
