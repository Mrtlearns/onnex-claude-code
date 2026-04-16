// Redis backend — implemented in Wave 6
// Stub: compiles, does nothing

use async_trait::async_trait;
use ai_sentinel_core::{SessionHandle, SessionState, SessionStore};

pub struct RedisStore;

#[async_trait]
impl SessionStore for RedisStore {
    async fn get(
        &self,
        _session_id: &str,
        _caller_id: &str,
    ) -> anyhow::Result<Box<dyn SessionHandle>> {
        // TODO: Wave 6 — implement with deadpool-redis
        Err(anyhow::anyhow!("RedisStore not yet implemented"))
    }
}
