use ai_sentinel_rules::{compile_yaml, dsl::Trigger};

#[test]
fn compiles_minimal_rule_set() {
    let yaml = r#"
module: test
version: 1
license_tier: basic
rules:
  - name: block-foo
    trigger: prompt_ingress
    priority: 100
    conditions:
      any_of:
        - regex: "(?i)foo"
    actions:
      - type: reject
        user_message: "no foo"
"#;
    let set = compile_yaml(yaml).unwrap();
    assert_eq!(set.module, "test");
    assert_eq!(set.rules.len(), 1);
    assert_eq!(set.rules[0].name, "block-foo");
    assert_eq!(set.rules[0].trigger, Trigger::PromptIngress);
    assert_eq!(set.rules[0].priority, 100);
    assert!(set.errors.is_empty());
}

#[test]
fn bad_regex_does_not_poison_set() {
    let yaml = r#"
module: test
version: 1
rules:
  - name: ok-rule
    trigger: prompt_ingress
    conditions:
      any_of:
        - regex: "good"
    actions:
      - type: allow
  - name: bad-rule
    trigger: prompt_ingress
    conditions:
      any_of:
        - regex: "[unclosed"
    actions:
      - type: allow
"#;
    let set = compile_yaml(yaml).unwrap();
    // One rule survived, one error collected
    assert_eq!(set.rules.len(), 1);
    assert_eq!(set.rules[0].name, "ok-rule");
    assert_eq!(set.errors.len(), 1);
    assert!(set.errors[0].contains("bad-rule"));
}

#[test]
fn priority_sorts_descending() {
    let yaml = r#"
module: test
version: 1
rules:
  - name: low
    trigger: prompt_ingress
    priority: 10
    conditions: { regex: "a" }
    actions: [ { type: allow } ]
  - name: high
    trigger: prompt_ingress
    priority: 100
    conditions: { regex: "b" }
    actions: [ { type: allow } ]
  - name: mid
    trigger: prompt_ingress
    priority: 50
    conditions: { regex: "c" }
    actions: [ { type: allow } ]
"#;
    let set = compile_yaml(yaml).unwrap();
    let names: Vec<&str> = set.rules.iter().map(|r| r.name.as_str()).collect();
    assert_eq!(names, vec!["high", "mid", "low"]);
}

#[test]
fn yaml_parse_error_fails_compile() {
    let yaml = "this is: not: a: rule: set:";
    let res = compile_yaml(yaml);
    assert!(res.is_err());
}

#[test]
fn all_triggers_parse() {
    let triggers = [
        ("prompt_ingress", Trigger::PromptIngress),
        ("prompt_egress", Trigger::PromptEgress),
        ("tool_call", Trigger::ToolCall),
        ("session_start", Trigger::SessionStart),
        ("session_end", Trigger::SessionEnd),
        ("cost_threshold", Trigger::CostThreshold),
        ("token_budget_exceeded", Trigger::TokenBudgetExceeded),
    ];
    for (s, expected) in triggers {
        let yaml = format!(
            r#"
module: t
version: 1
rules:
  - name: r
    trigger: {s}
    conditions: {{ always: null }}
    actions: [ {{ type: allow }} ]
"#
        );
        let set = compile_yaml(&yaml).unwrap();
        assert_eq!(set.rules[0].trigger, expected, "trigger {s}");
    }
}
