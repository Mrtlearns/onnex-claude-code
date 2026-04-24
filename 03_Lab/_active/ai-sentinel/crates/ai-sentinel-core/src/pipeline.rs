use std::sync::Arc;
use std::time::Instant;
use async_trait::async_trait;
use tracing::{error, warn, info, debug};

use crate::{
    error::LayerError,
    layer::{Layer, LayerContext},
    types::{CheckRequest, CheckResponse, CheckStatus, Direction, LayerResult, RejectDetail, Severity},
};

/// Trigger points surfaced to `PolicyHook` implementations. Mirrors the rules engine
/// trigger taxonomy without depending on the rules crate (the core crate can't — rules
/// depend on core). The rules crate implements `PolicyHook` and maps these 1:1.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PolicyTrigger {
    PromptIngress,
    PromptEgress,
    ToolCall,
    SessionStart,
    SessionEnd,
    CostThreshold,
    TokenBudgetExceeded,
}

/// Decision returned by a policy hook.
#[derive(Debug, Clone)]
pub enum PolicyDecision {
    Allow,
    Reject { code: String, reason: String, severity: Severity, module: Option<String>, rule: Option<String> },
    Mutate { payload: serde_json::Value, module: Option<String>, rule: Option<String> },
}

impl Default for PolicyDecision {
    fn default() -> Self {
        PolicyDecision::Allow
    }
}

/// Plug point: the pipeline calls `evaluate` at each enabled trigger, handing a
/// structured context shape so the hook can inspect what is needed.
#[async_trait]
pub trait PolicyHook: Send + Sync {
    async fn evaluate(
        &self,
        trigger: PolicyTrigger,
        req: &CheckRequest,
        current_payload: &serde_json::Value,
    ) -> PolicyDecision;
}

pub struct Pipeline {
    layers: Vec<Arc<dyn Layer>>,
    fail_open: bool,
    policy: Option<Arc<dyn PolicyHook>>,
}

impl Pipeline {
    pub fn new(layers: Vec<Arc<dyn Layer>>) -> Self {
        // Secure default: on layer fault, reject the request.
        Pipeline { layers, fail_open: false, policy: None }
    }

    /// Configure fail-open behaviour.
    /// `true`  = on layer error, log and continue (legacy behaviour).
    /// `false` = on layer error, reject the request with LAYER_FAULT (secure default).
    pub fn with_fail_open(mut self, fail_open: bool) -> Self {
        self.fail_open = fail_open;
        self
    }

    /// Attach a `PolicyHook` — typically the rules engine's PolicyEngine.
    pub fn with_policy(mut self, policy: Arc<dyn PolicyHook>) -> Self {
        self.policy = Some(policy);
        self
    }

    async fn run_policy_trigger(
        &self,
        trigger: PolicyTrigger,
        req: &CheckRequest,
        current_payload: &mut serde_json::Value,
        layers_ran: &mut Vec<String>,
    ) -> Option<CheckResponse> {
        let Some(policy) = self.policy.as_ref() else { return None };
        let decision = policy.evaluate(trigger, req, current_payload).await;
        match decision {
            PolicyDecision::Allow => None,
            PolicyDecision::Reject { code, reason, severity, module, rule } => {
                info!(?trigger, ?module, ?rule, code = %code, "policy reject");
                let reject_layer = match &rule {
                    Some(r) => format!("policy:{r}"),
                    None => "policy".to_string(),
                };
                layers_ran.push(reject_layer.clone());
                Some(CheckResponse::reject(
                    String::new(), // filled by caller
                    req.session_id.clone(),
                    RejectDetail {
                        layer: reject_layer,
                        code,
                        reason,
                        severity,
                    },
                    0,
                    layers_ran.clone(),
                ))
            }
            PolicyDecision::Mutate { payload, module, rule } => {
                debug!(?trigger, ?module, ?rule, "policy mutate");
                layers_ran.push(match &rule {
                    Some(r) => format!("policy:{r}"),
                    None => "policy".to_string(),
                });
                *current_payload = payload;
                None
            }
        }
    }

