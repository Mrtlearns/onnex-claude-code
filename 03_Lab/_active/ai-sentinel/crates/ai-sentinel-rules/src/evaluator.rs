//! Evaluator — runs a compiled rule set against a request and returns matched actions.

use crate::compiler::{CompiledCondition, CompiledConditions, CompiledRule, CompiledRuleSet};
use crate::dsl::{Action, ActionSpec, Severity, Trigger};
use smallvec::SmallVec;

/// Runtime context handed to the evaluator at each trigger point.
#[derive(Debug, Clone, Default)]
pub struct RuleContext<'a> {
    pub trigger: Option<Trigger>,
    pub content: &'a str,
    pub intents: &'a [IntentHit<'a>],
    pub pii_categories: &'a [&'a str],
    pub cost_usd: f64,
    pub tokens_used: u32,
    pub caller_roles: &'a [&'a str],
    /// Minutes since midnight UTC at the moment of evaluation.
    pub now_minutes_utc: u16,
}

#[derive(Debug, Clone)]
pub struct IntentHit<'a> {
    pub category: &'a str,
    pub confidence: f32,
}

/// A single rule match in the output.
#[derive(Debug, Clone)]
pub struct RuleMatch {
    pub module: String,
    pub rule_name: String,
    pub priority: i32,
    pub actions: Vec<ActionSpec>,
}

/// Aggregated decision across all matched rules.
#[derive(Debug, Clone, Default)]
pub struct EvalDecision {
    pub matches: Vec<RuleMatch>,
    /// Merged top action — the single most decisive action across all matches.
    pub top_action: Option<ActionSpec>,
    pub top_severity: Option<Severity>,
}

impl EvalDecision {
    pub fn is_reject(&self) -> bool {
        matches!(&self.top_action, Some(ActionSpec::Reject(_)))
    }
}

/// Evaluate a single compiled rule set for a trigger + context.
/// Returns matches in priority-descending order.
pub fn evaluate(
    set: &CompiledRuleSet,
    trigger: Trigger,
    ctx: &RuleContext<'_>,
) -> SmallVec<[RuleMatch; 4]> {
    let mut out: SmallVec<[RuleMatch; 4]> = SmallVec::new();
    for rule in &set.rules {
        if !rule.enabled || rule.trigger != trigger {
            continue;
        }
        if rule_matches(rule, ctx) {
            out.push(RuleMatch {
                module: set.module.clone(),
                rule_name: rule.name.clone(),
                priority: rule.priority,
                actions: rule.actions.clone(),
            });
        }
    }
    out
}

/// Merge matches from multiple evaluations into a single decision.
pub fn merge_decisions(matches: Vec<RuleMatch>) -> EvalDecision {
    let mut top_action: Option<ActionSpec> = None;
    let mut top_severity: Option<Severity> = None;

    for m in &matches {
        for act in &m.actions {
            let cur_rank = top_action.as_ref().map(action_rank).unwrap_or(0);
            let new_rank = action_rank_of_spec(act);
            if new_rank > cur_rank {
                top_action = Some(act.clone());
                if let ActionSpec::Reject(r) = act {
                    top_severity = Some(r.severity);
                }
            }
        }
    }

    EvalDecision { matches, top_action, top_severity }
}

fn action_rank(a: &ActionSpec) -> u8 {
    action_rank_of_spec(a)
}

fn action_rank_of_spec(a: &ActionSpec) -> u8 {
    match a {
        ActionSpec::Allow => Action::Allow.rank(),
        ActionSpec::Warn { .. } => Action::Warn.rank(),
        ActionSpec::RateLimit { .. } => Action::RateLimit.rank(),
        ActionSpec::Redact(_) => Action::Redact.rank(),
        ActionSpec::Rewrite(_) => Action::Rewrite.rank(),
        ActionSpec::RouteToModel(_) => Action::RouteToModel.rank(),
        ActionSpec::RunLayer { .. } => Action::RunLayer.rank(),
        ActionSpec::ForwardToReviewQueue { .. } => Action::ForwardToReviewQueue.rank(),
        ActionSpec::Reject(_) => Action::Reject.rank(),
    }
}

fn rule_matches(rule: &CompiledRule, ctx: &RuleContext<'_>) -> bool {
    match &rule.conditions {
        CompiledConditions::AnyOf(cs) => cs.iter().any(|c| cond_matches(c, ctx)),
        CompiledConditions::AllOf(cs) => cs.iter().all(|c| cond_matches(c, ctx)),
        CompiledConditions::Leaf(c) => cond_matches(c, ctx),
    }
}

fn cond_matches(c: &CompiledCondition, ctx: &RuleContext<'_>) -> bool {
    match c {
        CompiledCondition::Regex(r) => r.is_match(ctx.content),
        CompiledCondition::RegexNamedCapture { regex, .. } => regex.is_match(ctx.content),
        CompiledCondition::Intent { category, confidence_gte } => ctx
            .intents
            .iter()
            .any(|h| h.category == category && h.confidence >= *confidence_gte),
        CompiledCondition::PiiCategory(cat) => ctx.pii_categories.iter().any(|c| c == cat),
        CompiledCondition::CostGt(v) => ctx.cost_usd > *v,
        CompiledCondition::TokensGt(v) => ctx.tokens_used > *v,
        CompiledCondition::CallerRole(r) => ctx.caller_roles.iter().any(|cr| cr == r),
        CompiledCondition::TimeOfDay { from_minutes, to_minutes } => {
            if from_minutes <= to_minutes {
                ctx.now_minutes_utc >= *from_minutes && ctx.now_minutes_utc <= *to_minutes
            } else {
                // Wraps past midnight
                ctx.now_minutes_utc >= *from_minutes || ctx.now_minutes_utc <= *to_minutes
            }
        }
        CompiledCondition::Always => true,
    }
}
