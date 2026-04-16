# Phase 08 — Lead Intelligence

**Milestone:** v3.1

## Scope

Three capabilities: (1) AI lead scoring on intake, (2) duplicate lead detection, (3) pgvector case embeddings with similar-case finder. Makes intake smarter — staff know which leads to prioritize and can learn from past similar cases.

---

## Wave 1: pgvector Image Swap

**Goal:** Switch Postgres image to pgvector-enabled variant. Zero data loss.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Update `docker-compose.yml`: change `postgres:15` → `pgvector/pgvector:pg15` | `docker-compose.yml` | No |
| 1.2 | Migration 009: `CREATE EXTENSION IF NOT EXISTS vector;` + `case_embeddings` table (case_id FK, embedding vector(1536), created_at) | `postgres/migrations/009_lead_intelligence.sql` | No |
| 1.3 | Deploy: `docker compose pull postgres && docker compose up -d postgres` — verify extension installed | server commands | No |

---

## Wave 2: Lead Scoring

**Goal:** AI score (0–100) computed on lead creation and stored on lead record.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Migration 009: add `lead_score INTEGER`, `lead_score_reason TEXT`, `is_duplicate BOOLEAN DEFAULT false` to `leads` table | `postgres/migrations/009_lead_intelligence.sql` | No |
| 2.2 | Add AI endpoint `POST /ai/score-lead` — takes lead_id, fetches lead data, calls Claude with scoring prompt (injury type, source, time to contact, description), returns 0–100 score + 1-line reason. Stub: returns score=75 + reason="stub" when `OPENROUTER_API_KEY=stub` | `ai/main.py` | No |
| 2.3 | Add n8n workflow `lead-scoring.json` — webhook on lead create → POST /ai/score-lead → PATCH /api/leads with score | `n8n/lead-scoring.json` | Yes (n8n-workflow-builder) |
| 2.4 | Frontend: add score badge to LeadDetail header (color-coded: green ≥70, yellow 40–69, red <40) + reason tooltip | `frontend/src/pages/LeadDetail.tsx` | No |
| 2.5 | Frontend: add score column to Leads list with sort; add "High Priority" filter preset | `frontend/src/pages/Leads.tsx` | No |

---

## Wave 3: Duplicate Detection

**Goal:** Flag duplicate leads (same phone or same name + similar injury type). No blocking — visibility only.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add DB function `check_lead_duplicate(p_phone, p_first_name, p_last_name, p_firm_id)` returns existing lead UUID if match found | `postgres/migrations/009_lead_intelligence.sql` | No |
| 3.2 | Update AI service or auth service: on lead creation (via n8n or direct POST hook), call duplicate check → PATCH lead.is_duplicate = true if match found | `ai/main.py` | No |
| 3.3 | Frontend: show "Possible Duplicate" banner on LeadDetail with link to matched lead when is_duplicate = true | `frontend/src/pages/LeadDetail.tsx` | No |

---

## Wave 4: Case Embeddings + Similar Case Finder

**Goal:** Embed closed case facts; surface top 3 similar cases on CaseDetail for reference.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Add AI endpoint `POST /ai/embed-case` — fetches case + client + medical providers + settlement, builds text summary, generates embedding (stub: deterministic fake `[0.1] * 1536` when key=stub), stores in `case_embeddings` | `ai/main.py` | No |
| 4.2 | Add AI endpoint `GET /ai/similar-cases/{case_id}` — embed current case description, cosine similarity search against `case_embeddings`, return top 3 with similarity score | `ai/main.py` | No |
| 4.3 | Frontend: `SimilarCasesPanel` component on CaseDetail Overview tab — shows up to 3 similar cases with case number, injury type, settlement amount, similarity %; click → navigate to that case | `frontend/src/components/SimilarCasesPanel.tsx` | No |
| 4.4 | Backfill: n8n one-shot workflow or script to embed all existing closed cases | `n8n/backfill-embeddings.json` | No |

---

## Success Criteria

- [ ] pgvector extension installed on Postgres (`SELECT * FROM pg_extension WHERE extname='vector'` returns row)
- [ ] Lead score (0–100) computed and stored within 30 seconds of lead creation
- [ ] Score badge visible on LeadDetail with color coding
- [ ] Duplicate leads flagged with banner and link to matched lead
- [ ] Similar cases returned for at least one test case (requires backfill run)
- [ ] Similar case panel renders on CaseDetail with settlement amounts

---

## Technical Notes

- Embedding model: OpenRouter `text-embedding-3-small` ($0.02/1M tokens)
- Stub embedding: `[0.1] * 1536` — deterministic, cosine similarity will work, returns results
- pgvector cosine similarity: `embedding <=> query_embedding` operator (lower = more similar)
- Scoring prompt: assess injury type severity, source quality, time-since-accident, description completeness
