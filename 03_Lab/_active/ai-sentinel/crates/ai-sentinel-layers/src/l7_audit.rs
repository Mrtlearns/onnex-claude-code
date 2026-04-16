use std::sync::{Arc, Mutex};
use sha2::{Sha256, Digest};
use hex;
use chrono::Utc;
use tracing::{debug, error};
use tokio::sync::mpsc;
use serde_json;

use ai_sentinel_core::AuditRecord;

const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Hash-chained, tamper-evident audit log.
/// SHA-256(record_id + prev_hash + timestamp + payload_hash)
pub struct AuditChain {
    records: Arc<Mutex<Vec<AuditRecord>>>,
    /// Last hash updated synchronously on write, so sequential writes chain correctly
    /// even before the async task flushes records to the Vec.
    last_hash: Mutex<String>,
    tx: mpsc::UnboundedSender<AuditRecord>,
}

impl AuditChain {
    pub fn new() -> Self {
        let records = Arc::new(Mutex::new(Vec::new()));
        let records_clone = records.clone();
        let (tx, mut rx) = mpsc::unbounded_channel::<AuditRecord>();

        // Async writer — receives records and appends to chain
        tokio::spawn(async move {
            while let Some(record) = rx.recv().await {
                let mut chain = records_clone.lock().unwrap();
                debug!(record_id = %record.record_id, "audit: appended record");
                chain.push(record);
            }
        });

        AuditChain {
            records,
            last_hash: Mutex::new(GENESIS_HASH.to_string()),
            tx,
        }
    }

    /// Compute the hash for a record.
    pub fn compute_hash(record_id: &str, prev_hash: &str, timestamp: &str, payload_hash: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(record_id.as_bytes());
        hasher.update(prev_hash.as_bytes());
        hasher.update(timestamp.as_bytes());
        hasher.update(payload_hash.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Hash an arbitrary payload string.
    pub fn hash_payload(payload: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(payload.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Write an audit record asynchronously. Non-blocking.
    /// prev_hash is tracked synchronously so sequential writes chain correctly
    /// regardless of async flush timing.
    pub fn write(
        &self,
        request_id: &str,
        direction: &str,
        decision: &str,
        layer: Option<&str>,
        code: Option<&str>,
        caller_id: &str,
        session_id: Option<&str>,
        payload_json: &str,
    ) {
        let timestamp = Utc::now();
        let timestamp_str = timestamp.to_rfc3339();
        let payload_hash = Self::hash_payload(payload_json);

        // Hold last_hash lock for the entire hash computation + update
        // so concurrent writes don't race on prev_hash.
        let (prev_hash, record_hash) = {
            let mut last = self.last_hash.lock().unwrap();
            let prev = last.clone();
            let hash = Self::compute_hash(request_id, &prev, &timestamp_str, &payload_hash);
            *last = hash.clone();
            (prev, hash)
        };

        let record = AuditRecord {
            record_id: request_id.to_string(),
            prev_hash,
            timestamp,
            payload_hash,
            record_hash,
            direction: direction.to_string(),
            decision: decision.to_string(),
            layer: layer.map(String::from),
            code: code.map(String::from),
            caller_id: caller_id.to_string(),
            session_id: session_id.map(String::from),
        };

        if let Err(e) = self.tx.send(record) {
            error!("audit write error: {}", e);
        }
    }

    /// Verify the audit chain integrity.
    /// Returns Ok(()) if clean, or Err(first_broken_record_id) if tampered.
    pub fn verify(&self) -> Result<usize, String> {
        let records = self.records.lock().unwrap();
        let mut prev_hash = GENESIS_HASH.to_string();

        for record in records.iter() {
            let expected = Self::compute_hash(
                &record.record_id,
                &prev_hash,
                &record.timestamp.to_rfc3339(),
                &record.payload_hash,
            );
            if expected != record.record_hash {
                return Err(record.record_id.clone());
            }
            prev_hash = record.record_hash.clone();
        }

        Ok(records.len())
    }

    pub fn record_count(&self) -> usize {
        self.records.lock().unwrap().len()
    }
}

impl Default for AuditChain {
    fn default() -> Self {
        AuditChain::new()
    }
}
