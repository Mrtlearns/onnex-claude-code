# Migration Readiness Report

Generated: 2026-03-23

## Summary

This report documents the completeness of the repository's backend-as-code representation, covering what is captured in source control, what was inferred, and what requires manual configuration when deploying to a new (including self-hosted) Supabase instance.

---

## 1. What Is Captured in Repository Files

### Database Schema (supabase/migrations/)

| Object | File | Status |
|---|---|---|
| `vector` extension (pgvector) | `20260322002054_*.sql` | ✅ Captured |
| 8 custom enums | `20260322002054_*.sql` | ✅ Captured |
| 12 tables (profiles, projects, project_rag_settings, project_api_keys, documents, document_chunks, chunk_processing_events, entities, entity_relations, chat_sessions, chat_messages, chat_retrieval_events) | `20260322002054_*.sql` | ✅ Captured |
| All constraints (PKs, FKs, NOT NULL, defaults, UNIQUE) | `20260322002054_*.sql` | ✅ Captured |
| IVFFlat vector index on `document_chunks.embedding` | `20260322002054_*.sql` | ✅ Captured |
| B-tree indexes (document_chunks.document_id, entities.project_id+type, entities.name) | `20260322002054_*.sql` | ✅ Captured |
| `vector(768)` column on `document_chunks` | `20260322002054_*.sql` | ✅ Captured |
| RLS enabled on all 12 tables | `20260322002054_*.sql` | ✅ Captured |
| 38 RLS policies | `20260322002054_*.sql` | ✅ Captured |
| 3 SECURITY DEFINER helper functions (get_project_owner, get_document_project_owner, get_chat_session_project_owner) | `20260322002054_*.sql` | ✅ Captured |
| `match_chunks` vector similarity RPC | `20260322033610_*.sql` | ✅ Captured |
| `handle_new_user()` trigger function + `on_auth_user_created` trigger | `20260322002054_*.sql` | ✅ Captured |
| `handle_new_project()` trigger function + `on_project_created` trigger | `20260322002054_*.sql` | ✅ Captured |
| Storage bucket `documents` (private) | `20260322002054_*.sql` | ✅ Captured |
| 3 storage RLS policies (INSERT, SELECT, DELETE for authenticated users) | `20260322002054_*.sql` | ✅ Captured |

### Edge Functions (supabase/functions/)

| Function | File | Status |
|---|---|---|
| `process-document` | `supabase/functions/process-document/index.ts` | ✅ Captured |
| `chat` | `supabase/functions/chat/index.ts` | ✅ Captured |

### Configuration

| Item | File | Status |
|---|---|---|
| Edge Function config (verify_jwt=false) | `supabase/config.toml` | ✅ Captured |
| Environment variable template | `.env.example` | ✅ Captured |
| Frontend Supabase client | `src/integrations/supabase/client.ts` | ✅ Captured |
| Auto-generated DB types | `src/integrations/supabase/types.ts` | ✅ Captured |

### Documentation

| Item | File | Status |
|---|---|---|
| Developer guide | `CLAUDE.md` | ✅ Captured |
| Architecture overview | `README.md` | ✅ Captured |
| Standalone Postgres bootstrap | `docs/postgres-bootstrap.sql` | ✅ Captured |
| Edge function reference | `docs/edge-functions.md` | ✅ Captured |
| Gap analysis | `docs/gap-analysis.md` | ✅ Captured |
| This report | `docs/MIGRATION_READINESS.md` | ✅ Captured |

---

## 2. What Was Inferred (Not Directly Exported)

| Item | Inference | Confidence |
|---|---|---|
| Trigger attachment (`on_auth_user_created` on `auth.users`) | Confirmed via migration SQL — trigger is on `auth.users` which is a Supabase-managed table | ⚠️ High — but `auth.users` trigger creation from a migration requires the migration to run with sufficient privileges |
| Storage bucket public/private status | Inferred from `INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)` — private bucket | ✅ High |
| No database views exist | Confirmed via types.ts (`Views: { [_ in never]: never }`) and migration files | ✅ High |
| No Realtime subscriptions | Confirmed via codebase search — no `supabase.channel()` or `.on()` usage | ✅ High |
| No cron/scheduled jobs | Confirmed via codebase search — no `pg_cron` references | ✅ High |
| No custom Postgres schemas beyond `public` | Confirmed — all objects in `public` schema | ✅ High |

---

## 3. What Requires Manual Configuration

These items **cannot** be represented in Git-based artifacts and must be configured manually in the Supabase dashboard (or via CLI) when deploying to a new instance:

### 3.1 Secrets / API Keys

| Secret | Where to Set | Notes |
|---|---|---|
| `LOVABLE_API_KEY` | Supabase Dashboard → Settings → Edge Functions | Required for AI gateway (embedding, chat, entity extraction) |
| `SUPABASE_URL` | Auto-injected by Supabase runtime | No action needed |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase runtime | No action needed |
| `SUPABASE_ANON_KEY` | Auto-injected by Supabase runtime | No action needed |
| `SUPABASE_DB_URL` | Auto-injected or set manually | Only needed if edge functions use direct DB connections |
| `SUPABASE_PUBLISHABLE_KEY` | Set manually if edge functions reference it | Currently set but not used by edge functions |

