use crate::types::{ModuleAction, ModuleAuditRecord};
use chrono::Utc;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::debug;

const GENESIS_HASH: &str = "0000000000000000000000000000000000000000000000000000000000000000";

/// Tamper-evident SHA-256 chain for module CRUD operations.
///
/// Backed by the `module_audit` Postgres table. Every write computes
/// `SHA-256(prev_hash || action || actor || timestamp || module_id || before || after || diff)`
/// and stores both `prev_hash` and `record_hash`, so verification can walk the chain in
/// insert order and recompute each hash.
#[derive(Clone)]
pub struct ModuleAuditChain {
    pool: PgPool,
    last_hash: Arc<Mutex<String>>,
}

impl ModuleAuditChain {
    pub async fn new(pool: PgPool) -> anyhow::Result<Self> {
        // Pick up where we left off if there are existing records.
        let row = sqlx::query("SELECT record_hash FROM module_audit ORDER BY id DESC LIMIT 1")
            .fetch_optional(&pool)
            .await?;
        let last_hash = row
            .and_then(|r| r.try_get::<String, _>("record_hash").ok())
            .unwrap_or_else(|| GENESIS_HASH.to_string());
        Ok(Self {
            pool,
            last_hash: Arc::new(Mutex::new(last_hash)),
        })
    }

    fn compute_hash(
        prev_hash: &str,
        action: &str,
        actor: &str,
        timestamp_rfc3339: &str,
        module_id: Option<i64>,
        before_version: Option<i32>,
        after_version: Option<i32>,
        diff_json: Option<&serde_json::Value>,
    ) -> String {
        let mut h = Sha256::new();
        h.update(prev_hash.as_bytes());
        h.update(action.as_bytes());
        h.update(actor.as_bytes());
        h.update(timestamp_rfc3339.as_bytes());
        h.update(module_id.map(|v| v.to_string()).unwrap_or_default().as_bytes());
        h.update(before_version.map(|v| v.to_string()).unwrap_or_default().as_bytes());
        h.update(after_version.map(|v| v.to_string()).unwrap_or_default().as_bytes());
        if let Some(v) = diff_json {
            h.update(v.to_string().as_bytes());
        }
        hex::encode(h.finalize())
    }

    /// Append a record. Returns the stored record with its hashes.
    pub async fn write(
        &self,
        action: ModuleAction,
        actor: &str,
        module_id: Option<i64>,
        before_version: Option<i32>,
        after_version: Option<i32>,
        diff_json: Option<serde_json::Value>,
    ) -> anyhow::Result<ModuleAuditRecord> {
        let timestamp = Utc::now();
        let timestamp_str = timestamp.to_rfc3339();

        let (prev_hash, record_hash) = {
            let mut last = self.last_hash.lock().await;
            let prev = last.clone();
            let hash = Self::compute_hash(
                &prev,
                action.as_str(),
                actor,
                &timestamp_str,
                module_id,
                before_version,
                after_version,
                diff_json.as_ref(),
            );
            *last = hash.clone();
            (prev, hash)
        };

        let row = sqlx::query(
            r#"INSERT INTO module_audit
               (prev_hash, record_hash, module_id, action, actor, "timestamp",
                before_version, after_version, diff_json)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
               RETURNING id"#,
        )
        .bind(&prev_hash)
        .bind(&record_hash)
        .bind(module_id)
        .bind(action.as_str())
        .bind(actor)
        .bind(timestamp)
        .bind(before_version)
        .bind(after_version)
        .bind(&diff_json)
        .fetch_one(&self.pool)
        .await?;
        let id: i64 = row.try_get("id")?;

        debug!(action = action.as_str(), actor, module_id = ?module_id, "module audit record written");

        Ok(ModuleAuditRecord {
            id,
            prev_hash,
            record_hash,
            module_id,
            action,
            actor: actor.to_string(),
            timestamp,
            before_version,
            after_version,
            diff_json,
        })
    }

    /// Verify the entire chain. Returns the number of valid records, or the id of the first
    /// broken row.
    pub async fn verify(&self) -> anyhow::Result<Result<usize, i64>> {
        let rows = sqlx::query(
            r#"SELECT id, prev_hash, record_hash, module_id, action, actor, "timestamp",
                      before_version, after_version, diff_json
               FROM module_audit ORDER BY id ASC"#,
        )
        .fetch_all(&self.pool)
        .await?;

        let mut expected_prev = GENESIS_HASH.to_string();
        let mut count = 0usize;
        for row in rows {
            let id: i64 = row.try_get("id")?;
            let prev_hash: String = row.try_get("prev_hash")?;
            let record_hash: String = row.try_get("record_hash")?;
            let module_id: Option<i64> = row.try_get("module_id").ok();
            let action: String = row.try_get("action")?;
            let actor: String = row.try_get("actor")?;
            let ts: chrono::DateTime<Utc> = row.try_get("timestamp")?;
            let before_version: Option<i32> = row.try_get("before_version").ok();
            let after_version: Option<i32> = row.try_get("after_version").ok();
            let diff_json: Option<serde_json::Value> = row.try_get("diff_json").ok();

            if prev_hash != expected_prev {
                return Ok(Err(id));
            }
            let recomputed = Self::compute_hash(
                &prev_hash,
                &action,
                &actor,
                &ts.to_rfc3339(),
                module_id,
                before_version,
                after_version,
                diff_json.as_ref(),
            );
            if recomputed != record_hash {
                return Ok(Err(id));
            }
            expected_prev = record_hash;
            count += 1;
        }
        Ok(Ok(count))
    }

    pub async fn record_count(&self) -> anyhow::Result<i64> {
        let row = sqlx::query("SELECT COUNT(*) AS c FROM module_audit")
            .fetch_one(&self.pool)
            .await?;
        Ok(row.try_get::<i64, _>("c")?)
    }
}
