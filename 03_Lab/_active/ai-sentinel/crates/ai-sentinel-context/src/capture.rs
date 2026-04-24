//! Capture path — fire-and-forget channel that receives conversation turns and persists
//! them via the `ContextStore`, then opportunistically triggers the embedder.
//!
//! Zero hot-path cost: the pipeline just calls `capture.send(...)` which is an
//! unbounded-channel send. All IO happens on the background worker.

use crate::embedder::Embedder;
use crate::store::ContextStore;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureRequest {
    pub caller_id: String,
    pub session_id: Option<String>,
    pub role: String,
    pub content: String,
    pub token_count: i32,
}

/// Cheap handle threaded through `AppState`. Clonable.
#[derive(Clone)]
pub struct ContextCapture {
    tx: mpsc::UnboundedSender<CaptureRequest>,
}

impl ContextCapture {
    pub fn start(store: ContextStore, embedder: Arc<dyn Embedder>) -> Self {
        let (tx, mut rx) = mpsc::unbounded_channel::<CaptureRequest>();
        tokio::spawn(async move {
            info!("context: capture worker started");
            while let Some(req) = rx.recv().await {
                let id = match store
                    .insert_entry(
                        &req.caller_id,
                        req.session_id.as_deref(),
                        &req.role,
                        &req.content,
                        req.token_count,
                    )
                    .await
                {
                    Ok(id) => id,
                    Err(e) => {
                        error!(error = %e, "context: insert failed");
                        continue;
                    }
                };
                // Generate embedding opportunistically. If it fails, the entry stays
                // embedding-less; the embedder sweep will retry.
                match embedder.embed(&req.content).await {
                    Ok(emb) => {
                        if let Err(e) = store.set_entry_embedding(id, &emb).await {
                            warn!(error = %e, id, "context: embedding write failed");
                        }
                    }
                    Err(e) => {
                        warn!(error = %e, id, "context: embed call failed — will retry in sweep");
                    }
                }
            }
            info!("context: capture worker shut down");
        });
        Self { tx }
    }

    pub fn send(&self, req: CaptureRequest) {
        let _ = self.tx.send(req); // non-blocking; drop on backpressure is acceptable
    }
}

/// Background sweep that embeds any entries that are still missing embeddings.
/// Runs every `interval` and batches up to `batch_size` per pass.
pub fn spawn_embedding_sweep(
    store: ContextStore,
    embedder: Arc<dyn Embedder>,
    interval: std::time::Duration,
    batch_size: i64,
) {
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(interval);
        loop {
            tick.tick().await;
            match store.pending_embedding_ids(batch_size).await {
                Ok(rows) if !rows.is_empty() => {
                    for (id, content) in rows {
                        match embedder.embed(&content).await {
                            Ok(emb) => {
                                if let Err(e) = store.set_entry_embedding(id, &emb).await {
                                    warn!(error = %e, id, "context: sweep write failed");
                                }
                            }
                            Err(e) => {
                                warn!(error = %e, id, "context: sweep embed failed");
                            }
                        }
                    }
                }
                Err(e) => warn!(error = %e, "context: sweep query failed"),
                _ => {}
            }
        }
    });
}
