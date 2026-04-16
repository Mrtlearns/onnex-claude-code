# Phase 3 — Document AI: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v1.2

---

## Scope

Adds an AI layer on top of the Phase 2 document and case management foundation. A new FastAPI `ai` service calls the Claude API (claude-sonnet-4-6) to analyze uploaded medical records, auto-classify documents on upload, generate editable demand letter drafts, and summarize intake notes. Results are stored in new DB tables and surfaced directly on the case detail UI.

---

## Waves

### Wave 1: AI Service + Database
**Goal:** New `ai` FastAPI service scaffolded, wired into Docker Compose, and DB tables created for storing analysis results.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write migration 003 — `ai_analyses` and `demand_letters` tables with RLS + grants | `postgres/migrations/003_document_ai.sql` | No |
| 1.2 | Create AI service Dockerfile + requirements (fastapi, anthropic, pdfminer.six, python-docx, pypdfium2) | `ai/Dockerfile`, `ai/requirements.txt` | No |
| 1.3 | Add `ai` service to docker-compose.yml with `ANTHROPIC_API_KEY` env var and Traefik route `/ai` | `docker-compose.yml` | No |

---

### Wave 2: AI Service — Core Endpoints
**Goal:** All AI processing endpoints implemented with text extraction + Claude API calls.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Text extraction utility — PDF (pdfminer), DOCX (python-docx), image (base64 for Claude vision) | `ai/extract.py` | No |
| 2.2 | `POST /ai/analyze-document` — extract text from stored file → Claude API (medical record prompt) → store result in `ai_analyses` | `ai/main.py` | No |
| 2.3 | `POST /ai/classify-document` — extract first 500 chars → Claude API (classification prompt) → return doc_type + confidence | `ai/main.py` | No |
| 2.4 | `POST /ai/generate-demand/{case_id}` — fetch case + client + all medical summaries → Claude API (demand letter prompt) → store in `demand_letters` | `ai/main.py` | No |
| 2.5 | `POST /ai/intake-summary` — receives raw text → Claude API (intake summary prompt) → return structured JSON | `ai/main.py` | No |
| 2.6 | `GET /ai/analysis/{document_id}` — fetch stored analysis result for a document | `ai/main.py` | No |
| 2.7 | `GET /ai/demand/{case_id}` — fetch latest demand letter draft for a case | `ai/main.py` | No |

---

### Wave 3: Frontend — Hooks + Types
**Goal:** TypeScript types and TanStack Query hooks for all AI service endpoints.

**Depends on:** Wave 2 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add AI types: `AiAnalysis`, `AiClassification`, `DemandLetter`, `IntakeSummary` | `frontend/src/types/index.ts` | No |
| 3.2 | `useAiAnalysis.ts` — `useDocumentAnalysis(documentId)`, `useAnalyzeDocument()` mutation, `useClassifyDocument()` mutation | `frontend/src/hooks/useAiAnalysis.ts` | No |
| 3.3 | `useDemandLetter.ts` — `useDemandLetter(caseId)`, `useGenerateDemandLetter()` mutation, `useUpdateDemandLetter()` mutation (for editing) | `frontend/src/hooks/useDemandLetter.ts` | No |

---

### Wave 4: Frontend — Document AI UI
**Goal:** "Analyze" button on documents, AI summary cards on medical providers, auto-classification on upload.

**Depends on:** Wave 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Update `DocumentPanel` — add "Analyze" button per document, show analysis status badge (not-analyzed / analyzing / analyzed), auto-classify on upload | `frontend/src/components/DocumentPanel.tsx` | No |
| 4.2 | `MedicalAiSummary` component — compact card showing AI-extracted: injuries, diagnoses, treatment summary, extracted bill total. Shown below provider row when analysis exists | `frontend/src/components/MedicalAiSummary.tsx` | No |
| 4.3 | Update `MedicalProviderPanel` — show `MedicalAiSummary` card below each provider that has an analyzed document linked to it | `frontend/src/components/MedicalProviderPanel.tsx` | No |

---

### Wave 5: Frontend — Demand Letter + Intake Summary
**Goal:** Demand letter generation and display; intake summary on LeadDetail.

**Depends on:** Wave 3 complete (parallel with Wave 4)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | `DemandLetterPanel` component — shows: "Generate Demand Letter" button (or regenerate), editable textarea with draft, copy-to-clipboard button, character count, last-generated timestamp | `frontend/src/components/DemandLetterPanel.tsx` | No |
| 5.2 | Add "Demand" tab to `CaseDetail` — renders `DemandLetterPanel`; only visible when case status is `demand` or later | `frontend/src/pages/CaseDetail.tsx` | No |
| 5.3 | Add intake summary button to `LeadDetail` — "Generate Intake Summary" calls `/ai/intake-summary` with lead notes; shows structured result inline (injury description, liability, next steps, urgency badge) | `frontend/src/pages/LeadDetail.tsx` | No |