### 3.2 Authentication Configuration

| Item | Notes |
|---|---|
| Auth providers (email/password) | Email auth must be enabled in Supabase dashboard. Currently only email/password is used — no OAuth providers configured. |
| Email templates | Default Supabase email templates are in use (confirmation, password reset). No custom templates in the repo. |
| Auth settings (site URL, redirect URLs) | Must be configured in dashboard: Site URL, Redirect URLs for password reset flow (`/reset-password`). |
| JWT secret / signing keys | Managed by Supabase. For self-hosted, generated during `supabase init` or `supabase gen keys`. |

### 3.3 Existing Data (Not Exportable via Code)

| Item | Notes |
|---|---|
| User accounts & passwords | `auth.users` data — must be migrated via `supabase db dump --data-only` or users re-register |
| Table data (projects, documents, entities, etc.) | Must be migrated via `pg_dump` / `supabase db dump` |
| Storage objects (uploaded document files) | Must be migrated manually — download from source bucket, upload to destination |
| Generated embeddings | Stored in `document_chunks.embedding` — included in table data migration, but re-processing is recommended after any embedding model change |

### 3.4 Dashboard-Only Settings

| Item | Notes |
|---|---|
| Rate limiting | Supabase-managed, not configurable via migrations |
| Connection pooling (PgBouncer) | Supabase-managed for hosted; configure manually for self-hosted |
| Custom domains | Dashboard-only configuration |
| Log retention | Dashboard-only configuration |

---

## 4. Risky Gaps & Ambiguities

### 4.1 Storage Policies Are Permissive
The current storage RLS policies allow **any authenticated user** to read/delete **any** document in the `documents` bucket — not just their own. This is a security gap:

```sql
-- Current (too permissive):
CREATE POLICY "Authenticated users can view own documents" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'documents');

-- Should be (scoped to user's projects):
-- Requires a helper function that checks storage path ownership
```

**Risk level: MEDIUM** — mitigated by the fact that storage paths include `project_id` as a prefix, but there's no enforcement preventing one user from guessing another user's path.

### 4.2 IVFFlat Index Requires Data
The IVFFlat index (`lists = 100`) is created in the initial migration, but IVFFlat requires existing data to build properly. On a fresh database with no embeddings, the index will be empty and queries may return no results until `REINDEX` is run after data is inserted.

**Recommendation**: After initial data load, run `REINDEX INDEX idx_document_chunks_embedding;`

### 4.3 Trigger on `auth.users`
The `on_auth_user_created` trigger is attached to `auth.users`, which is a Supabase-managed schema table. This works on hosted Supabase and self-hosted Supabase, but:
- It cannot be tested in isolation
- If migrating to a non-Supabase auth system, this trigger must be replaced with application-level logic

### 4.4 API Keys Stored in Plaintext
`project_api_keys.api_key` stores raw API key strings. While RLS restricts access to the project owner, the keys are visible in database dumps and backups.

**Recommendation**: Use Supabase Vault (`pgsodium`) for encryption at rest.

### 4.5 Edge Functions Depend on Lovable AI Gateway
Both edge functions call `https://ai.gateway.lovable.dev/v1/chat/completions`. This is a Lovable-specific service. If migrating away from Lovable:
- Replace with direct API calls to Google (Gemini), OpenAI, or Anthropic
- Update model names accordingly
- The `LOVABLE_API_KEY` secret would be replaced with the provider's API key

---

## 5. Self-Hosted Migration Checklist

```
□ Install Supabase CLI
□ Run `supabase init` in a new directory
□ Copy supabase/migrations/ and supabase/functions/ from this repo
□ Copy supabase/config.toml
□ Run `supabase start` (local) or `supabase link` (remote)
□ Run `supabase db reset` to apply all migrations
□ Set secrets: `supabase secrets set LOVABLE_API_KEY=...`
□ Deploy edge functions: `supabase functions deploy`
□ Enable email auth in dashboard
□ Configure site URL and redirect URLs
□ Update .env with new project URL and anon key
□ If migrating data: use pg_dump/pg_restore from source
□ If migrating storage: download/upload files to new bucket
□ After data migration: REINDEX the IVFFlat index
□ Test: sign up, create project, upload document, process, chat
```

---

## 6. Files Created or Modified in This Normalization

| Action | File |
|---|---|
| Created | `.env.example` |
| Created | `supabase/seed.sql` |
| Created | `docs/MIGRATION_READINESS.md` |
| Verified | `supabase/migrations/20260322002054_*.sql` (initial schema — already complete) |
| Verified | `supabase/migrations/20260322033610_*.sql` (match_chunks — already complete) |
| Verified | `supabase/config.toml` (already correct) |
| Verified | `supabase/functions/chat/index.ts` (already in repo) |
| Verified | `supabase/functions/process-document/index.ts` (already in repo) |
