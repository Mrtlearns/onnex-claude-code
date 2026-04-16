// PostgreSQL backend — implemented in Wave 6
// Stub: compiles, does nothing

use async_trait::async_trait;
use ai_sentinel_core::{SessionHandle, SessionState, SessionStore};

pub struct PostgresStore;

#[async_trait]
impl SessionStore for PostgresStore {
    async fn get(
        &self,
        _session_id: &str,
        _caller_id: &str,
    ) -> anyhow::Result<Box<dyn SessionHandle>> {
        // TODO: Wave 6 — implement with sqlx
        Err(anyhow::anyhow!("PostgresStore not yet implemented"))
    }
}
