//! PolicyEngine — holds all currently-loaded rule sets, keyed by module id.
//!
//! Hot-reload:  `load_or_replace` accepts a fresh YAML + module_id; it compiles, then
//! atomically swaps the entry behind an `ArcSwap`. Evaluation borrows the current snapshot
//! via `engine.snapshot()` — never blocks on writers.

use crate::compiler::{compile_yaml, CompiledRuleSet};
use crate::evaluator::{evaluate, merge_decisions, EvalDecision, RuleContext, RuleMatch};
use crate::dsl::Trigger;
use arc_swap::ArcSwap;
use dashmap::DashMap;
use smallvec::SmallVec;
use std::sync::Arc;
use tracing::{info, warn};

#[derive(Debug, Clone)]
pub struct LoadedRuleSet {
    pub module_id: i64,
    pub module_name: String,
    pub enabled: bool,
    pub compiled: Arc<CompiledRuleSet>,
}

/// Shared, thread-safe policy engine. Cheap to clone (Arc under the hood).
#[derive(Clone, Default)]
pub struct PolicyEngine {
    /// Module id → loaded set. DashMap for concurrent upsert/remove without blocking.
    sets: Arc<DashMap<i64, LoadedRuleSet>>,
    /// Secondary index: trigger → module ids that have at least one rule for that trigger.
    /// Lets the evaluator skip untouched modules entirely (idle-trigger optimization).
    index: Arc<ArcSwap<TriggerIndex>>,
}

#[derive(Debug, Clone, Default)]
pub struct TriggerIndex(pub std::collections::HashMap<Trigger, Vec<i64>>);

impl PolicyEngine {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.sets.len()
    }

    pub fn is_empty(&self) -> bool {
        self.sets.is_empty()
    }

    /// Insert or replace a rule set. Rebuilds the trigger index.
    pub fn load_or_replace(
        &self,
        module_id: i64,
        module_name: String,
        enabled: bool,
        yaml: &str,
    ) -> Result<Arc<CompiledRuleSet>, crate::compiler::CompileError> {
        let compiled = Arc::new(compile_yaml(yaml)?);
        self.sets.insert(
            module_id,
            LoadedRuleSet {
                module_id,
                module_name: module_name.clone(),
                enabled,
                compiled: compiled.clone(),
            },
        );
        self.rebuild_index();
        info!(module_id, module_name = %module_name, rules = compiled.rules.len(), "policy: loaded rule set");
        Ok(compiled)
    }

    /// Toggle a module on/off without recompiling.
    pub fn set_enabled(&self, module_id: i64, enabled: bool) {
        if let Some(mut e) = self.sets.get_mut(&module_id) {
            e.enabled = enabled;
        }
        self.rebuild_index();
    }

    pub fn remove(&self, module_id: i64) {
        self.sets.remove(&module_id);
        self.rebuild_index();
    }

    fn rebuild_index(&self) {
        let mut idx: std::collections::HashMap<Trigger, Vec<i64>> = Default::default();
        for entry in self.sets.iter() {
            if !entry.enabled {
                continue;
            }
            for rule in &entry.compiled.rules {
                if !rule.enabled {
                    continue;
                }
                idx.entry(rule.trigger).or_default().push(entry.module_id);
            }
        }
        for v in idx.values_mut() {
            v.sort_unstable();
            v.dedup();
        }
        self.index.store(Arc::new(TriggerIndex(idx)));
    }

    /// Evaluate all relevant enabled modules for `trigger` with `ctx`. Fast-path: if no
    /// enabled module has a rule for this trigger, return an empty decision without
    /// touching any modules.
    pub fn evaluate_all(&self, trigger: Trigger, ctx: &RuleContext<'_>) -> EvalDecision {
        let idx = self.index.load();
        let Some(ids) = idx.0.get(&trigger) else {
            return EvalDecision::default();
        };
        if ids.is_empty() {
            return EvalDecision::default();
        }

        let mut all: Vec<RuleMatch> = Vec::new();
        for mid in ids {
            if let Some(entry) = self.sets.get(mid) {
                if !entry.enabled {
                    continue;
                }
                let matches: SmallVec<[RuleMatch; 4]> = evaluate(&entry.compiled, trigger, ctx);
                all.extend(matches.into_iter());
            }
        }

        merge_decisions(all)
    }

    /// List loaded modules (module_id, module_name, enabled, rule_count).
    pub fn loaded(&self) -> Vec<(i64, String, bool, usize)> {
        self.sets
            .iter()
            .map(|e| {
                (
                    e.module_id,
                    e.module_name.clone(),
                    e.enabled,
                    e.compiled.rules.len(),
                )
            })
            .collect()
    }

    pub fn warn_on_compile_errors(&self) {
        for e in self.sets.iter() {
            for err in &e.compiled.errors {
                warn!(module = %e.module_name, error = %err, "policy: rule compile error");
            }
        }
    }
}
