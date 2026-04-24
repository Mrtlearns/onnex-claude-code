//! YAML → `CompiledRuleSet`.
//!
//! The compiler owns the cost of regex compilation and AST allocation. At steady state,
//! the evaluator just borrows from a shared `CompiledRuleSet` and does hot-path matching.
//!
//! Errors in a single rule do not fail the whole set — they are collected and the rule is
//! marked `compiled = false` so the admin dashboard can surface the problem.

use crate::dsl::{Condition, ConditionBlock, Rule, RuleSet, Trigger};
use regex::Regex;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CompileError {
    #[error("YAML parse error: {0}")]
    Yaml(#[from] serde_yaml::Error),
    #[error("rule `{rule}` regex `{pattern}` is invalid: {source}")]
    BadRegex {
        rule: String,
        pattern: String,
        #[source]
        source: regex::Error,
    },
    #[error("rule `{0}` has no compiled conditions")]
    EmptyConditions(String),
}

/// Compiled form of a `Rule`. Holds pre-compiled regex and evaluated AST.
#[derive(Debug, Clone)]
pub struct CompiledRule {
    pub name: String,
    pub trigger: Trigger,
    pub priority: i32,
    pub enabled: bool,
    pub conditions: CompiledConditions,
    pub actions: Vec<crate::dsl::ActionSpec>,
}

#[derive(Debug, Clone)]
pub enum CompiledConditions {
    AnyOf(Vec<CompiledCondition>),
    AllOf(Vec<CompiledCondition>),
    Leaf(CompiledCondition),
}

/// Mirror of `Condition` with regex pre-compiled.
#[derive(Debug, Clone)]
pub enum CompiledCondition {
    Regex(Regex),
    RegexNamedCapture { regex: Regex, group: String },
    Intent { category: String, confidence_gte: f32 },
    PiiCategory(String),
    CostGt(f64),
    TokensGt(u32),
    CallerRole(String),
    TimeOfDay { from_minutes: u16, to_minutes: u16 },
    Always,
}

#[derive(Debug, Clone)]
pub struct CompiledRuleSet {
    pub module: String,
    pub version: u32,
    pub license_tier: String,
    pub rules: Vec<CompiledRule>,
    /// Errors encountered for individual rules (not fatal for the whole set).
    pub errors: Vec<String>,
}

pub fn compile_yaml(yaml: &str) -> Result<CompiledRuleSet, CompileError> {
    let set: RuleSet = serde_yaml::from_str(yaml)?;
    compile_rule_set(set)
}

pub fn compile_rule_set(set: RuleSet) -> Result<CompiledRuleSet, CompileError> {
    let mut compiled = Vec::with_capacity(set.rules.len());
    let mut errors = Vec::new();

    for rule in set.rules {
        match compile_rule(&rule) {
            Ok(cr) => compiled.push(cr),
            Err(e) => errors.push(e.to_string()),
        }
    }

    // Sort by priority DESC so evaluator sees decisive rules first.
    compiled.sort_by(|a, b| b.priority.cmp(&a.priority));

    Ok(CompiledRuleSet {
        module: set.module,
        version: set.version,
        license_tier: set.license_tier,
        rules: compiled,
        errors,
    })
}

fn compile_rule(rule: &Rule) -> Result<CompiledRule, CompileError> {
    let conds = match &rule.conditions {
        ConditionBlock::AnyOf { any_of } => {
            let mut v = Vec::with_capacity(any_of.len());
            for c in any_of {
                v.push(compile_condition(&rule.name, c)?);
            }
            if v.is_empty() {
                return Err(CompileError::EmptyConditions(rule.name.clone()));
            }
            CompiledConditions::AnyOf(v)
        }
        ConditionBlock::AllOf { all_of } => {
            let mut v = Vec::with_capacity(all_of.len());
            for c in all_of {
                v.push(compile_condition(&rule.name, c)?);
            }
            if v.is_empty() {
                return Err(CompileError::EmptyConditions(rule.name.clone()));
            }
            CompiledConditions::AllOf(v)
        }
        ConditionBlock::Leaf(c) => CompiledConditions::Leaf(compile_condition(&rule.name, c)?),
    };

    Ok(CompiledRule {
        name: rule.name.clone(),
        trigger: rule.trigger,
        priority: rule.priority,
        enabled: rule.enabled,
        conditions: conds,
        actions: rule.actions.clone(),
    })
}

fn compile_condition(rule_name: &str, c: &Condition) -> Result<CompiledCondition, CompileError> {
    match c {
        Condition::Regex(p) => Regex::new(p)
            .map(CompiledCondition::Regex)
            .map_err(|e| CompileError::BadRegex {
                rule: rule_name.to_string(),
                pattern: p.clone(),
                source: e,
            }),
        Condition::RegexNamedCapture { pattern, group } => Regex::new(pattern)
            .map(|regex| CompiledCondition::RegexNamedCapture {
                regex,
                group: group.clone(),
            })
            .map_err(|e| CompileError::BadRegex {
                rule: rule_name.to_string(),
                pattern: pattern.clone(),
                source: e,
            }),
        Condition::Intent { category, confidence_gte } => Ok(CompiledCondition::Intent {
            category: category.clone(),
            confidence_gte: *confidence_gte,
        }),
        Condition::PiiCategory(s) => Ok(CompiledCondition::PiiCategory(s.clone())),
        Condition::CostGt(v) => Ok(CompiledCondition::CostGt(*v)),
        Condition::TokensGt(v) => Ok(CompiledCondition::TokensGt(*v)),
        Condition::CallerRole(s) => Ok(CompiledCondition::CallerRole(s.clone())),
        Condition::TimeOfDay { from, to } => {
            let from_m = parse_hhmm(from);
            let to_m = parse_hhmm(to);
            Ok(CompiledCondition::TimeOfDay { from_minutes: from_m, to_minutes: to_m })
        }
        Condition::Always => Ok(CompiledCondition::Always),
    }
}

fn parse_hhmm(s: &str) -> u16 {
    let mut iter = s.splitn(2, ':');
    let h: u16 = iter.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    let m: u16 = iter.next().and_then(|s| s.parse().ok()).unwrap_or(0);
    h.saturating_mul(60).saturating_add(m)
}
