use ai_sentinel_rules::{
    dsl::Trigger,
    evaluator::RuleContext,
    PolicyEngine,
};
use criterion::{criterion_group, criterion_main, Criterion};

fn build_engine(n_rules: usize) -> PolicyEngine {
    let mut yaml = String::from("module: b\nversion: 1\nrules:\n");
    for i in 0..n_rules {
        yaml.push_str(&format!(
            "  - name: rule-{i}\n    trigger: prompt_ingress\n    conditions:\n      any_of:\n        - regex: \"(?i)keyword{i}\"\n    actions:\n      - type: warn\n        message: \"hit\"\n"
        ));
    }
    let engine = PolicyEngine::new();
    engine.load_or_replace(1, "b".to_string(), true, &yaml).unwrap();
    engine
}

fn bench(c: &mut Criterion) {
    let engine_idle = PolicyEngine::new();
    let engine_10 = build_engine(10);
    let engine_50 = build_engine(50);

    let ctx = RuleContext {
        trigger: None,
        content: "lorem ipsum dolor sit amet",
        intents: &[],
        pii_categories: &[],
        cost_usd: 0.0,
        tokens_used: 0,
        caller_roles: &[],
        now_minutes_utc: 0,
    };

    c.bench_function("policy_engine_idle_trigger", |b| {
        b.iter(|| engine_idle.evaluate_all(Trigger::PromptIngress, &ctx))
    });
    c.bench_function("policy_engine_10_rules_no_match", |b| {
        b.iter(|| engine_10.evaluate_all(Trigger::PromptIngress, &ctx))
    });
    c.bench_function("policy_engine_50_rules_no_match", |b| {
        b.iter(|| engine_50.evaluate_all(Trigger::PromptIngress, &ctx))
    });

    let ctx_hit = RuleContext {
        trigger: None,
        content: "contains keyword25 deep inside",
        intents: &[],
        pii_categories: &[],
        cost_usd: 0.0,
        tokens_used: 0,
        caller_roles: &[],
        now_minutes_utc: 0,
    };
    c.bench_function("policy_engine_50_rules_one_match", |b| {
        b.iter(|| engine_50.evaluate_all(Trigger::PromptIngress, &ctx_hit))
    });
}

criterion_group!(benches, bench);
criterion_main!(benches);
