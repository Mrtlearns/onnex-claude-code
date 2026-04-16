use prometheus_client::{
    metrics::{counter::Counter, gauge::Gauge, histogram::Histogram},
    registry::Registry,
};
use std::sync::atomic::AtomicU64;

pub struct MetricsRegistry {
    pub registry: Registry,
    pub requests_total: Counter,
    pub layer_faults_total: Counter,
    pub pii_stripped_total: Counter,
    pub rate_limit_total: Counter,
    pub trust_replay_attempts: Counter,
    pub feed_last_update: Gauge,
    pub audit_chain_length: Gauge,
    pub estop_active: Gauge,
    pub latency_ms: Histogram,
}

impl MetricsRegistry {
    pub fn new() -> Self {
        let mut registry = Registry::default();

        // Counter names WITHOUT _total — prometheus-client appends _total automatically
        let requests_total: Counter = Counter::default();
        registry.register("ai_sentinel_requests", "Total requests processed", requests_total.clone());

        let layer_faults_total: Counter = Counter::default();
        registry.register("ai_sentinel_layer_faults", "Total layer faults", layer_faults_total.clone());

        let pii_stripped_total: Counter = Counter::default();
        registry.register("ai_sentinel_pii_stripped", "Requests where PII was stripped", pii_stripped_total.clone());

        let rate_limit_total: Counter = Counter::default();
        registry.register("ai_sentinel_rate_limit", "Requests rejected by rate limiter", rate_limit_total.clone());

        let trust_replay_attempts: Counter = Counter::default();
        registry.register("ai_sentinel_trust_replay_attempts", "Trust token replay attempts", trust_replay_attempts.clone());

        let feed_last_update: Gauge = Gauge::default();
        registry.register("ai_sentinel_feed_last_update", "Unix timestamp of last feed update", feed_last_update.clone());

        let audit_chain_length: Gauge = Gauge::default();
        registry.register("ai_sentinel_audit_chain_length", "Records in audit chain", audit_chain_length.clone());

        let estop_active: Gauge = Gauge::default();
        registry.register("ai_sentinel_estop_active", "1.0 if e-stop active", estop_active.clone());

        let latency_ms = Histogram::new(
            [1.0, 5.0, 10.0, 25.0, 50.0, 100.0, 250.0, 500.0, 1000.0].iter().copied(),
        );
        registry.register("ai_sentinel_latency_ms", "Request latency milliseconds", latency_ms.clone());

        MetricsRegistry {
            registry,
            requests_total,
            layer_faults_total,
            pii_stripped_total,
            rate_limit_total,
            trust_replay_attempts,
            feed_last_update,
            audit_chain_length,
            estop_active,
            latency_ms,
        }
    }
}
