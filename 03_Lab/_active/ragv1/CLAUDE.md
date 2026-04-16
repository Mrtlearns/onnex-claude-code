# Claude Workspace — Pro

> **Template:** claude-workspace-pro | Full framework: TELOS + Agents + Hooks + GSD
> **Owner:** Mr. T — Onnex AI Agency
> **Project:** RAGv1
> **Vertical:** Lab
> **Started:** 2026-04-03

---

## Who You Are Working With

Mr. T is an AI Development Engineer, Software Architect, SAP Expert (18 modules), Cybersecurity Expert, and Business Process Optimization Expert. He owns **Onnex**, an AI Agency that delivers AI-assisted Operating Systems to SME businesses across multiple verticals: NDT/aerospace, medical, MSPs, and PI law firms.

**Read `context/` for full details.**

---

## What This Project Is

Multi-tenant RAG (Retrieval-Augmented Generation) pipeline experiment — originated in Lovable, self-hosted and extended under the Onnex lab. Users create projects, upload documents, which are chunked/embedded/entity-extracted via Supabase Edge Functions, then chatted with using configurable retrieval strategies. A knowledge graph visualizes extracted entities and relations.

**Lab goal:** Prove out RAG patterns (real embeddings, hybrid search, agentic retrieval, PDF parsing) as a potential Onnex internal tool or client-facing product.

---

## Your Role

You are a senior technical collaborator. You help plan, build, debug, and improve work in this workspace. You operate at an expert level — no hand-holding, no excessive explanation unless asked.

When given complex or multi-step tasks, default to using `/supervise` to orchestrate agents rather than doing everything yourself. Use agents for parallelizable work.

---

## Task Completion Format (MANDATORY)

After completing ANY task — always close with this exact format:

```
Done with task: <task name>

You asked for: <one-line restatement of the request>

| Step | Description | Tested | Status |
|------|-------------|--------|--------|
| 1    | ...         | 🟢/🟡/🔴 | 🟢/🟡/🔴 |

Legend: 🟢 Pass / Done  🟡 Partial / Warning  🔴 Fail / Blocked

Remaining To-Do or Human actions:
- ...
```

Tested = smoke test ran for this step. Status = step fully succeeded.
Issues → 🟡 or 🔴 with explanation in Remaining To-Do.
No human action needed → "None — fully automated."

---

## File Placement Rules

**Always put new files in the correct subfolder — never at the project root.**

| File type | Destination |
|-----------|-------------|
| Scripts, utilities, one-off tools (.py, .sh, .js) | `scripts/` |
| Deliverables, reports, exports (.pdf, .docx, .xlsx, .csv, .html) | `outputs/` |
| Planning docs, specs, PRDs, design notes (.md, .txt) | `plans/` |
| Architecture diagrams, API specs, domain models | `context/` |
| Session state, cost logs | `.claude/state/` |
| Test files | `src/test/` or `tests/` |
| Application source code | `src/`, `supabase/` |

**Legitimate root-only files:** CLAUDE.md, README.md, LICENSE, docker-compose.yml, Dockerfile, .gitignore, .env, .env.example, package.json, bun.lock, tsconfig*.json, vite.config.ts, tailwind.config.ts, postcss.config.js, components.json, eslint.config.js, playwright*.ts, vitest.config.ts

**Run `/cleanup` after any heavy session** to audit and move stray files.

---

## Adaptive Depth

Read `core/adaptive-depth.md` to select methodology based on task complexity:
- **DIRECT** — Single file, config change, quick fix — execute immediately
- **WORKFLOW** — Feature work — plan + TDD + review + verify
- **ALGORITHM** — Architecture / design — ISC + full methodology

---

## Key Constraints & Preferences

- Direct, no fluff. Expert-level communication.
- Stack is TypeScript/React + Supabase — match the existing patterns
- Never hardcode secrets — use env vars or credential stores
- Commits: descriptive, conventional commit format
- `src/integrations/supabase/types.ts` is AUTO-GENERATED — never edit manually

---

