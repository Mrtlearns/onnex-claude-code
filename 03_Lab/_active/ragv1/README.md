# RAG Document Intelligence Platform

A multi-tenant Retrieval-Augmented Generation (RAG) platform built with React, Supabase, and Deno Edge Functions. Upload documents, extract entities and relations, build a knowledge graph, and chat with your documents using configurable retrieval strategies.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Edge Functions](#edge-functions)
- [Embedding System](#embedding-system)
- [Authentication & Authorization](#authentication--authorization)
- [Environment Variables & Secrets](#environment-variables--secrets)
- [Features](#features)
- [Known Limitations & Gaps](#known-limitations--gaps)
- [Local Development](#local-development)
- [Migration Path to Self-Hosted Postgres](#migration-path-to-self-hosted-postgres)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  React SPA (Vite)                │
│  React 18 · React Router · TanStack Query       │
│  Tailwind CSS · shadcn/ui · Recharts            │
├─────────────────────────────────────────────────┤
│              Supabase Client SDK                 │
│     Auth · Realtime · Storage · PostgREST        │
├──────────────────┬──────────────────────────────┤
│  Supabase Auth   │  Supabase Edge Functions      │
│  (email/pass)    │  ┌─────────────────────────┐  │
│                  │  │ process-document        │  │
│                  │  │ • text chunking          │  │
│                  │  │ • semantic fingerprint   │  │
│                  │  │ • entity extraction      │  │
│                  │  │ • relation extraction    │  │
│                  │  ├─────────────────────────┤  │
│                  │  │ chat                     │  │
│                  │  │ • vector search          │  │
│                  │  │ • graph context          │  │
│                  │  │ • SSE streaming          │  │
│                  │  └─────────────────────────┘  │
├──────────────────┴──────────────────────────────┤
│           PostgreSQL + pgvector                  │
│  12 tables · RLS · SECURITY DEFINER helpers      │
│  vector(768) embeddings · cosine similarity      │
│  IVFFlat index · Storage bucket (documents)      │
└─────────────────────────────────────────────────┘
│                                                   │
│  External: Lovable AI Gateway                     │
│  → google/gemini-3-flash-preview (chat/entities)  │
│  → google/gemini-2.5-flash-lite (embeddings)      │
│  Embeddings: chat-based semantic fingerprinting    │
│  (30 concepts → 768-dim vector via hashing)        │
└───────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React + TypeScript | 18.3 |
| Build | Vite + SWC | 5.4 |
| Styling | Tailwind CSS + shadcn/ui | 3.4 |
| State | TanStack React Query | 5.x |
| Routing | React Router DOM | 6.30 |
| Charts | Recharts | 2.15 |
| Database | PostgreSQL (Supabase) | 15 |
| Vector Search | pgvector extension | 0.7+ |
| Auth | Supabase Auth | email/password |
| Storage | Supabase Storage | private bucket |
| Edge Functions | Deno (Supabase) | 1.x |
| AI Gateway | Lovable AI Gateway | Gemini models |

---

## Project Structure

```
├── src/
│   ├── App.tsx                     # Root: routes, providers
│   ├── main.tsx                    # Entry point with ErrorBoundary
│   ├── index.css                   # Design system tokens (HSL)
│   ├── components/
│   │   ├── AnimateIn.tsx           # Intersection Observer scroll animations
│   │   ├── AppLayout.tsx           # Sidebar + header + outlet
│   │   ├── AppSidebar.tsx          # Navigation menu (11 items)
│   │   ├── EmptyState.tsx          # Reusable empty state component
│   │   ├── NavLink.tsx             # React Router NavLink wrapper
│   │   ├── ProjectSelector.tsx     # Header project dropdown
│   │   ├── ProtectedRoute.tsx      # Auth guard redirect
│   │   └── ui/                     # shadcn/ui components (50+)
│   ├── contexts/
│   │   ├── AuthContext.tsx          # Supabase auth state
│   │   └── ProjectContext.tsx       # Active project selection
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── integrations/supabase/
│   │   ├── client.ts               # Supabase client singleton
│   │   └── types.ts                # Auto-generated DB types (read-only)
│   ├── lib/db/
│   │   ├── chat.ts                 # Chat sessions & messages CRUD
│   │   ├── documents.ts            # Documents & chunks CRUD + storage
│   │   ├── entities.ts             # Entities & relations queries
│   │   ├── profiles.ts             # User profile CRUD
│   │   ├── projects.ts             # Projects CRUD
│   │   └── settings.ts             # RAG settings & API keys CRUD
│   └── pages/
│       ├── Auth.tsx                 # Login / Signup / Forgot password
│       ├── ResetPassword.tsx        # Password reset handler
│       ├── Dashboard.tsx            # Overview: stats, entity chart, recent docs
│       ├── Projects.tsx             # CRUD project cards
│       ├── Documents.tsx            # Upload, process, view chunks
│       ├── Chat.tsx                 # RAG chat with streaming SSE
│       ├── Entities.tsx             # Entity list with type filter
│       ├── Relations.tsx            # Entity relation table
│       ├── KnowledgeGraph.tsx       # Force-directed graph (canvas)
│       ├── ApiKeys.tsx              # Per-project LLM provider keys
│       ├── UsageCosts.tsx           # Spend tracking + charts
│       ├── ApiDocs.tsx              # cURL / JS code examples
│       ├── Settings.tsx             # General, RAG, Budget, Models tabs
│       └── NotFound.tsx
├── supabase/
│   ├── config.toml                 # Edge function config
│   ├── migrations/                 # SQL migrations (read-only)
│   │   ├── 20260322002054_*.sql    # Initial schema (all tables, RLS, triggers)
│   │   └── 20260322033610_*.sql    # match_chunks RPC function
│   └── functions/
│       ├── chat/
│       │   ├── index.ts            # Chat endpoint (SSE streaming)
│       │   └── index.test.ts
│       └── process-document/
│           ├── index.ts            # Document processing pipeline
│           └── index.test.ts
├── docs/
│   ├── gap-analysis.md             # Detailed comparison vs Roko RAG demo
│   ├── edge-functions.md           # Full edge function source with commentary
│   └── postgres-bootstrap.sql      # Standalone Postgres schema (no Supabase deps)
├── .env                            # Supabase connection (auto-populated)
├── tailwind.config.ts
├── vite.config.ts
├── vitest.config.ts
└── tsconfig.json
```

---

## Database Schema

### Supabase Project

- **Project ID**: `cnpwjnmopjotgvthgenx`
- **URL**: `https://cnpwjnmopjotgvthgenx.supabase.co`

### Extensions

- `pgvector` (via `extensions` schema) — vector similarity search

### Enums

| Enum | Values |
|------|--------|
| `document_status` | uploaded, processing, processed, error |
| `chunk_status` | processed, error |
| `processing_event_status` | pending, success, error, retried |
| `entity_type` | organization, person, product, date, concept, event, technology, location, other |
| `chat_role` | user, assistant, system |
| `retrieval_mode` | mix, relation_only, global, human_in_the_loop |
| `provider_type` | openai, anthropic, google, local, other |
| `chunking_strategy` | standard, contextual, semantic, pro_contextual, ai_smart, page_based |
| `cost_mode` | basic, balanced, premium |

### Tables

#### `profiles`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References `auth.users(id)` |
| display_name | text | Nullable |
| created_at | timestamptz | Default: `now()` |

Auto-created via trigger `on_auth_user_created` → `handle_new_user()`.

#### `projects`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | Auto-generated identity |
| owner_id | uuid (FK→profiles) | Default: `auth.uid()` |
| name | text | Required |
| description | text | Nullable |
| default_system_prompt | text | Default prompt for chat |
| conversation_memory_window | integer | Default: 5 |
| spending_cap_usd | numeric | Default: 10.00 |
| current_spend_usd | numeric | Default: 0 |
| is_active | boolean | Default: true |
| created_at, updated_at | timestamptz | |

Auto-creates `project_rag_settings` via trigger `on_project_created` → `handle_new_project()`.

#### `project_rag_settings`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects, UNIQUE) | One-to-one |
| chunking_strategy | enum | Default: 'standard' |
| chunk_token_size | integer | Nullable |
| pages_per_chunk | integer | Nullable (for page_based) |
| ai_smart_description | text | Nullable (for ai_smart) |
| enable_entity_extraction | boolean | Default: false |
| enable_relation_extraction | boolean | Default: false |
| enable_ai_vision | boolean | Default: false |
| cost_mode | enum | Default: 'balanced' |
| human_in_the_loop_enabled | boolean | Default: false |
| agentic_enabled | boolean | Default: false |
| agentic_max_rounds | integer | Default: 3 |

#### `project_api_keys`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects) | |
| provider | enum | openai/anthropic/google/local/other |
| api_key | text | Stored in plaintext ⚠️ |
| model_name | text | e.g., "gpt-4o" |
| is_default | boolean | Default: false |

#### `documents`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects) | |
| name | text | Original filename |
| source_path | text | Storage bucket path |
| mime_type | text | Default: 'application/octet-stream' |
| status | enum | uploaded → processing → processed/error |
| global_metadata | jsonb | Default: {} |
| created_at, updated_at | timestamptz | |

#### `document_chunks`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| document_id | bigint (FK→documents) | CASCADE delete |
| content | text | Chunk text |
| page_number | integer | Nullable |
| chunk_index | integer | 0-based ordering |
| embedding | vector(768) | pgvector, nullable |
| metadata | jsonb | Default: {} |
| status | enum | processed/error |

**Indexes:**
- `idx_document_chunks_document_id` — B-tree on `document_id`
- `idx_document_chunks_embedding` — IVFFlat (cosine, lists=100)

#### `chunk_processing_events`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| document_id | bigint (FK→documents) | |
| chunk_id | bigint (FK→document_chunks) | Nullable, SET NULL on delete |
| status | enum | pending/success/error/retried |
| error_message | text | Nullable |
| created_at | timestamptz | |

#### `entities`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects) | |
| type | enum | 9 entity types |
| name | text | |
| metadata | jsonb | Includes `source_document_id` |

**Indexes:** `idx_entities_project_type`, `idx_entities_name`

#### `entity_relations`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects) | |
| source_entity_id | bigint (FK→entities) | CASCADE |
| target_entity_id | bigint (FK→entities) | CASCADE |
| relation_type | text | e.g., "works_for" |
| metadata | jsonb | Includes `source_document_id` |

#### `chat_sessions`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| project_id | bigint (FK→projects) | |
| title | text | Default: 'New Chat', auto-updated |
| created_at, updated_at | timestamptz | |

#### `chat_messages`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| chat_session_id | bigint (FK→chat_sessions) | CASCADE |
| role | enum | user/assistant/system |
| content | text | |
| created_at | timestamptz | |

#### `chat_retrieval_events`
| Column | Type | Notes |
|--------|------|-------|
| id | bigint (PK) | |
| chat_session_id | bigint (FK→chat_sessions) | |
| user_message_id | bigint (FK→chat_messages) | |
| retrieval_mode | enum | Which mode was used |
| agentic_rounds | integer | Default: 0 |
| selected_chunk_ids | bigint[] | Array of chunk IDs used |
| total_cost_usd | numeric | Default: 0 |
| model_used | text | Nullable |
| created_at | timestamptz | |

### Database Functions (RPC)

#### `match_chunks(query_embedding, match_project_id, match_threshold, match_count)`
Vector similarity search using cosine distance. Returns chunks with similarity score above threshold. Default threshold: 0.3 (lowered for chat-based embeddings).

#### `get_project_owner(p_project_id)` → uuid
SECURITY DEFINER helper for RLS policies.

#### `get_document_project_owner(p_document_id)` → uuid
Joins documents → projects to get owner. SECURITY DEFINER.

#### `get_chat_session_project_owner(p_session_id)` → uuid
Joins chat_sessions → projects to get owner. SECURITY DEFINER.

### Row-Level Security

All tables have RLS enabled. Ownership is verified via:
- Direct `owner_id` check (projects, profiles)
- `get_project_owner()` (project-scoped tables)
- `get_document_project_owner()` (document-scoped tables)
- `get_chat_session_project_owner()` (chat-scoped tables)

### Storage

- **Bucket**: `documents` (private)
- **Path format**: `{project_id}/{timestamp}_{filename}`
- RLS: authenticated users can upload/view/delete

---

## Edge Functions

### `process-document`

**Trigger**: Called via `supabase.functions.invoke()` after document upload.

**Pipeline**:
1. Verify auth (user token or service_role)
2. Download file from storage
3. Extract text (`fileData.text()` — plain text only ⚠️)
4. Chunk text with overlap (4000 chars, 800 overlap)
5. Generate embeddings per chunk via chat-based semantic fingerprinting
6. Extract entities if enabled (LLM structured output)
7. Extract relations if enabled (LLM structured output)
8. Update document status to `processed`

### `chat`

**Trigger**: Called via `fetch()` from the Chat page with SSE streaming.

**Pipeline**:
1. Verify auth
2. Save user message
3. Retrieve context:
   - **Vector search**: Generate query embedding → `match_chunks` RPC (threshold: 0.3)
   - **Graph search**: Find entities mentioned in query → get related chunks
4. Build system prompt with context + `[Source N]` citations
5. Stream response from Lovable AI Gateway (Gemini)
6. Save assistant message and retrieval event

**Config**: `verify_jwt = false` (handles auth manually)

For full source code, see [`docs/edge-functions.md`](docs/edge-functions.md).

---

## Embedding System

The platform uses **chat-based semantic fingerprinting** for embeddings. The Lovable AI Gateway only supports `/v1/chat/completions` (no `/v1/embeddings` endpoint), so embeddings are approximated:

1. **LLM extracts concepts**: `google/gemini-2.5-flash-lite` returns 30 concept-weight pairs via tool calling
2. **Deterministic hashing**: `conceptsToVector()` maps concepts to 768-dim vectors using character and bigram hashing
3. **L2 normalization**: Vectors are unit-normalized for cosine similarity
4. **Fallback**: `textToHashVector()` generates trigram-based hash vectors if LLM fails

This produces **functional** retrieval results — better than random but lower quality than dedicated embedding models like `text-embedding-3-small`.

**Upgrade path**: Replace `generateEmbedding()` / `generateQueryEmbedding()` with a real embedding API. Requires adding an API key for Google or OpenAI.

---

## Authentication & Authorization

- **Provider**: Supabase Auth (email/password)
- **Signup**: Email confirmation required
- **Password reset**: Via email link → `/reset-password` page
- **Session**: Persisted in localStorage, auto-refresh enabled
- **Route protection**: `<ProtectedRoute>` wrapper redirects to `/auth`
- **Data isolation**: RLS policies ensure users only see their own data
- **Error handling**: `ErrorBoundary` in `main.tsx` catches runtime crashes

---

## Environment Variables & Secrets

### Frontend (.env — auto-populated)

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/public key |
| `VITE_SUPABASE_PROJECT_ID` | Project ID |

### Edge Function Secrets (Supabase Dashboard)

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | Auto-set by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set by Supabase |
| `SUPABASE_ANON_KEY` | Auto-set by Supabase |
| `LOVABLE_API_KEY` | Lovable AI Gateway key (for LLM calls) |
| `SUPABASE_DB_URL` | Direct DB connection string |
| `SUPABASE_PUBLISHABLE_KEY` | Same as anon key |

---

## Features

| Feature | Status | Notes |
|---------|--------|-------|
| Multi-project management | ✅ Working | CRUD with per-project isolation |
| Email auth (signup/login/reset) | ✅ Working | Supabase Auth |
| Document upload to storage | ✅ Working | Drag & drop, multi-file |
| Text chunking with overlap | ✅ Working | Sentence-boundary splitting |
| Embedding generation | ⚠️ Approximate | Chat-based semantic fingerprinting (functional, not optimal) |
| Entity extraction (NER) | ✅ Working | 9 types via Gemini structured output |
| Relation extraction | ✅ Working | Between extracted entities |
| Knowledge graph visualization | ✅ Working | Force-directed canvas simulation |
| Chat with SSE streaming | ✅ Working | Real-time token streaming |
| Vector similarity search | ✅ Functional | Works with approximate embeddings (threshold: 0.3) |
| Graph-based retrieval | ✅ Working | Entity name matching + related chunks |
| Retrieval mode selection | ✅ UI only | mix, relation_only, global, human_in_loop |
| Human-in-the-loop | ❌ Not implemented | UI option exists, backend ignores it |
| Agentic RAG | ❌ Not implemented | DB settings exist, no logic |
| RAG settings configuration | ✅ Working | All settings saved to DB |
| API key management | ✅ Working | Per-project, per-provider |
| Budget/spend tracking | ✅ UI only | Tracks $0 (no cost calculation) |
| Dark mode | ✅ Working | next-themes toggle |
| API documentation page | ✅ Working | cURL + JS examples |

---

## Known Limitations & Gaps

See [`docs/gap-analysis.md`](docs/gap-analysis.md) for a detailed comparison against the Roko AI Agent RAG platform.

**Critical**:
1. Only plain text file processing (no PDF/DOCX)
2. Embeddings are approximate (chat-based fingerprinting, not a real embedding model)
3. Agentic mode settings exist but do nothing
4. Human-in-the-loop mode not implemented
5. No hybrid search (keyword + vector)
6. No re-ranking of retrieved chunks

---

## Local Development

### Prerequisites
- Node.js 18+ or Bun
- Supabase CLI (optional, for local Supabase)

### Setup
```bash
# Install dependencies
bun install  # or npm install

# Start dev server
bun run dev  # → http://localhost:8080

# Run tests
bun run test
```

### Key URLs
- **Preview**: The app runs on port 8080
- **Supabase Dashboard**: https://supabase.com/dashboard/project/cnpwjnmopjotgvthgenx
- **Edge Function Logs**: https://supabase.com/dashboard/project/cnpwjnmopjotgvthgenx/functions

---

## Migration Path to Self-Hosted Postgres

This project is designed to be portable from Supabase to self-hosted PostgreSQL + pgvector.

### 1. Database — Standalone Bootstrap

Use [`docs/postgres-bootstrap.sql`](docs/postgres-bootstrap.sql) to create the entire schema on vanilla Postgres 15+ with pgvector. This script:
- Replaces `auth.users` with a standalone `users` table
- Replaces `auth.uid()` with a `current_user_id()` placeholder function
- Removes `storage.buckets` references
- Preserves all 12 tables, indexes, RLS policies, triggers, and the `match_chunks` RPC

```bash
# On target Postgres 15+ with pgvector:
psql -d your_database -f docs/postgres-bootstrap.sql
```

**Required extensions:**
- `pgvector` — https://github.com/pgvector/pgvector
- `pgcrypto` or built-in `gen_random_uuid()` (Postgres 13+)

### 2. Authentication

Replace Supabase Auth with one of:
- **Option A**: Self-hosted Supabase (GoTrue) — minimal code changes
- **Option B**: Auth.js / NextAuth — requires rewriting `AuthContext.tsx` and RLS policies
- **Option C**: Custom JWT auth — implement `current_user_id()` as shown in `postgres-bootstrap.sql`

### 3. File Storage

Replace Supabase Storage with:
- **S3-compatible storage** (MinIO, AWS S3, Cloudflare R2)
- Update `uploadDocumentFile()` in `src/lib/db/documents.ts`
- Update file download in `process-document/index.ts`

### 4. Edge Functions → Standard Backend

Convert Deno Edge Functions to Node.js/Express or keep as Deno. See [`docs/edge-functions.md`](docs/edge-functions.md) for the full source code with conversion notes.

### 5. AI Gateway

Replace Lovable AI Gateway (`ai.gateway.lovable.dev`) with:
- **Direct OpenAI/Google/Anthropic API calls**
- **LiteLLM** proxy for multi-provider support
- **Ollama** for fully self-hosted inference
- **Real embedding model** (recommended: Google `text-embedding-004` or OpenAI `text-embedding-3-small`)

### Migration Checklist

- [ ] Provision Postgres 15+ with pgvector
- [ ] Run `docs/postgres-bootstrap.sql`
- [ ] Implement `current_user_id()` for your auth system
- [ ] Set up file storage (S3-compatible)
- [ ] Deploy edge functions as backend services
- [ ] Configure AI provider (embedding model + chat model)
- [ ] Update frontend environment variables
- [ ] Test document upload → process → chat flow end-to-end
- [ ] Set up backups and monitoring

---

## License

Private — all rights reserved.
