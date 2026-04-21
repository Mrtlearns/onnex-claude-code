use std::sync::Arc;
use std::time::Instant;
use tracing::{error, warn, info, debug};
use uuid::Uuid;

use crate::{
    error::LayerError,
    layer::{Layer, LayerContext},
    types::{CheckRequest, CheckResponse, CheckStatus, LayerResult, RejectDetail},
};

pub struct Pipeline {
    layers: Vec<Arc<dyn Layer>>,
    fail_open: bool,
}

impl Pipeline {
    pub fn new(layers: Vec<Arc<dyn Layer>>) -> Self {
        // Secure default: on layer fault, reject the request.
        Pipeline { layers, fail_open: false }
    }

    /// Configure fail-open behaviour.
    /// `true`  = on layer error, log and continue (legacy behaviour).
    /// `false` = on layer error, reject the request with LAYER_FAULT (secure default).
    pub fn with_fail_open(mut self, fail_open: bool) -> Self {
        self.fail_open = fail_open;
        self
    }

    pub async fn run(&self, req: CheckRequest, ctx: &mut LayerContext) -> CheckResponse {
        let start = Instant::now();
        let mut current_payload = req.payload.clone();
        let mut layers_ran: Vec<String> = Vec::new();

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
                    // TODO: increment ai_sentinel_layer_faults_total metric
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
