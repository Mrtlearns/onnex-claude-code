use ai_sentinel_rules::{
    compile_yaml,
    dsl::{ActionSpec, Trigger},
    evaluator::{evaluate, merge_decisions, IntentHit, RuleContext},
};

fn ctx_with_content(c: &str) -> RuleContext<'_> {
    RuleContext {
        trigger: None,
        content: c,
        intents: &[],
        pii_categories: &[],
        cost_usd: 0.0,
        tokens_used: 0,
        caller_roles: &[],
        now_minutes_utc: 12 * 60,
    }
}

#[test]
fn any_of_matches_if_any_condition_hits() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    conditions:
      any_of:
        - regex: "alpha"
        - regex: "beta"
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let m1 = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("only alpha here"));
    let m2 = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("only beta here"));
    let m3 = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("neither"));
    assert_eq!(m1.len(), 1);
    assert_eq!(m2.len(), 1);
    assert_eq!(m3.len(), 0);
}

#[test]
fn all_of_requires_every_condition() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    conditions:
      all_of:
        - regex: "alpha"
        - regex: "beta"
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let m1 = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("alpha only"));
    let m2 = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("alpha and beta"));
    assert_eq!(m1.len(), 0);
    assert_eq!(m2.len(), 1);
}

#[test]
fn reject_outranks_warn_in_merge() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: warn-rule
    trigger: prompt_ingress
    priority: 100
    conditions: { regex: "foo" }
    actions: [ { type: warn, message: "heads up" } ]
  - name: reject-rule
    trigger: prompt_ingress
    priority: 50
    conditions: { regex: "foo" }
    actions: [ { type: reject, user_message: "blocked" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let matches = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("foo bar"));
    let decision = merge_decisions(matches.into_iter().collect());
    assert!(decision.is_reject(), "reject must win over warn");
    match decision.top_action {
        Some(ActionSpec::Reject(r)) => assert_eq!(r.user_message, "blocked"),
        other => panic!("expected Reject, got {other:?}"),
    }
}

#[test]
fn wrong_trigger_does_not_match() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_egress
    conditions: { regex: "foo" }
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let m = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("foo"));
    assert_eq!(m.len(), 0);
}

#[test]
fn disabled_rule_never_matches() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    enabled: false
    conditions: { regex: "foo" }
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let m = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("foo"));
    assert_eq!(m.len(), 0);
}

#[test]
fn intent_condition_requires_confidence() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    conditions:
      any_of:
        - intent: { category: homework_assistance, confidence_gte: 0.7 }
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();

    let hit_low = IntentHit { category: "homework_assistance", confidence: 0.5 };
    let hit_high = IntentHit { category: "homework_assistance", confidence: 0.9 };

    let mut ctx = ctx_with_content("do my homework");
    ctx.intents = std::slice::from_ref(&hit_low);
    assert_eq!(evaluate(&set, Trigger::PromptIngress, &ctx).len(), 0);

    ctx.intents = std::slice::from_ref(&hit_high);
    assert_eq!(evaluate(&set, Trigger::PromptIngress, &ctx).len(), 1);
}

#[test]
fn case_insensitive_regex() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    conditions: { regex: "(?i)HOMEWORK" }
    actions: [ { type: reject, user_message: "no" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let m = evaluate(&set, Trigger::PromptIngress, &ctx_with_content("help me do my homework"));
    assert_eq!(m.len(), 1);
}

#[test]
fn cost_tokens_thresholds() {
    let yaml = r#"
module: t
version: 1
rules:
  - name: high-cost
    trigger: cost_threshold
    conditions: { cost_gt: 10.0 }
    actions: [ { type: warn, message: "spending rising" } ]
  - name: too-many-tokens
    trigger: token_budget_exceeded
    conditions: { tokens_gt: 1000 }
    actions: [ { type: reject, user_message: "budget" } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let mut ctx = ctx_with_content("");
    ctx.cost_usd = 15.0;
    assert_eq!(evaluate(&set, Trigger::CostThreshold, &ctx).len(), 1);
    ctx.cost_usd = 5.0;
    assert_eq!(evaluate(&set, Trigger::CostThreshold, &ctx).len(), 0);

    let mut ctx2 = ctx_with_content("");
    ctx2.tokens_used = 1500;
    assert_eq!(evaluate(&set, Trigger::TokenBudgetExceeded, &ctx2).len(), 1);
}
