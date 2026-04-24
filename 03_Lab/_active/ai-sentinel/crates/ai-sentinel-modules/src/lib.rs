//! Module lifecycle primitives for AI-Sentinel.
//!
//! Every pluggable capability (rules engine, token optimizer, context bank, future) is a
//! `Module` with a `ModuleKind` discriminant, versioned YAML config, and a CRUD audit trail.
//!
//! Wire contract:
//! - Admin CRUD operations go through a `ModuleStore` impl (Postgres in production).
//! - Every write produces a `ModuleAuditRecord` in a SHA-256 hash chain.
//! - Consumer crates (`ai-sentinel-rules`, `ai-sentinel-optimizer`, `ai-sentinel-context`)
//!   subscribe to the update broadcast and hot-reload their internal state.

pub mod audit;
pub mod store;
pub mod types;

pub use audit::ModuleAuditChain;
pub use store::{ModuleStore, PostgresModuleStore};
pub use types::{
    LicenseTier, Module, ModuleAction, ModuleAuditRecord, ModuleKind, ModuleUpdate,
    ModuleVersion, NewModule,
};
