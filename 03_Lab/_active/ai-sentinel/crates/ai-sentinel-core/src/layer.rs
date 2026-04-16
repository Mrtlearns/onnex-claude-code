use async_trait::async_trait;
use std::time::Instant;
use uuid::Uuid;
use crate::{
    error::LayerError,
    types::{CheckRequest, Direction, LayerResult, TelemetryRecord},
    session::SessionHandle,
};

/// Context passed through every layer during a single pipeline run.
pub struct LayerContext {
    pub request_id: String,
    pub session: Option<Box<dyn SessionHandle>>,
    pub telemetry: TelemetryRecord,
    pub start_time: Instant,
    pub layer_timings: Vec<(String, u64)>,
}

impl LayerContext {
    pub fn new(request_id: String) -> Self {
        LayerContext {
            request_id: request_id.clone(),
            session: None,
            telemetry: TelemetryRecord {
                request_id,
                ..Default::default()
            },
            start_time: Instant::now(),
            layer_timings: Vec::new(),
        }
    }

    pub fn elapsed_ms(&self) -> u64 {
        self.start_time.elapsed().as_millis() as u64
    }

    pub fn record_layer_timing(&mut self, layer_id: &str, ms: u64) {
        self.layer_timings.push((layer_id.to_string(), ms));
    }
}

/// The core Layer trait — every security gate implements this.
#[async_trait]
pub trait Layer: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;

    /// Return true if this layer should run for the given direction.
    fn applies_to(&self, direction: &Direction) -> bool;

    /// Perform the security check. Fail-open on Err (log + pass).
    async fn check(
        &self,
        req: &CheckRequest,
        ctx: &mut LayerContext,
    ) -> Result<LayerResult, LayerError>;
}
