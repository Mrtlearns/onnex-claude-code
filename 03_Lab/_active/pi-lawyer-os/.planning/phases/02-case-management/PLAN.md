# Phase 2 — Case Management Core: Plan

**Created:** 2026-03-16
**Status:** Ready
**Milestone:** v1.1

---

## Scope

Extends the deployed Phase 1 platform with full case lifecycle management. A signed lead becomes a case, linked to a client record, with SOL tracking, medical records, tasks/deadlines, and document upload. Adds a `files` upload service to the Docker Compose stack for document storage. Delivers a complete case detail view with tabbed panels.

---

## Waves

### Wave 1: Database Schema Migration
**Goal:** All new tables live in Postgres with RLS, indexed, and ready for PostgREST.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Write migration SQL — clients, cases, medical_providers, tasks, documents tables | `postgres/migrations/002_case_management.sql` | No |
| 1.2 | Write migration runner script (applies migration idempotently via psql) | `scripts/migrate.sh` | No |

**New tables:**
- `clients` — personal/contact/insurance info (separate entity from lead)
- `cases` — case number, case type, date of loss, SOL date, status lifecycle, assigned attorney
- `medical_providers` — per-case provider list, request status, lien amounts
- `tasks` — tasks/deadlines linked to case, due date, type, assignee, status
- `documents` — file metadata (name, path, type) linked to case

---

### Wave 2: File Upload Service
**Goal:** FastAPI `/files` service for document upload/download. Stores to a mounted volume.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Create files service — FastAPI with `POST /files/upload` (multipart), `GET /files/{id}` | `files/main.py`, `files/requirements.txt`, `files/Dockerfile` | No |
| 2.2 | Wire files service into Docker Compose with Traefik route `/files` and shared volume | `docker-compose.yml` | No |

**Upload endpoint contract:**
- `POST /files/upload` — multipart form: `file` (binary), `case_id`, `doc_type`, `name`
- Stores file to `/data/{firm_id}/{case_id}/{uuid}.{ext}`
- Inserts row into `documents` table via direct DB connection
- Returns `{ id, file_path, name, doc_type, created_at }`
- `GET /files/{document_id}` — streams file back (JWT required, firm_id check)

---

### Wave 3: TypeScript Types + Hooks
**Goal:** All new entity types defined; TanStack Query hooks for CRUD on all new tables.

**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Add TypeScript types for Case, Client, MedicalProvider, Task, Document | `frontend/src/types/index.ts` | No |
| 3.2 | `useCases` hook — list (with filters: status, attorney, sol_warning), create, update | `frontend/src/hooks/useCases.ts` | No |
| 3.3 | `useCase` hook — single case by ID with related data | `frontend/src/hooks/useCase.ts` | No |
| 3.4 | `useClients` hook — list + create + update | `frontend/src/hooks/useClients.ts` | No |
| 3.5 | `useMedicalProviders` hook — list by case, create, update | `frontend/src/hooks/useMedicalProviders.ts` | No |
| 3.6 | `useTasks` hook — list (with filters: case_id, assigned_to, due_date), create, update | `frontend/src/hooks/useTasks.ts` | No |
| 3.7 | `useDocuments` hook — list by case, upload (calls /files/upload), delete | `frontend/src/hooks/useDocuments.ts` | No |

---

### Wave 4: Cases List + Case Create Form
**Goal:** Cases page with filters and "New Case" dialog. CaseCreateForm pre-populates from a signed lead.