## Post-Build / Post-Fix Verification Protocol

After any build, fix, or deployment:

1. **File placement** — Confirm files exist at correct paths (not at project root)
2. **Build success** — `bun run build` — no TypeScript errors
3. **Dev server** — `bun run dev` serves on port 8080
4. **Live smoke test** — Hit affected pages/functions directly
5. **Playwright E2E** — Run/write tests covering changed behavior

---

---

## Project Technical Reference (from Lovable)

### Quick Start

```bash
bun install        # Install dependencies
bun run dev        # Start dev server on port 8080
bun run test       # Run Vitest tests
bun run build      # Production build
```

---

### Repository Layout

```
src/
├── App.tsx                          # Routes and providers (React Router, TanStack Query, Auth, Theme)
├── index.css                        # Tailwind design tokens (all HSL, light + dark mode)
├── components/
│   ├── AnimateIn.tsx                # Intersection Observer scroll-reveal wrapper
│   ├── AppLayout.tsx                # Main layout: sidebar + header with ProjectSelector + <Outlet>
│   ├── AppSidebar.tsx               # 11-item sidebar navigation
│   ├── EmptyState.tsx               # Reusable icon + title + description + optional CTA
│   ├── NavLink.tsx                  # React Router NavLink with active class support
│   ├── ProjectSelector.tsx          # Header dropdown to switch active project
│   ├── ProtectedRoute.tsx           # Auth guard: redirects to /auth if not logged in
│   └── ui/                          # ~50 shadcn/ui primitives (don't modify unless needed)
├── contexts/
│   ├── AuthContext.tsx              # Wraps supabase.auth, exposes user/session/signOut
│   └── ProjectContext.tsx           # Fetches user's projects, manages selectedProject state
├── lib/db/
│   ├── chat.ts                      # getChatSessions, createChatSession, getChatMessages, sendChatMessage
│   ├── documents.ts                 # getDocuments, createDocument, deleteDocument, uploadDocumentFile, getDocumentChunks
│   ├── entities.ts                  # getEntities, getEntityRelations, getEntityCount, getEntityDistribution
│   ├── profiles.ts                  # getProfile, updateProfile
│   ├── projects.ts                  # getProjects, getProject, createProject, updateProject, deleteProject
│   └── settings.ts                  # getRagSettings, updateRagSettings, getApiKeys, upsertApiKey, deleteApiKey
├── integrations/supabase/
│   ├── client.ts                    # Supabase client singleton (DO NOT hardcode new keys here)
│   └── types.ts                     # AUTO-GENERATED from DB schema — READ-ONLY, never edit
└── pages/
    ├── Auth.tsx                      # Login + Signup tabs + forgot password flow
    ├── ResetPassword.tsx             # Password reset via recovery link
    ├── Dashboard.tsx                 # Stats cards, entity distribution chart, recent docs
    ├── Projects.tsx                  # Project cards with CRUD
    ├── Documents.tsx                 # Upload, drag-drop, process, view chunks, edit metadata
    ├── Chat.tsx                      # Session list + chat with SSE streaming + retrieval mode selector
    ├── Entities.tsx                  # Paginated entity table with type filter
    ├── Relations.tsx                 # Paginated relation table
    ├── KnowledgeGraph.tsx            # Force-directed graph on HTML canvas
    ├── ApiKeys.tsx                   # Per-project API key management
    ├── UsageCosts.tsx                # Spend tracking with bar/pie charts
    ├── ApiDocs.tsx                   # cURL + JS code examples
    └── Settings.tsx                  # 4 tabs: General, RAG, Budget, Models

supabase/
├── config.toml                      # verify_jwt=false for both functions (they handle auth manually)
├── migrations/                      # READ-ONLY — do not edit, create new migrations
│   ├── 20260322002054_*.sql         # Full initial schema: 12 tables, RLS, triggers, storage
│   └── 20260322033610_*.sql         # match_chunks vector similarity function
└── functions/
    ├── chat/index.ts                # SSE streaming chat with vector + graph retrieval
    └── process-document/index.ts    # Document processing: chunk → embed → extract entities/relations
```

