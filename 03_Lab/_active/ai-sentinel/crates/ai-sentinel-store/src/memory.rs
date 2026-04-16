use std::sync::Arc;
use std::time::{Duration, Instant};
use async_trait::async_trait;
use dashmap::DashMap;
use tracing::{debug, info};

use ai_sentinel_core::{SessionHandle, SessionState, SessionStore};

/// Entry in the memory store: value + expiry
struct Entry {
    state: SessionState,
    expires_at: Instant,
}

/// In-memory session store backed by DashMap.
/// Default TTL: 24 hours. Background eviction task runs every 60s.
pub struct MemoryStore {
    map: Arc<DashMap<String, Entry>>,
    ttl: Duration,
}

impl MemoryStore {
    pub fn new(ttl_secs: u64) -> Self {
        let map = Arc::new(DashMap::new());
        let map_clone = map.clone();
        let ttl = Duration::from_secs(ttl_secs);

        // Background eviction task
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(Duration::from_secs(60)).await;
                let now = Instant::now();
                let before = map_clone.len();
                map_clone.retain(|_, v: &mut Entry| v.expires_at > now);
                let after = map_clone.len();
                if before != after {
                    debug!("evicted {} expired sessions", before - after);
                }
            }
        });

        MemoryStore { map, ttl }
    }
}

impl Default for MemoryStore {
    fn default() -> Self {
        MemoryStore::new(86_400) // 24 hours
    }
}

/// Handle for a single session in the memory store.
pub struct MemorySessionHandle {
    session_id: String,
    caller_id: String,
    map: Arc<DashMap<String, Entry>>,
    ttl: Duration,
}

#[async_trait]
impl SessionHandle for MemorySessionHandle {
    fn session_id(&self) -> &str {
        &self.session_id
    }

    async fn load(&self) -> anyhow::Result<Option<SessionState>> {
        Ok(self.map.get(&self.session_id).map(|e| e.state.clone()))
    }

    async fn save(&self, state: &SessionState) -> anyhow::Result<()> {
        self.map.insert(
            self.session_id.clone(),
            Entry {
                state: state.clone(),
                expires_at: Instant::now() + self.ttl,
            },
        );
        Ok(())
    }
}

#[async_trait]
impl SessionStore for MemoryStore {
    async fn get(
        &self,
        session_id: &str,
        caller_id: &str,
    ) -> anyhow::Result<Box<dyn SessionHandle>> {
        // Create entry if not present
        if !self.map.contains_key(session_id) {
            let state = SessionState::new(session_id.to_string(), caller_id.to_string());
            self.map.insert(
                session_id.to_string(),
                Entry {
                    state,
                    expires_at: Instant::now() + self.ttl,
                },
            );
        }

        Ok(Box::new(MemorySessionHandle {
            session_id: session_id.to_string(),
            caller_id: caller_id.to_string(),
            map: self.map.clone(),
            ttl: self.ttl,
        }))
    }
}
