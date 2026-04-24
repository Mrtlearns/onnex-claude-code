use ai_sentinel_rules::{
    dsl::Trigger,
    evaluator::RuleContext,
    PolicyEngine,
};

fn yaml_for(module: &str, regex: &str) -> String {
    format!(
        r#"
module: {module}
version: 1
rules:
  - name: r
    trigger: prompt_ingress
    conditions: {{ regex: "{regex}" }}
    actions: [ {{ type: reject, user_message: "nope" }} ]
"#
    )
}

fn ctx(content: &str) -> RuleContext<'_> {
    RuleContext {
        trigger: None,
        content,
        intents: &[],
        pii_categories: &[],
        cost_usd: 0.0,
        tokens_used: 0,
        caller_roles: &[],
        now_minutes_utc: 0,
    }
}

#[test]
fn idle_trigger_short_circuits() {
    let engine = PolicyEngine::new();
    // No modules loaded — evaluate should return empty fast.
    let d = engine.evaluate_all(Trigger::PromptIngress, &ctx("anything"));
    assert!(d.matches.is_empty());
    assert!(d.top_action.is_none());
}

#[test]
fn multiple_active_modules_merge() {
    let engine = PolicyEngine::new();
    engine.load_or_replace(1, "a".into(), true, &yaml_for("a", "alpha")).unwrap();
    engine.load_or_replace(2, "b".into(), true, &yaml_for("b", "beta")).unwrap();

    let d1 = engine.evaluate_all(Trigger::PromptIngress, &ctx("has alpha"));
    assert_eq!(d1.matches.len(), 1);
    assert_eq!(d1.matches[0].module, "a");

    let d2 = engine.evaluate_all(Trigger::PromptIngress, &ctx("alpha beta both"));
    assert_eq!(d2.matches.len(), 2);
}

#[test]
fn disabled_module_is_skipped() {
    let engine = PolicyEngine::new();
    engine.load_or_replace(1, "a".into(), true, &yaml_for("a", "alpha")).unwrap();
    engine.set_enabled(1, false);
    let d = engine.evaluate_all(Trigger::PromptIngress, &ctx("alpha"));
    assert!(d.matches.is_empty());
}

#[test]
fn remove_clears_module() {
    let engine = PolicyEngine::new();
    engine.load_or_replace(1, "a".into(), true, &yaml_for("a", "alpha")).unwrap();
    engine.remove(1);
    assert_eq!(engine.len(), 0);
    let d = engine.evaluate_all(Trigger::PromptIngress, &ctx("alpha"));
    assert!(d.matches.is_empty());
}

#[test]
fn hot_reload_replaces_rules() {
    let engine = PolicyEngine::new();
    engine.load_or_replace(1, "a".into(), true, &yaml_for("a", "alpha")).unwrap();
    let d_before = engine.evaluate_all(Trigger::PromptIngress, &ctx("gamma"));
    assert!(d_before.matches.is_empty());

    // Replace with a rule that catches "gamma"
    engine.load_or_replace(1, "a".into(), true, &yaml_for("a", "gamma")).unwrap();
    let d_after = engine.evaluate_all(Trigger::PromptIngress, &ctx("gamma"));
    assert_eq!(d_after.matches.len(), 1);
}
