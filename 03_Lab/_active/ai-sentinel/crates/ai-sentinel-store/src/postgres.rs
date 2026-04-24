//! PostgreSQL connection helpers.
//!
//! Phase 5 makes this real: a shared `PgPool` the workspace hands around, plus a
//! migration runner that applies everything in `/migrations` at startup.
//!
//! Legacy: the old `PostgresStore` session backend was a stub. Sessions remain in memory
//! for the hot path; Postgres is now used for audit, modules, rules, context, cache
//! persistence — state whose loss would break commercial claims.

use anyhow::Context;
use async_trait::async_trait;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;
use tracing::info;

use ai_sentinel_core::{SessionHandle, SessionState, SessionStore};

/// Build a Postgres pool from `database_url`. Applies in-tree migrations on connect.
pub async fn connect_and_migrate(database_url: &str) -> anyhow::Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(16)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await
        .context("postgres connect")?;
    info!("postgres pool connected; running migrations");
    sqlx::migrate!("../../migrations")
        .run(&pool)
        .await
        .context("sqlx migrate")?;
    info!("postgres migrations applied");
    Ok(pool)
}

/// Legacy stub — kept so existing call sites compile. Session backing remains in memory
/// for the hot path in Phase 5.
pub struct PostgresStore;

#[async_trait]
impl SessionStore for PostgresStore {
    async fn get(
        &self,
        _session_id: &str,
        _caller_id: &str,
    ) -> anyhow::Result<Box<dyn SessionHandle>> {
        Err(anyhow::anyhow!(
            "PostgresStore session backend not in use — sessions remain in MemoryStore in Phase 5"
        ))
    }
}

/// Ensure the parameter types are referenced so unused-import lints don't fire when callers
/// only use `connect_and_migrate`.
#[allow(dead_code)]
fn _unused(_: SessionState) {}
