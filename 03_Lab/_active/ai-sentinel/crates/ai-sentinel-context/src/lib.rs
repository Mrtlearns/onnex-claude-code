//! AI-Sentinel Context Bank.
//!
//! Captures conversation turns into a model-agnostic pgvector-backed store. Summarization
//! jobs reduce accumulated context into compressed summaries on a 12-hour cadence. The
//! read API exposes cosine-similarity search over embeddings so downstream tooling can
//! retrieve context without depending on any single LLM provider.
//!
//! Non-goals for v5.0: RAG re-ranking, knowledge-graph extraction, multi-tenant isolation.

pub mod capture;
pub mod embedder;
pub mod store;
pub mod summarizer;

pub use capture::{CaptureRequest, ContextCapture};
pub use embedder::{Embedder, OllamaEmbedder};
pub use store::{ContextEntry, ContextStore, ContextSummary};
pub use summarizer::{SummarizationConfig, SummarizationWorker};