**Depends on:** Wave 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Cases page — list with columns (case #, client, type, status, SOL date, attorney), status filter tabs, SOL warning badges | `frontend/src/pages/Cases.tsx` | No |
| 4.2 | CaseCreateForm — form for new case creation, accepts optional `leadId` prop to pre-populate from lead data | `frontend/src/components/CaseCreateForm.tsx` | No |
| 4.3 | "Convert to Case" button on LeadDetail — only shown for `status=signed` leads; opens CaseCreateForm pre-filled | `frontend/src/pages/LeadDetail.tsx` | No |
| 4.4 | Add Cases route to App.tsx + Sidebar nav link | `frontend/src/App.tsx`, `frontend/src/components/layout/Sidebar.tsx` | No |

---

### Wave 5: Case Detail — Core + Medical + Tasks
**Goal:** Full case detail page with tabbed panels. Three tabs in parallel.

**Depends on:** Wave 4 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | CaseDetail page — tabbed layout (Overview, Medical, Tasks, Documents, Timeline), case header with SOL badge, status changer | `frontend/src/pages/CaseDetail.tsx` | No |
| 5.2 | CaseDetail Overview tab — client info card, case facts card, assigned attorney, date of loss, description | (within CaseDetail.tsx) | No |
| 5.3 | CaseDetail Medical tab — provider list with request status chips, lien amounts, specials total, add/edit provider form | `frontend/src/components/MedicalProviderPanel.tsx` | No |
| 5.4 | CaseDetail Tasks tab — task list sorted by due date, overdue highlighting, add task form, complete/edit actions | `frontend/src/components/TaskPanel.tsx` | No |

---

### Wave 6: Case Detail — Documents + SOL Dashboard Widget
**Goal:** Document upload tab and SOL warning on main dashboard.

**Depends on:** Wave 5 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | CaseDetail Documents tab — file list with type badges, download link, drag-and-drop upload with doc_type selector | `frontend/src/components/DocumentPanel.tsx` | No |
| 6.2 | SOL alert widget on Dashboard — table of cases with SOL ≤ 90 days, sorted by urgency, color-coded (red <30, amber <60, yellow <90) | `frontend/src/pages/Dashboard.tsx`, `frontend/src/hooks/useSolAlerts.ts` | No |
| 6.3 | Tasks widget on Dashboard — today's overdue + due-today tasks across all cases | (within Dashboard.tsx) | No |

---

### Wave 7: n8n SOL Alert Workflow
**Goal:** Automated SOL alerts to assigned attorney at 90/60/30 day thresholds.

**Depends on:** Wave 1 complete (runs in parallel with Waves 3–6)

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 7.1 | SOL alert workflow — cron daily, query cases with SOL in 90/60/30 days, send SMS to assigned attorney via Twilio | `n8n/workflows/sol-alert.json` | Yes (n8n-workflow-builder) |

---

### Wave 8: Deploy + Migrate
**Goal:** Schema migrated on 10.10.110.33, files service running, stack verified.

**Depends on:** Waves 1–7 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 8.1 | Run migration 002 on server, rebuild/restart stack with files service | (server commands) | No |
| 8.2 | Smoke test: create case from signed lead, add medical provider, upload document, verify SOL badge | (manual) | No |

---

## Success Criteria

- [ ] Case create from signed lead (auto-populated from lead data)
- [ ] Case list + detail with full tabbed UI
- [ ] SOL date stored and displayed with 90/60/30 day warning badges
- [ ] Dashboard: cases with SOL < 90 days highlighted
- [ ] Medical records tracker — provider list, request status, lien amounts, specials total
- [ ] Task CRUD — title, due date, assignee, type, status
- [ ] Dashboard: today's overdue + upcoming tasks widget
- [ ] Document upload — PDF/DOCX/image, doc type tagging, case linkage
- [ ] Document download via `/files/{id}` (JWT protected)
- [ ] "Convert to Case" on LeadDetail (signed leads only)
- [ ] n8n SOL alert workflow written (Twilio activation = client onboarding)

---

## Technical Specifics

### Service Names (Docker Compose)
```
pilaweros-postgres     postgres:15 (existing)
pilaweros-postgrest    postgrest/postgrest (existing)
pilaweros-auth         pi-lawyer-os-auth (existing)
pilaweros-files        pi-lawyer-os-files (NEW)
pilaweros-traefik      traefik:v3 (existing)
pilaweros-frontend     pi-lawyer-os-frontend (existing)
pilaweros-n8n          n8nio/n8n (existing)
pilaweros-neo4j        neo4j:5 (existing)
```

### Files Service
- Traefik route: `Host(APP_DOMAIN) && PathPrefix(/files)`
- Internal port: 8001
- Volume: `uploads-data:/data` (host path: `/opt/pi-lawyer-os/uploads`)
- JWT validation: same secret as auth service (`JWT_SECRET` env var)
- Max upload size: 50MB
- Allowed types: `.pdf`, `.docx`, `.doc`, `.jpg`, `.jpeg`, `.png`

### Case Status Lifecycle
```
intake → investigation → demand → negotiation → settlement → litigation → closed
```

### SOL Warning Thresholds
- Red badge: `sol_date <= now() + 30 days`
- Amber badge: `sol_date <= now() + 60 days`
- Yellow badge: `sol_date <= now() + 90 days`

### Database Migration Pattern
```bash
# Apply migration on server
docker compose exec -T postgres psql -U postgres -d pilaweros -f /docker-entrypoint-initdb.d/002_case_management.sql
```
Copy migration file into container via SFTP before running.

### File Conventions
- New pages: `frontend/src/pages/{Name}.tsx`
- New hooks: `frontend/src/hooks/use{Entity}.ts` — follows Phase 1 pattern (useLeads, useLead)
- Panel components (tabs): `frontend/src/components/{Name}Panel.tsx`
- Form components: `frontend/src/components/{Name}Form.tsx`
- PostgREST queries use `?select=`, `?order=`, `?firm_id=eq.{id}` pattern via `apiGet`

### PostgREST RLS note
All new tables need `firm_id` column, `ENABLE ROW LEVEL SECURITY`, and a policy using `current_firm_id()`. Pattern from `postgres/init.sql`.

### Key Case Number Format
`{YEAR}-{FIRM_SLUG}-{SEQUENCE}` — e.g., `2026-DEMO-001`
Generate with a Postgres sequence per firm, or simple UUID prefix for Phase 2.

---

## Deferred (Out of Scope for Phase 2)

- AI document processing (Phase 3) — no Claude API calls yet
- Document OCR or text extraction
- Client portal (Phase 6)
- Settlement offer/counter tracking (Phase 5)
- Disbursement calculator (Phase 5)
- Referral tracking and partner networks (Phase 4)
- Graph DB (Neo4j) usage — tables only, no graph queries yet
- Email notifications (SMS only via existing Twilio setup)
- Bulk document download / ZIP export
- Case number auto-generation sequence — use simple manual input for Phase 2