---

### Supabase Configuration

- **Project ID**: `cnpwjnmopjotgvthgenx`
- **URL**: `https://cnpwjnmopjotgvthgenx.supabase.co`
- **Anon Key**: See `src/integrations/supabase/client.ts` or `.env`

**Edge Function Secrets** (set in Supabase dashboard → Settings → Edge Functions):
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (auto)
- `LOVABLE_API_KEY` — Required for AI calls (Lovable AI Gateway)
- `SUPABASE_DB_URL` — Direct Postgres connection string

**Storage:** Bucket `documents` (private) — path: `{project_id}/{timestamp}_{filename}`

---

### Database Schema

12 tables, all RLS-enabled. Ownership chain: `auth.users` → `profiles` → `projects` → everything else.

```
profiles (1:1 with auth.users, auto-created on signup)
  └── projects (owner_id → profiles.id)
       ├── project_rag_settings (1:1, auto-created via trigger)
       ├── project_api_keys (1:many)
       ├── documents (1:many)
       │    ├── document_chunks (1:many, has vector(768) embedding)
       │    └── chunk_processing_events (1:many)
       ├── entities (1:many)
       │    └── entity_relations (many:many via source/target entity)
       └── chat_sessions (1:many)
            ├── chat_messages (1:many)
            └── chat_retrieval_events (1:many)
```

RLS uses SECURITY DEFINER helper functions: `get_project_owner()`, `get_document_project_owner()`, `get_chat_session_project_owner()`.

Vector search: `document_chunks.embedding vector(768)`, IVFFlat cosine index, `match_chunks()` RPC.

---

### Edge Functions

**`process-document`**: chunk → embed → entity extract → relation extract → update status.
⚠️ Currently uses fake embeddings (LLM outputs 768 floats — not semantic vectors).
⚠️ Only handles plain text (`fileData.text()`) — no PDF/DOCX support yet.

**`chat`**: auth → save user message → retrieve chunks → build prompt → stream Gemini response → save assistant message.
Both functions: `verify_jwt = false`, handle auth manually, support user tokens + service_role.

---

### Critical Known Issues

1. **Fake embeddings** — Replace `generateEmbedding()` with real API (OpenAI `text-embedding-3-small`, Google `text-embedding-004`)
2. **No PDF/DOCX parsing** — Add parser or AI vision extraction
3. **UI features with no backend**: agentic mode, human-in-the-loop, chunking strategies, cost tracking
4. **API keys in plaintext** — Consider Supabase Vault

See `docs/gap-analysis.md` for full analysis.

---

### Coding Conventions

- **Pages**: `src/pages/` — one file per route, default export
- **Components**: `src/components/` — named exports, small and focused
- **DB queries**: `src/lib/db/` — one file per domain, async functions that throw on error
- **Contexts**: `src/contexts/` — custom hooks (`useAuth`, `useProject`)
- Colors: Tailwind design tokens only (`bg-primary`, `text-muted-foreground`); defined as HSL in `src/index.css`
- All interactive elements: `active:scale-[0.95-0.98]`
- Data fetching: `useEffect` with selectedProject as dependency
- Toasts: `sonner` (`toast.success()`, `toast.error()`)

---

### Testing

```bash
bun run test              # All Vitest tests
bun run test -- --watch   # Watch mode
```

Frontend: `src/test/` (Vitest + jsdom). Edge functions: `supabase/functions/*/index.test.ts` (Deno.test).

---

### Priority Roadmap

1. **Replace fake embeddings** with real embedding model API
2. **Add PDF/DOCX parsing** in process-document
3. **Implement agentic retrieval loop** (multi-round, query reformulation)
4. **Add hybrid search** (BM25 full-text + vector similarity + RRF)
5. **Implement human-in-the-loop** chunk selection workflow
6. **Add RAG evaluation dashboard** (precision, recall, faithfulness)
7. **Add re-ranking** step after retrieval
8. **Implement remaining chunking strategies** (semantic, page_based, etc.)
