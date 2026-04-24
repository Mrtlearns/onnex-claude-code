use std::sync::{Arc, Mutex};
use sha2::{Sha256, Digest};
use hex;
use chrono::Utc;
use tracing::{debug, error, warn};
use tokio::sync::mpsc;
use sqlx::{PgPool, Row};

use ai_sentinel_core::AuditRecord;

const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Hash-chained, tamper-evident audit log.
/// SHA-256(record_id + prev_hash + timestamp + payload_hash)
///
/// Phase 5: optional Postgres sink. When a `PgPool` is configured via `with_postgres`,
/// every record is also persisted to the `audit_records` table. Verification switches
/// to the persistent chain when the pool is present.
pub struct AuditChain {
    records: Arc<Mutex<Vec<AuditRecord>>>,
    /// Last hash updated synchronously on write, so sequential writes chain correctly
    /// even before the async task flushes records to the Vec.
    last_hash: Mutex<String>,
    tx: mpsc::UnboundedSender<AuditRecord>,
    pool: Option<PgPool>,
}

impl AuditChain {
    pub fn new() -> Self {
        Self::build(None)
    }

    /// Build an audit chain backed by Postgres. Recovers `last_hash` from the tail of
    /// `audit_records` so restarts continue the existing chain rather than starting a new one.
    pub async fn with_postgres(pool: PgPool) -> anyhow::Result<Self> {
        let last_hash = sqlx::query("SELECT record_hash FROM audit_records ORDER BY id DESC LIMIT 1")
            .fetch_optional(&pool)
            .await?
            .and_then(|r| r.try_get::<String, _>("record_hash").ok())
            .unwrap_or_else(|| GENESIS_HASH.to_string());
        let chain = Self::build(Some(pool));
        *chain.last_hash.lock().unwrap() = last_hash;
        Ok(chain)
    }

    fn build(pool: Option<PgPool>) -> Self {
        let records = Arc::new(Mutex::new(Vec::new()));
        let records_clone = records.clone();
        let pool_clone = pool.clone();
        let (tx, mut rx) = mpsc::unbounded_channel::<AuditRecord>();

        // Async writer — receives records, appends to in-memory chain and (if pool) Postgres.
        tokio::spawn(async move {
            while let Some(record) = rx.recv().await {
                {
                    let mut chain = records_clone.lock().unwrap();
                    debug!(record_id = %record.record_id, "audit: appended record (mem)");
                    chain.push(record.clone());
                }
                if let Some(p) = pool_clone.as_ref() {
                    let insert = sqlx::query(
                        r#"INSERT INTO audit_records
                           (prev_hash, record_hash, payload_hash, "timestamp",
                            direction, decision, layer, code, caller_id, session_id, request_id)
                           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)"#,
                    )
                    .bind(&record.prev_hash)
                    .bind(&record.record_hash)
                    .bind(&record.payload_hash)
                    .bind(record.timestamp)
                    .bind(&record.direction)
                    .bind(&record.decision)
                    .bind(&record.layer)
                    .bind(&record.code)
                    .bind(&record.caller_id)
                    .bind(&record.session_id)
                    .bind(&record.record_id)
                    .execute(p)
                    .await;
                    if let Err(e) = insert {
                        warn!(error = %e, "audit: postgres insert failed — retaining in-memory record");
                    }
                }
            }
        });

        AuditChain {
            records,
            last_hash: Mutex::new(GENESIS_HASH.to_string()),
            tx,
            pool,
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
    /// - With Postgres: walks `audit_records` in insert order.
    /// - Without Postgres: walks the in-memory Vec.
    /// Returns the record count if clean, or the first broken record id/index.
    pub async fn verify(&self) -> Result<usize, String> {
        if let Some(pool) = self.pool.as_ref() {
            let rows = sqlx::query(
                r#"SELECT record_hash, prev_hash, payload_hash, "timestamp", request_id
                   FROM audit_records ORDER BY id ASC"#,
            )
            .fetch_all(pool)
            .await
            .map_err(|e| format!("db error: {e}"))?;

            let mut prev_hash = GENESIS_HASH.to_string();
            for row in &rows {
                let rec_hash: String = row.try_get("record_hash").map_err(|e| e.to_string())?;
                let stored_prev: String = row.try_get("prev_hash").map_err(|e| e.to_string())?;
                let payload_hash: String = row.try_get("payload_hash").map_err(|e| e.to_string())?;
                let ts: chrono::DateTime<Utc> = row.try_get("timestamp").map_err(|e| e.to_string())?;
                let request_id: String = row.try_get("request_id").map_err(|e| e.to_string())?;
                if stored_prev != prev_hash {
                    return Err(request_id);
                }
                let expected = Self::compute_hash(&request_id, &prev_hash, &ts.to_rfc3339(), &payload_hash);
                if expected != rec_hash {
                    return Err(request_id);
                }
                prev_hash = rec_hash;
            }
            return Ok(rows.len());
        }

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

    pub async fn persistent_count(&self) -> anyhow::Result<Option<i64>> {
        if let Some(p) = self.pool.as_ref() {
            let row = sqlx::query("SELECT COUNT(*) AS c FROM audit_records")
                .fetch_one(p)
                .await?;
            return Ok(Some(row.try_get::<i64, _>("c")?));
        }
        Ok(None)
    }
}

impl Default for AuditChain {
    fn default() -> Self {
        AuditChain::new()
    }
}
