//! Bridge `PolicyEngine` → `ai_sentinel_core::PolicyHook` so the core Pipeline can call
//! us without depending on this crate.

use crate::dsl::{ActionSpec, Trigger};
use crate::engine::PolicyEngine;
use crate::evaluator::RuleContext;
use ai_sentinel_core::types::{CheckRequest, Severity as CoreSeverity};
use ai_sentinel_core::{PolicyDecision, PolicyHook, PolicyTrigger};
use async_trait::async_trait;

fn map_trigger(t: PolicyTrigger) -> Trigger {
    match t {
        PolicyTrigger::PromptIngress => Trigger::PromptIngress,
        PolicyTrigger::PromptEgress => Trigger::PromptEgress,
        PolicyTrigger::ToolCall => Trigger::ToolCall,
        PolicyTrigger::SessionStart => Trigger::SessionStart,
        PolicyTrigger::SessionEnd => Trigger::SessionEnd,
        PolicyTrigger::CostThreshold => Trigger::CostThreshold,
        PolicyTrigger::TokenBudgetExceeded => Trigger::TokenBudgetExceeded,
    }
}

fn map_severity(s: crate::dsl::Severity) -> CoreSeverity {
    match s {
        crate::dsl::Severity::Low => CoreSeverity::Low,
        crate::dsl::Severity::Medium => CoreSeverity::Medium,
        crate::dsl::Severity::High => CoreSeverity::High,
        crate::dsl::Severity::Critical => CoreSeverity::Critical,
    }
}

fn extract_content(req: &CheckRequest, current_payload: &serde_json::Value) -> String {
    // Prefer the current (possibly-mutated) payload, fall back to the original request body.
    fn from_val(v: &serde_json::Value) -> Option<String> {
        if let Some(s) = v.get("content").and_then(|c| c.as_str()) {
            return Some(s.to_string());
        }
        if let Some(arr) = v.get("messages").and_then(|m| m.as_array()) {
            let joined: Vec<String> = arr
                .iter()
                .filter_map(|m| m.get("content").and_then(|c| c.as_str()).map(str::to_string))
                .collect();
            if !joined.is_empty() {
                return Some(joined.join("\n"));
            }
        }
        None
    }
    from_val(current_payload)
        .or_else(|| from_val(&req.payload))
        .unwrap_or_default()
}

#[async_trait]
impl PolicyHook for PolicyEngine {
    async fn evaluate(
        &self,
        trigger: PolicyTrigger,
        req: &CheckRequest,
        current_payload: &serde_json::Value,
    ) -> PolicyDecision {
        let content = extract_content(req, current_payload);
        let cost = req.caller_context.cost_usd.unwrap_or(0.0);
        let tokens = req
            .caller_context
            .prompt_tokens
            .or(req.caller_context.completion_tokens)
            .unwrap_or(0);
        let roles: Vec<&str> = vec![]; // caller_role binding can be wired post-5.0 from JWT claims
        let now_minutes = (chrono::Utc::now().timestamp() / 60 % 1440) as u16;

        let ctx = RuleContext {
            trigger: Some(map_trigger(trigger)),
            content: content.as_str(),
            intents: &[],
            pii_categories: &[],
            cost_usd: cost,
            tokens_used: tokens,
            caller_roles: &roles,
            now_minutes_utc: now_minutes,
        };

        let decision = self.evaluate_all(map_trigger(trigger), &ctx);
        match decision.top_action {
            None => PolicyDecision::Allow,
            Some(ActionSpec::Allow) => PolicyDecision::Allow,
            Some(ActionSpec::Warn { .. }) => PolicyDecision::Allow,
            Some(ActionSpec::RateLimit { .. }) => PolicyDecision::Allow,
            Some(ActionSpec::Reject(r)) => {
                let first = decision.matches.first();
                PolicyDecision::Reject {
                    code: r
                        .audit_tag
                        .clone()
                        .unwrap_or_else(|| "POLICY_REJECT".to_string()),
                    reason: r.user_message.clone(),
                    severity: map_severity(r.severity),
                    module: first.map(|m| m.module.clone()),
                    rule: first.map(|m| m.rule_name.clone()),
                }
            }
            Some(ActionSpec::Redact(r)) => {
                let mut new_payload = current_payload.clone();
                apply_redact(&mut new_payload, &r.replacement);
                let first = decision.matches.first();
                PolicyDecision::Mutate {
                    payload: new_payload,
                    module: first.map(|m| m.module.clone()),
                    rule: first.map(|m| m.rule_name.clone()),
                }
            }
            Some(ActionSpec::Rewrite(rw)) => {
                let mut new_payload = current_payload.clone();
                apply_rewrite(&mut new_payload, &rw.template);
                let first = decision.matches.first();
                PolicyDecision::Mutate {
                    payload: new_payload,
                    module: first.map(|m| m.module.clone()),
                    rule: first.map(|m| m.rule_name.clone()),
                }
            }
            Some(ActionSpec::RouteToModel(route)) => {
                let mut new_payload = current_payload.clone();
                if let Some(obj) = new_payload.as_object_mut() {
                    obj.insert(
                        "model".to_string(),
                        serde_json::Value::String(route.target_model.clone()),
                    );
                }
                let first = decision.matches.first();
                PolicyDecision::Mutate {
                    payload: new_payload,
                    module: first.map(|m| m.module.clone()),
                    rule: first.map(|m| m.rule_name.clone()),
                }
            }
            Some(ActionSpec::RunLayer { .. })
            | Some(ActionSpec::ForwardToReviewQueue { .. }) => PolicyDecision::Allow,
        }
    }
}

fn apply_redact(v: &mut serde_json::Value, replacement: &str) {
    match v {
        serde_json::Value::String(s) => {
            *s = replacement.to_string();
        }
        serde_json::Value::Object(obj) => {
            if let Some(serde_json::Value::String(s)) = obj.get_mut("content") {
                *s = replacement.to_string();
            }
            if let Some(serde_json::Value::Array(arr)) = obj.get_mut("messages") {
                for msg in arr.iter_mut() {
                    if let Some(obj2) = msg.as_object_mut() {
                        if let Some(serde_json::Value::String(s)) = obj2.get_mut("content") {
                            *s = replacement.to_string();
                        }
                    }
                }
            }
        }
        _ => {}
    }
}

fn apply_rewrite(v: &mut serde_json::Value, template: &str) {
    // Minimal rewrite: swap content wholesale for template text.
    // Future: variable substitution against regex captures.
    apply_redact(v, template);
}
