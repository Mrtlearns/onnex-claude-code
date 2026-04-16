# Manual Configuration Required

Items that **cannot** be represented in Git-based artifacts and must be configured manually when deploying to a new Supabase instance (hosted or self-hosted).

---

## 1. Secrets & API Keys

| Secret | Where to Set | Notes |
|---|---|---|
| `LOVABLE_API_KEY` | Supabase Dashboard → Settings → Edge Functions, or `supabase secrets set` | Required for AI gateway calls (embedding generation, chat completions, entity/relation extraction). Obtain from Lovable workspace. |
| `SUPABASE_URL` | Auto-injected by Supabase runtime | No action needed on hosted Supabase. For self-hosted, set during `supabase init`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase runtime | For self-hosted, generate via `supabase gen keys`. |
| `SUPABASE_ANON_KEY` | Auto-injected by Supabase runtime | For self-hosted, generate via `supabase gen keys`. |
| `SUPABASE_DB_URL` | Auto-injected or set manually | Only needed if edge functions use direct DB connections. Format: `postgresql://postgres:password@host:5432/postgres` |

## 2. Authentication Configuration

| Item | Action Required |
|---|---|
| Email/password auth | Must be enabled in Supabase Dashboard → Authentication → Providers. Currently the only auth method in use. |
| Email templates | Default Supabase templates are in use (confirmation, password reset). No custom templates exist in the repo. |
| Site URL | Set in Dashboard → Authentication → URL Configuration. Must match your deployed frontend URL. |
| Redirect URLs | Add `/reset-password` path to allowed redirect URLs in Dashboard → Authentication → URL Configuration. |
| JWT secret / signing keys | Managed automatically on hosted Supabase. For self-hosted, generated during `supabase init` or `supabase gen keys`. |
| OAuth providers | None configured. If adding OAuth (Google, GitHub, etc.), configure entirely in Dashboard → Authentication → Providers. |

## 3. Existing Data (Not Exportable via Code)

| Item | Migration Strategy |
|---|---|
| User accounts & passwords | `auth.users` data — migrate via `supabase db dump --data-only` or have users re-register. |
| Table data (projects, documents, entities, etc.) | Migrate via `pg_dump` / `supabase db dump --data-only`. |
| Storage objects (uploaded files) | Download from source `documents` bucket, upload to destination. No CLI automation exists — use the Supabase Storage API or dashboard. |
| Generated embeddings | Stored in `document_chunks.embedding` — included in table data dump. Re-processing recommended after any embedding model change. |

## 4. Dashboard-Only Settings

| Item | Notes |
|---|---|
| Rate limiting | Supabase-managed, not configurable via migrations or config files. |
| Connection pooling (PgBouncer) | Supabase-managed for hosted. Configure manually for self-hosted (`pgbouncer.ini`). |
| Custom domains | Dashboard-only configuration (Settings → Custom Domains). |
| Log retention | Dashboard-only configuration. |
| Database backups schedule | Dashboard-only (Pro plan+). For self-hosted, configure `pg_dump` cron separately. |

## 5. Post-Migration Steps

After applying migrations and deploying edge functions to a new instance:

1. **Set secrets**: `supabase secrets set LOVABLE_API_KEY=lvbl_...`
2. **Enable email auth** in Dashboard → Authentication → Providers
3. **Set Site URL and redirect URLs** in Dashboard → Authentication → URL Configuration
4. **Update `.env`** with new `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_PROJECT_ID`
5. **If migrating data**: restore via `pg_restore` or `psql < dump.sql`
6. **If migrating storage**: download/upload files to the new `documents` bucket
7. **Reindex vectors**: `REINDEX INDEX idx_document_chunks_embedding;` (IVFFlat requires data to build properly)
8. **Smoke test**: sign up → create project → upload document → process → chat

## 6. Known Security Gaps to Address During Migration

- **Storage RLS policies are overly permissive**: Any authenticated user can read/delete any file in the `documents` bucket. Scope policies to project ownership before production use.
- **API keys stored in plaintext**: `project_api_keys.api_key` is unencrypted. Consider using Supabase Vault (`pgsodium`) for encryption at rest.
- **Edge functions depend on Lovable AI Gateway**: Both functions call `https://ai.gateway.lovable.dev/v1/chat/completions`. To decouple, replace with direct Google/OpenAI/Anthropic API calls and update the corresponding secret.
