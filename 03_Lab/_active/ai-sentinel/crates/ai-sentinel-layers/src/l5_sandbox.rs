use async_trait::async_trait;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use tokio::sync::Mutex;
use chrono::{Utc, Datelike};
use tracing::{debug, info, warn};

use ai_sentinel_core::{
    AppConfig, Direction, Layer, LayerContext, LayerError, LayerResult, CheckRequest, Severity,
    SessionState,
};

pub struct L5Sandbox {
    max_actions_per_hour: u64,
    max_cost_per_day: f64,
    max_tokens_per_request: u32,
    e_stop: Arc<AtomicBool>,
}

impl L5Sandbox {
    pub fn new(config: &AppConfig, e_stop: Arc<AtomicBool>) -> Self {
        L5Sandbox {
            max_actions_per_hour: config.rate_max_actions_per_hour,
            max_cost_per_day: config.rate_max_cost_per_day,
            max_tokens_per_request: config.rate_max_tokens_per_request,
            e_stop,
        }
    }

    pub fn trigger_estop(&self) {
        self.e_stop.store(true, Ordering::SeqCst);
        warn!("E-STOP ACTIVATED — all requests will be rejected");
    }

    pub fn lift_estop(&self) {
        self.e_stop.store(false, Ordering::SeqCst);
        info!("E-STOP LIFTED — resuming normal operation");
    }

    pub fn estop_active(&self) -> bool {
        self.e_stop.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl Layer for L5Sandbox {
    fn id(&self) -> &'static str { "l5" }
    fn name(&self) -> &'static str { "Execution Sandbox" }

    fn applies_to(&self, direction: &Direction) -> bool {
        *direction == Direction::Ingress
    }

    async fn check(&self, req: &CheckRequest, ctx: &mut LayerContext) -> Result<LayerResult, LayerError> {
        // 1. Emergency stop check (fastest path)
        if self.estop_active() {
            return Ok(LayerResult::Reject {
                code: "ESTOP".to_string(),
                reason: "Emergency stop is active — all requests blocked".to_string(),
                severity: Severity::Critical,
            });
        }

        // 2. Session-based rate limiting
        if let Some(ref session) = ctx.session {
            let mut state = session.load().await
                .map_err(|e| LayerError::internal(e.to_string()))?
                .unwrap_or_else(|| SessionState::new(
                    session.session_id().to_string(),
                    req.caller_context.caller_id.clone(),
                ));

            // Token bucket rate limit (actions per hour; 0 = unlimited)
            state.action_count += 1;
            if self.max_actions_per_hour > 0 && state.action_count > self.max_actions_per_hour {
                return Ok(LayerResult::Reject {
                    code: "RATE_LIMIT".to_string(),
                    reason: format!(
                        "Rate limit exceeded: {} actions (max {})",
                        state.action_count, self.max_actions_per_hour
                    ),
                    severity: Severity::Medium,
                });
            }

            // Daily cost cap
            if let Some(cost) = req.caller_context.cost_usd {
                state.cost_usd_today += cost;
                if state.cost_usd_today > self.max_cost_per_day {
                    return Ok(LayerResult::Reject {
                        code: "COST_CAP".to_string(),
                        reason: format!(
                            "Daily cost cap exceeded: ${:.4} (max ${:.2})",
                            state.cost_usd_today, self.max_cost_per_day
                        ),
                        severity: Severity::High,
                    });
                }
            }

            session.save(&state).await
                .map_err(|e| LayerError::internal(e.to_string()))?;

            debug!("L5: action_count={}, cost=${:.4}", state.action_count, state.cost_usd_today);
        }

        Ok(LayerResult::Pass)
    }
}
