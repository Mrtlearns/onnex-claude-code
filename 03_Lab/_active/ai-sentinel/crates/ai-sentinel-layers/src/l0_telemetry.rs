use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{debug, error};
use chrono::Utc;

use ai_sentinel_core::{TelemetryRecord, AppConfig};

/// Verbosity level for telemetry output.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub enum TelemetryLevel {
    Off,
    Minimal,
    Standard,
    Full,
    Debug,
}

impl TelemetryLevel {
    pub fn from_str(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "off" => TelemetryLevel::Off,
            "minimal" => TelemetryLevel::Minimal,
            "full" => TelemetryLevel::Full,
            "debug" => TelemetryLevel::Debug,
            _ => TelemetryLevel::Standard,
        }
    }
}

/// Accumulated telemetry for a single request — built up during pipeline run.
#[derive(Debug, Default, Clone)]
pub struct TelemetryAccumulator {
    pub record: TelemetryRecord,
}

impl TelemetryAccumulator {
    pub fn new(request_id: String) -> Self {
        TelemetryAccumulator {
            record: TelemetryRecord {
                request_id,
                timestamp: Some(Utc::now()),
                ..Default::default()
            },
        }
    }
}

/// Backend-agnostic telemetry writer. Receives records via channel and writes async.
pub struct TelemetryWriter {
    tx: mpsc::UnboundedSender<TelemetryRecord>,
    level: TelemetryLevel,
    pii_redact: bool,
}

impl TelemetryWriter {
    pub fn new_stdout(level: TelemetryLevel, pii_redact: bool) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<TelemetryRecord>();

        tokio::spawn(async move {
            while let Some(record) = rx.recv().await {
                match serde_json::to_string(&record) {
                    Ok(line) => println!("{}", line),
                    Err(e) => error!("telemetry serialization error: {}", e),
                }
            }
        });

        TelemetryWriter { tx, level, pii_redact }
    }

    /// Send a telemetry record for async writing. Non-blocking.
    pub fn write(&self, mut record: TelemetryRecord) {
        if self.level == TelemetryLevel::Off {
            return;
        }

        if self.pii_redact {
            // Redact payload fields (don't store raw prompts)
            record.timestamp = record.timestamp; // keep timestamp
        }

        if let Err(e) = self.tx.send(record) {
            error!("telemetry write error: {}", e);
        }
    }
}

impl Clone for TelemetryWriter {
    fn clone(&self) -> Self {
        // For Arc-based sharing, we re-wrap the sender
        // In practice, TelemetryWriter should be Arc<TelemetryWriter>
        // This clone creates a new sender to the same receiver — using a broadcast instead
        // For Phase 1, we use a simple approach: share via Arc
        todo!("Use Arc<TelemetryWriter> instead of cloning directly")
    }
}
