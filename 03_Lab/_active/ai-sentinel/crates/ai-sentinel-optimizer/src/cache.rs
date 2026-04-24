//! Semantic cache backed by DashMap + an LRU eviction list.
//!
//! The hot path is a single `DashMap::get` on a pre-hashed key. Inserts update both the
//! DashMap and a bounded LRU index so memory pressure stays capped.

use dashmap::DashMap;
use lru::LruCache;
use serde::{Deserialize, Serialize};
use std::num::NonZeroUsize;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

/// Small cached body. Stored as serde_json::Value so tests don't couple to any LLM SDK.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedResponse {
    pub payload: serde_json::Value,
    pub tokens_saved: u32,
    pub cost_saved_usd: f64,
    pub stored_at_unix_ms: i64,
}

#[derive(Clone)]
pub struct SemanticCache {
    entries: Arc<DashMap<u64, (CachedResponse, Instant)>>,
    lru: Arc<Mutex<LruCache<u64, ()>>>,
    ttl: Duration,
}

impl SemanticCache {
    pub fn new(max_entries: usize, ttl: Duration) -> Self {
        let cap = NonZeroUsize::new(max_entries.max(1)).unwrap();
        Self {
            entries: Arc::new(DashMap::new()),
            lru: Arc::new(Mutex::new(LruCache::new(cap))),
            ttl,
        }
    }

    /// Compute the cache key from normalized prompt + model + temperature.
    pub fn key(prompt: &str, model: &str, temperature: f64) -> u64 {
        let mut h = blake3::Hasher::new();
        h.update(prompt.as_bytes());
        h.update(&[0]);
        h.update(model.as_bytes());
        h.update(&[0]);
        h.update(&temperature.to_le_bytes());
        // Truncate 32 bytes → u64. Collision risk negligible for 10k-entry cap.
        let hash = h.finalize();
        let bytes = hash.as_bytes();
        u64::from_le_bytes(bytes[..8].try_into().unwrap())
    }

    pub fn get(&self, key: u64) -> Option<CachedResponse> {
        let now = Instant::now();
        let value = self.entries.get(&key).map(|r| r.value().clone());
        if let Some((resp, stored_at)) = value {
            if now.duration_since(stored_at) > self.ttl {
                self.entries.remove(&key);
                return None;
            }
            // Touch LRU (ignore Mutex poison — cache is best-effort).
            if let Ok(mut lru) = self.lru.lock() {
                lru.promote(&key);
            }
            return Some(resp);
        }
        None
    }

    pub fn insert(&self, key: u64, resp: CachedResponse) {
        // Evict oldest if at cap.
        let evicted = {
            if let Ok(mut lru) = self.lru.lock() {
                lru.push(key, ()).map(|(k, _)| k)
            } else {
                None
            }
        };
        if let Some(ek) = evicted {
            self.entries.remove(&ek);
        }
        self.entries.insert(key, (resp, Instant::now()));
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn sample() -> CachedResponse {
        CachedResponse {
            payload: json!({ "msg": "hi" }),
            tokens_saved: 100,
            cost_saved_usd: 0.01,
            stored_at_unix_ms: 0,
        }
    }

    #[test]
    fn cache_hit_miss() {
        let c = SemanticCache::new(4, Duration::from_secs(60));
        let k = SemanticCache::key("p", "m", 0.0);
        assert!(c.get(k).is_none());
        c.insert(k, sample());
        assert!(c.get(k).is_some());
    }

    #[test]
    fn lru_evicts_oldest() {
        let c = SemanticCache::new(2, Duration::from_secs(60));
        let k1 = SemanticCache::key("p1", "m", 0.0);
        let k2 = SemanticCache::key("p2", "m", 0.0);
        let k3 = SemanticCache::key("p3", "m", 0.0);
        c.insert(k1, sample());
        c.insert(k2, sample());
        c.insert(k3, sample()); // should evict k1
        assert!(c.get(k1).is_none());
        assert!(c.get(k2).is_some());
        assert!(c.get(k3).is_some());
    }

    #[test]
    fn ttl_expires_entry() {
        let c = SemanticCache::new(4, Duration::from_millis(1));
        let k = SemanticCache::key("p", "m", 0.0);
        c.insert(k, sample());
        std::thread::sleep(Duration::from_millis(5));
        assert!(c.get(k).is_none());
    }

    #[test]
    fn key_stable_across_calls() {
        let k1 = SemanticCache::key("same prompt", "claude", 0.0);
        let k2 = SemanticCache::key("same prompt", "claude", 0.0);
        assert_eq!(k1, k2);
    }
}