---

### Wave 6: Deploy + Migrate
**Goal:** Migration 003 applied, `ai` service live on 10.10.110.33, all endpoints reachable.

**Depends on:** Waves 1–5 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | Upload all Phase 3 files to server, run `003_document_ai.sql` migration, rebuild Docker stack with `ai` service | (server commands) | No |
| 6.2 | Smoke test: analyze a document, check AI analysis stored, verify demand letter endpoint returns text | (server + curl) | No |

---

## Success Criteria

- [ ] Medical record upload → AI extracts injuries, treatment, specials (stored in `ai_analyses`)
- [ ] Medical AI summary card visible per provider on case detail (when analysis exists)
- [ ] Demand letter draft generated from case facts + medical summaries
- [ ] Document auto-classification on upload (doc_type updated via AI)
- [ ] AI intake summary from lead notes/transcript (on LeadDetail)

---

## Technical Specifics

### New Service: `ai`
```
Container:      pilaweros-ai
Port (internal): 8002
Traefik route:  Host(APP_DOMAIN) && PathPrefix(/ai)
Middleware:     strip-ai (StripPrefix /ai)
Env vars:       ANTHROPIC_API_KEY, JWT_SECRET, DB_URI, FILES_DATA_DIR
Volume:         uploads-data:/data (read-only mount — reads uploaded files)
```

### Claude API
```python
# Model: claude-sonnet-4-6
# SDK: anthropic Python SDK
# Pattern: client.messages.create(model="claude-sonnet-4-6", max_tokens=2048, messages=[...])
# All prompts from reference/ai-prompts.md
# JSON responses: use json.loads() on content[0].text
```

### Text Extraction
```
PDF:   pdfminer.six — extract_text(BytesIO(file_bytes))
DOCX:  python-docx — Document(BytesIO(file_bytes)) → join paragraphs
JPG/PNG: base64 encode → send as image_url in Claude message (vision)
TXT:   decode as UTF-8 directly
Max chars sent to Claude: 8000 (truncate if longer)
```

### New DB Tables

```sql
-- ai_analyses: stores per-document AI extraction results
CREATE TABLE ai_analyses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  analysis     JSONB NOT NULL,          -- full Claude response JSON
  status       TEXT DEFAULT 'pending',  -- pending, processing, complete, error
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- demand_letters: stores generated demand letter drafts per case
CREATE TABLE demand_letters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id      UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  case_id      UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  content      TEXT NOT NULL,           -- full letter text, editable
  generated_at TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
```

### Service Names (Docker Compose)
```
pilaweros-postgres     (existing)
pilaweros-postgrest    (existing)
pilaweros-auth         (existing)
pilaweros-files        (existing)
pilaweros-ai           (NEW — Phase 3)
pilaweros-traefik      (existing)
pilaweros-frontend     (existing)
pilaweros-n8n          (existing)
pilaweros-neo4j        (existing)
```

### File Conventions
- New service: `ai/` directory (parallel to `files/`, `auth/`)
- New hooks: `frontend/src/hooks/use{Feature}.ts`
- New components: `frontend/src/components/{Name}.tsx`
- AI prompts: use exactly as written in `reference/ai-prompts.md` — no modification
- All AI endpoints require JWT (`Authorization: Bearer <token>`)

### Key Commands
```bash
# Apply migration on server
docker compose exec -T postgres psql -U postgres -d pilaweros < postgres/migrations/003_document_ai.sql

# Build and start ai service
docker compose build ai && docker compose up -d ai

# Test analyze endpoint
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"document_id":"<uuid>"}' http://10.10.110.33/ai/analyze-document

# Check ANTHROPIC_API_KEY is set
docker compose exec ai env | grep ANTHROPIC
```

### Environment Variable
`ANTHROPIC_API_KEY` must be added to `/opt/pi-lawyer-os/.env` on the server before deploying.

---

## Deferred (Out of Scope for Phase 3)

- pgvector embeddings — still deferred (document similarity search not needed yet)
- Batch document analysis (analyze all docs at once)
- AI-generated medical specials override (user reviews AI extraction but doesn't auto-update lien_amount)
- Email delivery of demand letter (Phase 5)
- AI in n8n workflows (intake summary from Twilio transcript — Phase 4)
- Document OCR for scanned PDFs (pdfminer extracts text-layer only; scanned PDFs return empty — acceptable for Phase 3)
- Streaming Claude responses (batch/synchronous API only for Phase 3)
