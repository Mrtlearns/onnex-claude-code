//! pgvector-backed store. Binds vector columns as Postgres `vector` type; raw SQL over
//! `sqlx` (not the pgvector sqlx crate so we keep deps tight).

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{PgPool, Row};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextEntry {
    pub id: i64,
    pub caller_id: String,
    pub session_id: Option<String>,
    pub role: String,
    pub content: String,
    pub token_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextSummary {
    pub id: i64,
    pub caller_id: String,
    pub summary_text: String,
    pub entry_count: i32,
    pub created_at: DateTime<Utc>,
}

#[derive(Clone)]
pub struct ContextStore {
    pool: PgPool,
}

impl ContextStore {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new entry. Embedding is written separately by the embedder worker.
    pub async fn insert_entry(
        &self,
        caller_id: &str,
        session_id: Option<&str>,
        role: &str,
        content: &str,
        token_count: i32,
    ) -> anyhow::Result<i64> {
        let row = sqlx::query(
            "INSERT INTO context_entries (caller_id, session_id, role, content, token_count) \
             VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(caller_id)
        .bind(session_id)
        .bind(role)
        .bind(content)
        .bind(token_count)
        .fetch_one(&self.pool)
        .await?;
        Ok(row.try_get::<i64, _>("id")?)
    }

    /// Update an entry with its embedding vector. Pgvector accepts `[a,b,c]` text form.
    pub async fn set_entry_embedding(
        &self,
        entry_id: i64,
        embedding: &[f32],
    ) -> anyhow::Result<()> {
        let literal = Self::vec_to_pg_literal(embedding);
        sqlx::query("UPDATE context_entries SET embedding = $1::vector WHERE id = $2")
            .bind(literal)
            .bind(entry_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// IDs of entries awaiting an embedding. Bounded by `limit`.
    pub async fn pending_embedding_ids(&self, limit: i64) -> anyhow::Result<Vec<(i64, String)>> {
        let rows = sqlx::query(
            "SELECT id, content FROM context_entries WHERE embedding IS NULL \
             ORDER BY created_at ASC LIMIT $1",
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push((r.try_get::<i64, _>("id")?, r.try_get::<String, _>("content")?));
        }
        Ok(out)
    }

    /// Unsummarized entries for a given caller — returns both ids and contents.
    pub async fn unsummarized(
        &self,
        caller_id: &str,
        limit: i64,
    ) -> anyhow::Result<Vec<(i64, String, String)>> {
        let rows = sqlx::query(
            "SELECT id, role, content FROM context_entries \
             WHERE caller_id = $1 AND summarized = FALSE \
             ORDER BY created_at ASC LIMIT $2",
        )
        .bind(caller_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push((
                r.try_get::<i64, _>("id")?,
                r.try_get::<String, _>("role")?,
                r.try_get::<String, _>("content")?,
            ));
        }
        Ok(out)
    }

    pub async fn distinct_callers_with_unsummarized(&self) -> anyhow::Result<Vec<String>> {
        let rows = sqlx::query(
            "SELECT DISTINCT caller_id FROM context_entries WHERE summarized = FALSE",
        )
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(|r| Ok(r.try_get::<String, _>("caller_id")?))
            .collect()
    }

    pub async fn mark_summarized(&self, ids: &[i64]) -> anyhow::Result<()> {
        if ids.is_empty() {
            return Ok(());
        }
        sqlx::query("UPDATE context_entries SET summarized = TRUE WHERE id = ANY($1)")
            .bind(ids)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn insert_summary(
        &self,
        caller_id: &str,
        summary_text: &str,
        summary_embedding: &[f32],
        source_entry_ids: &[i64],
    ) -> anyhow::Result<i64> {
        let literal = Self::vec_to_pg_literal(summary_embedding);
        let row = sqlx::query(
            "INSERT INTO context_summaries \
             (caller_id, summary_text, summary_embedding, source_entry_ids, entry_count) \
             VALUES ($1, $2, $3::vector, $4, $5) RETURNING id",
        )
        .bind(caller_id)
        .bind(summary_text)
        .bind(literal)
        .bind(source_entry_ids)
        .bind(source_entry_ids.len() as i32)
        .fetch_one(&self.pool)
        .await?;
        Ok(row.try_get::<i64, _>("id")?)
    }

    /// Vector search — top-k entries for caller_id ranked by cosine similarity.
    pub async fn search_entries(
        &self,
        caller_id: &str,
        query_embedding: &[f32],
        k: i64,
    ) -> anyhow::Result<Vec<ContextEntry>> {
        let literal = Self::vec_to_pg_literal(query_embedding);
        let rows = sqlx::query(
            "SELECT id, caller_id, session_id, role, content, token_count, created_at \
             FROM context_entries \
             WHERE caller_id = $1 AND embedding IS NOT NULL \
             ORDER BY embedding <=> $2::vector ASC \
             LIMIT $3",
        )
        .bind(caller_id)
        .bind(literal)
        .bind(k)
        .fetch_all(&self.pool)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push(ContextEntry {
                id: r.try_get("id")?,
                caller_id: r.try_get("caller_id")?,
                session_id: r.try_get("session_id").ok(),
                role: r.try_get("role")?,
                content: r.try_get("content")?,
                token_count: r.try_get("token_count")?,
                created_at: r.try_get::<DateTime<Utc>, _>("created_at")?,
            });
        }
        Ok(out)
    }

    pub async fn search_summaries(
        &self,
        caller_id: &str,
        query_embedding: &[f32],
        k: i64,
    ) -> anyhow::Result<Vec<ContextSummary>> {
        let literal = Self::vec_to_pg_literal(query_embedding);
        let rows = sqlx::query(
            "SELECT id, caller_id, summary_text, entry_count, created_at \
             FROM context_summaries \
             WHERE caller_id = $1 AND summary_embedding IS NOT NULL \
             ORDER BY summary_embedding <=> $2::vector ASC \
             LIMIT $3",
        )
        .bind(caller_id)
        .bind(literal)
        .bind(k)
        .fetch_all(&self.pool)
        .await?;
        let mut out = Vec::with_capacity(rows.len());
        for r in rows {
            out.push(ContextSummary {
                id: r.try_get("id")?,
                caller_id: r.try_get("caller_id")?,
                summary_text: r.try_get("summary_text")?,
                entry_count: r.try_get("entry_count")?,
                created_at: r.try_get::<DateTime<Utc>, _>("created_at")?,
            });
        }
        Ok(out)
    }

    fn vec_to_pg_literal(v: &[f32]) -> String {
        // pgvector accepts "[a,b,c]" text form.
        let mut s = String::with_capacity(v.len() * 8);
        s.push('[');
        for (i, x) in v.iter().enumerate() {
            if i > 0 {
                s.push(',');
            }
            use std::fmt::Write;
            let _ = write!(&mut s, "{x}");
        }
        s.push(']');
        s
    }
}
