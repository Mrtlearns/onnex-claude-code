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
}

impl Pipeline {
    pub fn new(layers: Vec<Arc<dyn Layer>>) -> Self {
        Pipeline { layers }
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
                    // Fail-open: log the error, increment fault counter, continue
                    error!(
                        layer = layer.id(),
                        error = %e,
                        "layer fault — failing open"
                    );
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