    pub async fn run(&self, req: CheckRequest, ctx: &mut LayerContext) -> CheckResponse {
        let start = Instant::now();
        let mut current_payload = req.payload.clone();
        let mut layers_ran: Vec<String> = Vec::new();

        // Policy hook: pre-layer trigger based on direction.
        let pre_trigger = match req.direction {
            Direction::Ingress => PolicyTrigger::PromptIngress,
            Direction::Egress => PolicyTrigger::PromptEgress,
        };
        if let Some(mut resp) = self
            .run_policy_trigger(pre_trigger, &req, &mut current_payload, &mut layers_ran)
            .await
        {
            resp.request_id = ctx.request_id.clone();
            resp.latency_ms = start.elapsed().as_millis() as u64;
            return resp;
        }

        for layer in &self.layers {
            // Skip layers that don't apply to this direction
            if !layer.applies_to(&req.direction) {
                debug!(layer = layer.id(), direction = ?req.direction, "skipping layer (direction mismatch)");
                continue;
            }

            let layer_start = Instant::now();

            // Build a request with the (potentially mutated) current payload
            let mut current_req = req.clone();
            current_req.payload = current_payload.clone();

            // Optional ToolCall policy hook at L4 entry.
            if layer.id() == "l4" {
                if let Some(mut resp) = self
                    .run_policy_trigger(PolicyTrigger::ToolCall, &current_req, &mut current_payload, &mut layers_ran)
                    .await
                {
                    resp.request_id = ctx.request_id.clone();
                    resp.latency_ms = start.elapsed().as_millis() as u64;
                    return resp;
                }
                current_req.payload = current_payload.clone();
            }

            let result = layer.check(&current_req, ctx).await;
            let layer_ms = layer_start.elapsed().as_millis() as u64;
            ctx.record_layer_timing(layer.id(), layer_ms);
            layers_ran.push(layer.id().to_string());

            match result {
                Ok(LayerResult::Pass) => {
                    debug!(layer = layer.id(), ms = layer_ms, "pass");
                }
                Ok(LayerResult::Reject { code, reason, severity }) => {
                    info!(
                        layer = layer.id(),
                        code = %code,
                        reason = %reason,
                        severity = ?severity,
                        ms = layer_ms,
                        "rejected"
                    );
                    let latency = start.elapsed().as_millis() as u64;
                    return CheckResponse::reject(
                        ctx.request_id.clone(),
                        req.session_id.clone(),
                        RejectDetail {
                            layer: layer.id().to_string(),
                            code,
                            reason,
                            severity,
                        },
                        latency,
                        layers_ran,
                    );
                }
                Ok(LayerResult::Mutate { payload }) => {
                    debug!(layer = layer.id(), ms = layer_ms, "mutated payload");
                    current_payload = payload;
                }
                Err(e) => {
                    error!(
                        layer = layer.id(),
                        error = %e,
                        fail_open = self.fail_open,
                        "layer fault"
                    );
                    if !self.fail_open {
                        let latency = start.elapsed().as_millis() as u64;
                        return CheckResponse::reject(
                            ctx.request_id.clone(),
                            req.session_id.clone(),
                            RejectDetail {
                                layer: layer.id().to_string(),
                                code: "LAYER_FAULT".to_string(),
                                reason: format!(
                                    "layer {} internal error (fail_open=false)",
                                    layer.id()
                                ),
                                severity: crate::types::Severity::Critical,
                            },
                            latency,
                            layers_ran,
                        );
                    }
                    // fail_open=true: log and continue.
                }
            }
        }

        // Post-layer cost / token-budget triggers.
        if let Some(cost) = req.caller_context.cost_usd {
            if cost > 0.0 {
                if let Some(mut resp) = self
                    .run_policy_trigger(PolicyTrigger::CostThreshold, &req, &mut current_payload, &mut layers_ran)
                    .await
                {
                    resp.request_id = ctx.request_id.clone();
                    resp.latency_ms = start.elapsed().as_millis() as u64;
                    return resp;
                }
            }
        }
        if let Some(tokens) = req.caller_context.prompt_tokens {
            if tokens > 0 {
                if let Some(mut resp) = self
                    .run_policy_trigger(PolicyTrigger::TokenBudgetExceeded, &req, &mut current_payload, &mut layers_ran)
                    .await
                {
                    resp.request_id = ctx.request_id.clone();
                    resp.latency_ms = start.elapsed().as_millis() as u64;
                    return resp;
                }
            }
        }

        let latency = start.elapsed().as_millis() as u64;
        CheckResponse::pass(
            ctx.request_id.clone(),
            req.session_id.clone(),
            current_payload,
            latency,
            layers_ran,
        )
    }
}
