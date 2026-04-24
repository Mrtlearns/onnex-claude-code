//! AI-Sentinel Rules Engine
//!
//! Modular, admin-editable YAML policy engine. Each `Module` of kind `rules` owns one or
//! more rule sets. Rule sets declare rules with triggers, conditions, and actions. The
//! compiler translates YAML into a `CompiledRuleSet` with pre-compiled regex, AST nodes,
//! and priority ordering. The evaluator walks matching rules for a given trigger and
//! merges their actions into a single decision.
//!
//! Performance contract:
//! - <200 µs when no rules match a trigger (idle triggers skip work via DashMap index)
//! - <1 ms for 50 active rules across all loaded modules
//! - Zero allocations on the happy path where possible (SmallVec for match buffers)

pub mod dsl;
pub mod compiler;
pub mod evaluator;
pub mod engine;
pub mod hook;

pub use dsl::{
    Action, ActionSpec, Condition, RedactSpec, RejectSpec, RewriteSpec, RouteSpec, Rule,
    RuleSet, Severity, Trigger,
};
pub use compiler::{compile_yaml, CompileError, CompiledRule, CompiledRuleSet};
pub use evaluator::{evaluate, EvalDecision, RuleContext, RuleMatch};
pub use engine::{LoadedRuleSet, PolicyEngine};
