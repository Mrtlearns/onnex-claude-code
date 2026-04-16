# Phase 11 — Advanced AI

**Milestone:** v4.0

## Scope

Wyatt gains live database access via MCP tool; documents are searchable by meaning via RAG; staff get an objection-handling knowledge base; demand letter generation is enhanced with full auto-pull from case data.

**Prerequisite:** Anthropic account credits added before executing this phase (see Open Questions in STATE.md).

---

## Wave 1: Document RAG Pipeline

**Goal:** Uploaded documents are chunked, embedded, and searchable by semantic meaning.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Migration 012: `document_chunks` table (document_id FK, chunk_index INT, content TEXT, embedding vector(1536)) | `postgres/migrations/012_advanced_ai.sql` | No |
| 1.2 | Add `POST /ai/embed-document` endpoint — reads stored file, chunks by paragraph/page, calls embedding API (text-embedding-3-small via OpenRouter), stores chunks. Stub: fake embeddings when `OPENROUTER_API_KEY=stub`. | `ai/main.py` | No |
| 1.3 | Trigger embedding on document upload (fire-and-forget from files service or n8n webhook) | `files/main.py` or n8n | No |
| 1.4 | Add `POST /ai/search-documents` endpoint — embed query, cosine similarity on document_chunks, return top 5 chunks with document metadata | `ai/main.py` | No |
| 1.5 | Frontend: document search input on Documents tab of CaseDetail — semantic search across case documents | `frontend/src/components/DocumentPanel.tsx` | No |

---

## Wave 2: Wyatt DB Tool

**Goal:** Wyatt can query live case and lead data via a registered MCP tool connected to PostgREST.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Create Python MCP server `tools/postgrest-mcp.py` — exposes tools: `get_leads`, `get_lead(id)`, `get_cases`, `get_case(id)`, `get_communications(lead_id)` using service-role JWT | `tools/postgrest-mcp.py` | No |
| 2.2 | Register MCP server in OpenClaw workspace config | `openclaw/workspace/TOOLS.md` | No |
| 2.3 | Update `openclaw/workspace/SOUL.md` with new section "## What you can do" — list the DB tools and when to use them | `openclaw/workspace/SOUL.md` | No |
| 2.4 | Smoke test: ask Wyatt "How many leads were created this week?" — verify he calls the tool and returns a real count | manual test | No |

---

## Wave 3: Objection-Handling Library

**Goal:** Staff-editable FAQ/objection library; Wyatt uses it in responses.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Migration 012: `objection_library` table (firm_id, category, objection TEXT, response TEXT, active BOOLEAN) | `postgres/migrations/012_advanced_ai.sql` | No |
| 3.2 | Seed with 20 common PI intake objections (e.g. "I don't have time", "I don't want to sue", "My injuries aren't that bad") + attorney-approved responses | `postgres/migrations/012_advanced_ai.sql` | No |
| 3.3 | Frontend: "Objection Library" tab in Settings — table of objections + responses with edit/add/delete | `frontend/src/pages/Settings.tsx` | No |
| 3.4 | Include objection library in Wyatt's context (inject top 20 active responses into USER.md or via tool) | `openclaw/workspace/USER.md` | No |

---

## Wave 4: Enhanced Demand Letter

**Goal:** Demand letter generation auto-pulls all structured data; result is richer and more accurate.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Update `POST /ai/generate-demand/{case_id}` — expand data pull to include: all medical providers + lien amounts + request status, all case costs, settlement offer history, AI medical summaries from ai_analyses, client insurance carrier + adjuster | `ai/main.py` | No |
| 4.2 | Update demand letter prompt template — produce: header (case facts), injury narrative (from AI medical summary), specials table (provider, amount, lien), demand amount calculation, and closing | `ai/main.py` | No |

---

## Success Criteria

- [ ] Document chunk embeddings stored for at least one uploaded document
- [ ] Semantic search on Documents tab returns relevant text chunks
- [ ] Wyatt can answer "How many open cases are in negotiation?" using the DB tool
- [ ] Objection library tab in Settings shows 20+ entries; editable
- [ ] Demand letter for a fully-populated case includes medical provider table + specials total + demand amount

---

## Technical Notes

- MCP server: sidecar script in openclaw container, registered in `openclaw.json` — no new service needed
- PostgREST MCP: use service-role JWT (not client JWT) for full read access
- Embedding: `text-embedding-3-small` via OpenRouter — stub with `[0.1] * 1536` when key=stub
- Chunk size: ~500 tokens, overlap ~50 tokens — good balance for legal docs
- Wyatt DB tool: read-only (SELECT only); no write tools in Phase 11
