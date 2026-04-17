# Plan: CMMC Compliance OS — Full Platform Build

**Created:** 2026-04-15
**Status:** Complete — see ADDENDUM 2026-04-16
**Request:** Implement all application code for the CMMC Compliance OS platform. Infrastructure is already deployed and running on VM. Deadline: 2026-04-18.

---

## Overview

### What This Plan Accomplishes

Implements the full CMMC Compliance OS application code inside an already-deployed Docker Compose stack. The VM at 10.10.110.41 has all 8 services running as stubs. This plan fills in the real business logic: database schema + seed data, FastAPI backend (7 routers, 5 services), Next.js frontend (9 pages, 8+ components), 8 n8n workflows, and Hasura metadata.

### Why This Matters

Deadline is 2026-04-18. MVP must enable: onboard org → seed 110 controls → upload artifact → Claude assessment → live SPRS score → SSP/POA&M generation. First client (Canopy Aerospace) onboarding depends on this.

---

## Current State

### What's Already Deployed (VM: 10.10.110.41)

| Service | Container | Status | What Exists |
|---------|-----------|--------|-------------|
| PostgreSQL 16 + pgvector | cmmc-postgres | Running | Init script creates 4 DBs + extensions. **No app tables yet.** |
| Redis 7 | cmmc-redis | Running | Ready |
| Authentik 2024.12.3 | cmmc-authentik-server/worker | Running | **OIDC app NOT created yet** |
| FastAPI | cmmc-fastapi | Running | main.py + 7 stub routers (return placeholder JSON) + deps.py (JWT auth) |
| Hasura v2.42 | cmmc-hasura | Running | **No tables tracked, no metadata** |
| n8n | cmmc-n8n | Running | 2 stub workflows (webhook → respond, no logic) |
| Next.js 14 | cmmc-nextjs | Running | layout.tsx, MSP dashboard stub, org dashboard stub, next-auth route + auth.ts |
| MinIO (external) | 10.10.20.30:9000 | Running | 4 buckets created |
| Traefik (external) | 10.10.30.35 | Running | TLS + subdomain routing done |

### Key Infrastructure Details

- **Domain:** `*.cmmc4msp.on-nex.us` (app/api/gql/auth subdomains)
- **Stack root:** `/opt/stacks/cmmc4msp/`
- **SSH:** `ssh claude-controller` then `ssh -i /opt/claude-workspace/keys/claude-controller-key mrt@10.10.110.41`
- **MinIO:** External at `http://10.10.20.30:9000` (env vars: MINIO_SVC_KEY/MINIO_SVC_SECRET)
- **Hasura JWT:** HS256 with shared secret (hardcoded in docker-compose, switch to RS256/JWKS later)
- **SMTP:** Placeholder — stub with logging per user decision

### Gaps Being Addressed

1. **No database schema** — Tables, enums, triggers don't exist in cmmc_main
2. **No seed data** — 110 controls still only in Excel
3. **FastAPI routers are empty stubs** — No DB queries, no business logic, no models
4. **No FastAPI services** — No MinIO, SPRS calc, reports, extraction, n8n trigger
5. **Next.js pages are static HTML** — No data fetching, no GraphQL, no real components
6. **n8n workflows are webhook → respond only** — No assessment logic, no Postgres ops
7. **Hasura has no metadata** — No tables tracked, no permissions, no relationships

---

## Design Decisions

### Key Decisions Made

1. **Develop locally, deploy via SSH**: Write all code in this repo, then rsync/scp to VM. Docker rebuild on VM for image changes, restart for code changes (FastAPI mounts app dir).
2. **Seed Examine + Interview as proof guidance**: Per user decision — concatenate assessment consideration columns from Excel as `acceptable_proof_guidance`.
3. **Stub SMTP with logging**: Per user decision — log notification events instead of sending emails. Wire real SMTP later.
4. **Keep HS256 JWT for MVP**: Authentik OIDC not configured yet. FastAPI validates with shared JWT_SECRET. Upgrade to RS256/JWKS post-MVP.
5. **asyncpg direct queries (no ORM)**: Per spec. requirements.txt has SQLAlchemy but we won't use ORM — asyncpg pool with raw SQL. Remove SQLAlchemy/Alembic from deps.
6. **Hasura metadata via API**: Apply metadata through Hasura's metadata API rather than CLI (no Hasura CLI on VM).

### Open Questions

None — all 3 questions answered by user.

---

## Proposed Changes

### New Files to Create

#### Database (write locally, deploy to VM)

| File Path | Purpose |
|-----------|---------|
| `postgres/migrations/001_core_schema.sql` | All tables, enums, triggers, functions |
| `postgres/migrations/002_controls_seed.sql` | 110 control_definitions INSERT statements (generated) |
| `postgres/migrations/003_indexes.sql` | Performance indexes on all FK/query columns |
| `scripts/extract_controls.py` | Parse Excel → generate seed SQL |
| `scripts/deploy.sh` | Rsync code to VM + restart services |

#### FastAPI — New Files

| File Path | Purpose |
|-----------|---------|
| `fastapi/app/config.py` | Pydantic BaseSettings from env vars |
| `fastapi/app/database.py` | asyncpg connection pool (lifespan managed) |
| `fastapi/app/models.py` | All Pydantic v2 request/response schemas |
| `fastapi/app/services/__init__.py` | Package init |
| `fastapi/app/services/minio_service.py` | Presigned URL generation, file ops |
| `fastapi/app/services/sprs_service.py` | SPRS + FAR & Above score calculation |
| `fastapi/app/services/report_service.py` | ReportLab PDF generation (SSP + POA&M) |
| `fastapi/app/services/n8n_service.py` | HTTP triggers to n8n webhooks |
| `fastapi/app/services/extraction_service.py` | PDF/DOCX/image text extraction |

#### Next.js — New Files

| File Path | Purpose |
|-----------|---------|
| `nextjs/src/lib/apollo-client.ts` | Apollo Client setup (HTTP + WS links) |
| `nextjs/src/lib/apollo-provider.tsx` | Client-side ApolloProvider wrapper |
| `nextjs/src/lib/api.ts` | FastAPI REST client (upload, reports) |
| `nextjs/src/lib/types.ts` | TypeScript interfaces for all entities |
| `nextjs/src/lib/constants.ts` | Domain abbrevs, phase configs, score colors |
| `nextjs/src/components/SPRSGauge.tsx` | Animated SPRS score gauge (-203 to 110) |
| `nextjs/src/components/PhaseProgress.tsx` | Phase 1-5 bars with lock/unlock |
| `nextjs/src/components/DomainHeatmap.tsx` | 14-domain completion grid |
| `nextjs/src/components/ActivityFeed.tsx` | Real-time assessment results feed |
| `nextjs/src/components/TaskQueue.tsx` | Contributor task card list |
| `nextjs/src/components/ArtifactUploader.tsx` | Drag-drop file upload + progress |
| `nextjs/src/components/ControlStatusBadge.tsx` | Status enum colored badge |
| `nextjs/src/components/Navbar.tsx` | Top nav with org switcher + user menu |
| `nextjs/src/components/Sidebar.tsx` | Left nav for org context pages |
| `nextjs/src/graphql/queries.ts` | All GraphQL queries |
| `nextjs/src/graphql/mutations.ts` | All GraphQL mutations |
| `nextjs/src/graphql/subscriptions.ts` | Real-time subscriptions |
| `nextjs/src/app/onboard/page.tsx` | New client wizard (5-step form) |
| `nextjs/src/app/[orgSlug]/controls/page.tsx` | Controls list with filters |
| `nextjs/src/app/[orgSlug]/controls/[id]/page.tsx` | Control detail + artifact uploader |
| `nextjs/src/app/[orgSlug]/tasks/page.tsx` | Personal task queue |
| `nextjs/src/app/[orgSlug]/team/page.tsx` | Team/assignment management |
| `nextjs/src/app/[orgSlug]/poam/page.tsx` | POA&M viewer |
| `nextjs/src/app/[orgSlug]/reports/page.tsx` | Report generation + download |
| `nextjs/src/app/[orgSlug]/layout.tsx` | Org layout with Sidebar |
| `nextjs/src/app/globals.css` | Tailwind base styles |
| `nextjs/postcss.config.js` | PostCSS config for Tailwind |

#### n8n Workflows — New/Replace

| File Path | Purpose |
|-----------|---------|
| `n8n/workflows/01_onboard_client.json` | Full onboarding: seed 110 controls, mark N/A, calc baseline |
| `n8n/workflows/02_artifact_submitted.json` | Full Claude assessment pipeline |
| `n8n/workflows/03_sprs_recalculate.json` | SPRS + FAR score recalc |
| `n8n/workflows/04_phase_unlock_check.json` | Phase gate check + unlock |
| `n8n/workflows/05_poam_reminders.json` | Daily POA&M deadline digest |
| `n8n/workflows/06_weekly_digest.json` | Monday MSP admin summary |
| `n8n/workflows/07_hung_assessment_guard.json` | 15-min cron reset stuck assessments |
| `n8n/workflows/08_report_generator.json` | Trigger PDF generation via FastAPI |

#### Hasura Metadata

| File Path | Purpose |
|-----------|---------|
| `hasura/metadata/tables.yaml` | All table tracking + relationships + permissions |
| `hasura/metadata/actions.yaml` | Custom actions (generateReport, recalcSPRS) |
| `scripts/apply_hasura_metadata.sh` | Apply metadata via Hasura metadata API |

### Files to Modify (existing stubs on VM)

| File Path | Changes |
|-----------|---------|
| `fastapi/app/routers/orgs.py` | Replace stub with full CRUD + n8n onboard trigger |
| `fastapi/app/routers/programs.py` | Replace stub with full CRUD + SSP fields |
| `fastapi/app/routers/controls.py` | Replace stub with filtered list + status update |
| `fastapi/app/routers/artifacts.py` | Replace stub with presigned upload + extract + status |
| `fastapi/app/routers/assessments.py` | Replace stub with list/get + MSP override |
| `fastapi/app/routers/reports.py` | Replace stub with SSP/POA&M PDF generation |
| `fastapi/app/routers/webhooks.py` | Replace stub with assessment-complete + onboard-complete callbacks |
| `fastapi/app/deps.py` | Add role-checking dependencies (require_msp_admin, etc.) |
| `fastapi/main.py` | Add lifespan for DB pool + MinIO init, CORS origin |
| `fastapi/requirements.txt` | Add pdfplumber, python-docx, reportlab, structlog; remove alembic, sqlalchemy |
| `nextjs/src/app/page.tsx` | Replace static HTML with GraphQL-powered MSP dashboard |
| `nextjs/src/app/layout.tsx` | Add SessionProvider, ApolloProvider, globals.css import, Navbar |
| `nextjs/src/app/[orgSlug]/dashboard/page.tsx` | Replace static with SPRSGauge, PhaseProgress, DomainHeatmap, ActivityFeed |
| `nextjs/src/lib/auth.ts` | Add JWT callback to pass org_id/role claims through session |
| `nextjs/package.json` | Add recharts, @heroicons/react, clsx |

---

## Step-by-Step Tasks

### Phase 1: Database + Seed (Steps 1-2) — Sequential, then parallel

---

### Step 1: Extract Control Seed Data from Excel

Write and run a Python script to parse `files/CMMC Dashboard.xlsx` and generate the seed SQL.

**Actions:**

- Create `scripts/extract_controls.py`:
  - Read sheet "SSP - DoD SPRS & FAR and Above" (rows 3+, headers in row 2)
  - Parent controls: rows where column H (DoD Score Value) is a positive integer
  - Sub-objectives: rows where NIST ID contains `[` (e.g., `3.13.1[a]`)
  - Generate deterministic UUIDs using `uuid5(NAMESPACE_DNS, nist_id)` so FK references work
  - For parent controls: map all columns (phase, sort_order, diy_type, family, nist_id, cmmc_id, dod_score_value, requirement_text, assessment_objective, dod_comment)
  - For sub-objectives: link to parent via `parent_control_id` UUID
  - Read sheet "Potential Assessment Consid." — join by NIST ID to get Examine + Interview columns → concatenate as `acceptable_proof_guidance`
  - Determine `is_basic` from FAR & Above phase (Phase 1 basic safeguarding controls)
  - Output `postgres/migrations/002_controls_seed.sql` with properly escaped INSERT statements
- Run the script: `python scripts/extract_controls.py`
- Verify output: should have ~109 parent controls + ~297 sub-objectives

**Files affected:**
- `scripts/extract_controls.py` (new)
- `postgres/migrations/002_controls_seed.sql` (generated)

---

### Step 2: Database Schema + Indexes

Create the full schema DDL and performance indexes.

**Actions:**

- Create `postgres/migrations/001_core_schema.sql`:
  - **ENUM types:** `org_status` (active/inactive/suspended), `user_role` (msp_admin/client_admin/contributor/viewer), `program_status` (scoping/in_progress/assessment_ready/certified), `control_status` (not_yet_assessed/not_yet_addressed/implementation_planned/implementation_begun/fully_implemented/not_applicable), `assignment_status` (unassigned/assigned/submitted/in_review/accepted/rejected), `artifact_status` (pending/processing/assessed/failed), `assessment_verdict` (pass/partial/fail/not_applicable), `far_above_phase` (enum '1'-'5'), `diy_type` (diy/outsource/hybrid), `resource_estimate` (funded/unfunded/reallocated)
  - **Tables (in FK-safe order):** control_definitions, orgs, users, programs, program_controls, assignments, artifacts, assessments, milestones, program_members, program_locations, hardware_inventory, software_inventory, cloud_services_inventory, activity_log, control_dependencies
  - **Common columns:** `id UUID DEFAULT uuid_generate_v4() PRIMARY KEY`, `created_at TIMESTAMPTZ DEFAULT NOW()`, `updated_at TIMESTAMPTZ DEFAULT NOW()`
  - **`updated_at` trigger function:** Create `set_updated_at()` function, apply to all mutable tables
  - **SPRS notify trigger:** `notify_sprs_recalc()` function that calls `pg_notify('sprs_recalc', ...)` on `program_controls` status change
  - **Cascade rules:** ON DELETE CASCADE from parent to child (org→programs→program_controls→artifacts→assessments)
  - **programs table SSP fields:** system_name, cage_codes TEXT[], topology_narrative, topology_diagram_url, ssp_system_description, ssp_environment_of_operation, ssp_information_types, ssp_security_requirements, ssp_interconnections, ssp_authoring_date, ssp_last_review_date

- Create `postgres/migrations/003_indexes.sql`:
  - FK indexes: users.org_id, programs.org_id, program_controls.program_id, program_controls.control_definition_id, assignments.program_control_id, assignments.assigned_to, artifacts.program_control_id, artifacts.assignment_id, assessments.artifact_id, milestones.program_control_id
  - Query indexes: program_controls(program_id, status), program_controls(program_id, is_phase_unlocked), orgs(slug), control_definitions(nist_id), control_definitions(far_above_phase), activity_log(org_id, created_at DESC)

**Files affected:**
- `postgres/migrations/001_core_schema.sql` (new)
- `postgres/migrations/003_indexes.sql` (new)

---

### Phase 2: Backend + Frontend + n8n (Steps 3-5) — Fully parallel

After Phase 1, schema and seed SQL exist. These three workstreams have no dependencies on each other — they can be built simultaneously by separate agents.

---

### Step 3: FastAPI Backend — Full Implementation

Implement all business logic in the FastAPI application.

**Actions:**

**3a. Core infrastructure files:**

- `fastapi/app/config.py`:
  - `class Settings(BaseSettings)` with all env vars: POSTGRES_HOST/PORT/USER/PASSWORD/DB, REDIS_URL, MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/SECURE, AUTHENTIK_URL, JWT_SECRET, N8N_INTERNAL_URL, APP_URL
  - `model_config = SettingsConfigDict(env_file=".env")`

- `fastapi/app/database.py`:
  - `create_pool()` → asyncpg.create_pool with DSN from Settings
  - `get_db()` dependency → acquire connection from pool
  - Pool created in app lifespan, stored on `app.state.pool`

- `fastapi/app/models.py` — All Pydantic v2 schemas:
  - Request models: OrgCreate, ProgramCreate, ProgramUpdate, AssignmentCreate, AssignmentUpdate, ControlStatusUpdate, ArtifactUploadResponse, AssessmentOverride, WebhookPayload
  - Response models: Org, Program, ProgramControl, ControlDefinition, Assignment, Artifact, Assessment, Milestone, SPRSScore
  - Common: PaginatedResponse[T], ErrorResponse

- Update `fastapi/app/deps.py`:
  - Keep existing `get_current_user`
  - Add `require_msp_admin(user=Depends(get_current_user))` — raises 403 if not msp_admin
  - Add `require_client_admin_or_above(user=Depends(get_current_user))` — allows msp_admin or client_admin
  - Add `require_same_org(org_id, user)` — verifies user belongs to the org or is MSP staff

- Update `fastapi/main.py`:
  - Add lifespan context manager: create asyncpg pool on startup, close on shutdown
  - Init MinIO client on startup
  - Set CORS origins to `[settings.APP_URL]` instead of `*`

- Update `fastapi/requirements.txt`:
  - ADD: pdfplumber, python-docx, reportlab, structlog, Pillow
  - REMOVE: sqlalchemy[asyncio], alembic (not using ORM)

**3b. Services:**

- `fastapi/app/services/minio_service.py`:
  - `get_presigned_upload_url(bucket, key, expires=3600)` → presigned PUT URL
  - `get_presigned_download_url(bucket, key, expires=3600)` → presigned GET URL
  - `upload_file(bucket, key, data, content_type)` → direct upload from server
  - `download_file(bucket, key)` → bytes
  - Bucket names: `cmmc-artifacts`, `cmmc-reports`
  - Object key format: `{org_id}/{program_id}/{control_id}/{filename}`

- `fastapi/app/services/sprs_service.py`:
  - `calculate_sprs(program_id, conn)`:
    - Query all program_controls with status + dod_score_value (JOIN control_definitions)
    - Start at 110
    - For each control where status != 'fully_implemented' AND is_applicable = TRUE: subtract dod_score_value
    - **CRITICAL:** Check control 3.12.4 — if not fully_implemented, return -203
    - Update programs.sprs_score
  - `calculate_far_above(program_id, conn)`:
    - Query controls grouped by phase
    - Phase scoring as per Excel formula
    - Update programs.far_above_score

- `fastapi/app/services/report_service.py`:
  - `generate_ssp_pdf(program_id, conn)`:
    - Query program + all controls + SSP preamble fields
    - ReportLab: cover page, table of contents, system description, environment, control implementation statements (110 rows), topology, personnel
    - Upload to MinIO `cmmc-reports/{org_id}/{program_id}/SSP_{date}.pdf`
    - Return presigned download URL
  - `generate_poam_pdf(program_id, conn)`:
    - Query non-passing controls with milestones
    - ReportLab: POA&M table (control ID, description, status, responsible party, milestone date, resources)
    - Upload to MinIO, return URL

- `fastapi/app/services/n8n_service.py`:
  - `trigger_onboard(org_id, program_id, scoping_config)` → POST `http://n8n:5678/webhook/onboard-client`
  - `trigger_assessment(artifact_id, program_control_id)` → POST `http://n8n:5678/webhook/artifact-submitted`
  - `trigger_report(program_id, report_type)` → POST `http://n8n:5678/webhook/report-generator`

- `fastapi/app/services/extraction_service.py`:
  - `extract_text(file_bytes, mime_type, filename)`:
    - `application/pdf` → pdfplumber, extract all pages, return concatenated text
    - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` → python-docx paragraphs
    - `image/*` → return `"[Image: {filename}]"` (Claude vision handled in n8n)
    - Return `{"extracted_text": str, "page_count": int}`

**3c. Routers (replace all stubs):**

- `orgs.py`:
  - `GET /` → list all orgs (msp_admin: all, others: own org only)
  - `GET /{org_id}` → get org by ID or slug
  - `POST /` → create org (msp_admin only) + trigger n8n onboard
  - `PATCH /{org_id}` → update org details

- `programs.py`:
  - `GET /` → list programs (filtered by org_id from query param or JWT)
  - `GET /{program_id}` → get program with SPRS score, phase, SSP fields
  - `POST /` → create program for org
  - `PATCH /{program_id}` → update SSP preamble fields, status

- `controls.py`:
  - `GET /definitions` → list all 110 control_definitions (public, cached)
  - `GET /program/{program_id}` → list program_controls with filters (phase, family, status)
  - `GET /program/{program_id}/{control_id}` → single control detail with artifacts + assessments
  - `PATCH /program/{program_id}/{control_id}` → update status, implementation_notes, is_applicable

- `artifacts.py`:
  - `POST /{program_control_id}/upload` → generate presigned URL, create artifact record (status: pending), trigger n8n
  - `GET /{artifact_id}` → get artifact with assessment result
  - `GET /{artifact_id}/status` → check assessment status
  - `POST /{artifact_id}/extract` → extract text from file (called by n8n, webhook-secret auth)

- `assessments.py`:
  - `GET /` → list assessments for a program control
  - `GET /{assessment_id}` → get assessment detail
  - `POST /{assessment_id}/override` → MSP admin override verdict + notes

- `reports.py`:
  - `POST /{program_id}/ssp` → generate SSP PDF, return download URL
  - `POST /{program_id}/poam` → generate POA&M PDF, return download URL
  - `GET /{program_id}/downloads` → list generated reports

- `webhooks.py`:
  - `POST /n8n/assessment-complete` → update artifact status, control status based on verdict, trigger SPRS recalc, log activity
  - `POST /n8n/onboard-complete` → update org/program status, log activity
  - Auth: validate shared webhook secret header, not JWT

**Files affected:**
- All files under `fastapi/app/`

---

### Step 4: Next.js Frontend — Full Implementation

Build all pages and components with real data fetching.

**Actions:**

**4a. Infrastructure + lib files:**

- Add to `nextjs/package.json` devDependencies: `@heroicons/react`, `clsx`, `recharts`

- `nextjs/src/app/globals.css`:
  - Tailwind directives: `@tailwind base; @tailwind components; @tailwind utilities;`

- `nextjs/postcss.config.js` (if missing)

- `nextjs/src/lib/types.ts`:
  - Interfaces: Org, Program, ControlDefinition, ProgramControl, Assignment, Artifact, Assessment, Milestone, User
  - Enums as union types: OrgStatus, UserRole, ProgramStatus, ControlStatus, AssignmentStatus, etc.

- `nextjs/src/lib/constants.ts`:
  - `DOMAIN_ABBREVS`: Record of 14 domain abbreviations to full names
  - `PHASE_CONFIG`: Phase labels, control counts, point values
  - `SPRS_COLORS`: Score range → color mapping (red <0, amber 0-70, green 70-110)
  - `CONTROL_STATUS_COLORS`: Status → badge color mapping

- `nextjs/src/lib/apollo-client.ts`:
  - Create httpLink pointing to `NEXT_PUBLIC_HASURA_URL/v1/graphql`
  - Create wsLink using `graphql-ws` for subscriptions
  - Split link: subscriptions → WS, everything else → HTTP
  - Auth: inject Bearer token from session into headers

- `nextjs/src/lib/apollo-provider.tsx`:
  - `"use client"` component wrapping `ApolloProvider` with the client instance

- `nextjs/src/lib/api.ts`:
  - `uploadArtifact(programControlId, file)`: POST to FastAPI, get presigned URL, PUT file to MinIO
  - `generateReport(programId, type: 'ssp'|'poam')`: POST to FastAPI, return download URL
  - `fetchWithAuth(url, options)`: Add session token to fetch requests

- Update `nextjs/src/lib/auth.ts`:
  - Add `callbacks.jwt`: merge org_id, role, is_msp_staff from provider token into JWT
  - Add `callbacks.session`: expose org_id, role, is_msp_staff on session.user

- `nextjs/src/graphql/queries.ts`:
  - `GET_ORGS`: all orgs with program count, latest SPRS score
  - `GET_ORG_BY_SLUG`: org details with programs
  - `GET_PROGRAM_DASHBOARD`: program with sprs_score, far_above_score, current_phase, control stats
  - `GET_PROGRAM_CONTROLS`: paginated controls with filters
  - `GET_CONTROL_DETAIL`: single control with artifacts + assessments
  - `GET_ASSIGNMENTS`: assignments for program or user
  - `GET_POAM`: non-passing controls with milestones

- `nextjs/src/graphql/mutations.ts`:
  - `CREATE_ORG`, `UPDATE_ORG`
  - `UPDATE_CONTROL_STATUS`, `UPDATE_CONTROL_NOTES`
  - `CREATE_ASSIGNMENT`, `UPDATE_ASSIGNMENT`
  - `OVERRIDE_ASSESSMENT`

- `nextjs/src/graphql/subscriptions.ts`:
  - `SUBSCRIBE_PROGRAM_DASHBOARD`: live SPRS score, phase, control counts
  - `SUBSCRIBE_ACTIVITY_FEED`: real-time assessment results + status changes

**4b. Components:**

- `Navbar.tsx`: Logo, org switcher dropdown (msp_admin sees all orgs), user avatar + role badge, logout button. Sticky top.
- `Sidebar.tsx`: Vertical nav for org context — Dashboard, Controls, Tasks, Team, POA&M, Reports. Highlight active route. Show org name + SPRS score summary.
- `SPRSGauge.tsx`: SVG semi-circular gauge. Range -203 to 110. Color gradient red→amber→green. Animated on load. Show numeric score centered. Show target (110) as reference mark.
- `PhaseProgress.tsx`: 5 horizontal progress bars. Each shows phase number, name, control count, completion %. Locked phases show lock icon. Current phase highlighted. Completed phases show checkmark.
- `DomainHeatmap.tsx`: 14-cell grid (7x2 or responsive). Each cell: domain abbreviation, % complete, color intensity proportional to completion. Tooltip with full domain name + counts.
- `ActivityFeed.tsx`: Scrollable list of recent events. Each item: timestamp, event type icon, description (e.g., "Control 3.5.3 passed assessment — confidence 0.92"). Uses Hasura subscription for real-time updates.
- `TaskQueue.tsx`: Card list for contributors. Each card: control ID, family, requirement summary, due date, status badge, upload button. Sorted by due date. Filter by status.
- `ArtifactUploader.tsx`: Drag-and-drop zone with file type hints (PDF, DOCX, PNG). Progress bar during upload. Shows presigned URL flow: client → MinIO direct. After upload: shows processing spinner → assessment result.
- `ControlStatusBadge.tsx`: Colored pill component. Maps control_status enum → color + label. Compact size for table rows, larger for detail views.

**4c. Pages:**

- Update `nextjs/src/app/layout.tsx`:
  - Import globals.css
  - Wrap children with SessionProvider + ApolloProvider
  - Add Navbar at top
  - Set Tailwind body classes

- Update `nextjs/src/app/page.tsx` (MSP Dashboard):
  - Query all orgs with program summaries via GraphQL
  - Table: org name, SPRS score, phase, status, open tasks, last activity
  - "Onboard New Client" button → /onboard
  - Summary cards: total orgs, avg SPRS, pending assessments
  - MSP admin only (redirect viewers to their org dashboard)

- `nextjs/src/app/onboard/page.tsx`:
  - Multi-step wizard (client-side state):
    1. Org details: name, CAGE code, primary contact name/email/phone
    2. System scoping: system name, # users, CUI types, locations
    3. N/A controls: checkboxes for common exclusions (no wireless, no mobile, etc.)
    4. Team setup: invite emails with role assignment
    5. Review + submit → POST to FastAPI /api/orgs
  - Progress indicator showing current step
  - MSP admin only

- `nextjs/src/app/[orgSlug]/layout.tsx`:
  - Sidebar + main content area
  - Fetch org by slug, pass to children via context or props

- Update `nextjs/src/app/[orgSlug]/dashboard/page.tsx`:
  - SPRSGauge (live subscription)
  - PhaseProgress (5 phases with completion)
  - DomainHeatmap (14 domains)
  - ActivityFeed (real-time)
  - Quick stats: controls complete, open tasks, pending assessments

- `nextjs/src/app/[orgSlug]/controls/page.tsx`:
  - Table of 110 controls with columns: NIST ID, CMMC ID, Family, Requirement (truncated), Phase, Status badge
  - Filters: phase dropdown, family dropdown, status dropdown
  - Search by NIST ID or requirement text
  - Click row → control detail page

- `nextjs/src/app/[orgSlug]/controls/[id]/page.tsx`:
  - Full control detail: requirement text, assessment objective, proof guidance
  - Status update dropdown (admin/client_admin)
  - Implementation notes textarea
  - Artifact section: list of uploaded artifacts with assessment results
  - ArtifactUploader component for new uploads
  - Assessment detail: verdict, confidence, rationale, gaps
  - MSP override button (msp_admin only)

- `nextjs/src/app/[orgSlug]/tasks/page.tsx`:
  - TaskQueue component showing assigned controls
  - Filter by status (assigned/submitted/accepted/rejected)
  - Each task links to control detail page

- `nextjs/src/app/[orgSlug]/team/page.tsx`:
  - Team member table: name, email, role, assigned controls count
  - Assignment management: assign control to user, set due date, add instructions
  - Bulk assignment capability

- `nextjs/src/app/[orgSlug]/poam/page.tsx`:
  - Table of non-passing controls with milestone data
  - Columns: NIST ID, requirement, status, responsible org, milestone date, resources, remediation plan
  - Export POA&M button → triggers PDF generation
  - Editable fields: milestone date, responsible org, remediation plan

- `nextjs/src/app/[orgSlug]/reports/page.tsx`:
  - Two cards: Generate SSP, Generate POA&M
  - Each shows last generated date, download link
  - Generate button triggers FastAPI → shows loading → returns download link
  - List of previously generated reports

- `nextjs/src/app/auth/callback/page.tsx` (already exists as route.ts — no change needed)

**Files affected:**
- All files under `nextjs/src/`
- `nextjs/package.json`

---

### Step 5: n8n Workflows — Full Implementation

Build all 8 workflow JSON files with complete business logic.

**Actions:**

- **Workflow 1: `01_onboard_client.json`**
  - Webhook POST trigger (path: `onboard-client`)
  - Postgres: SELECT all from control_definitions
  - Function: build INSERT array for program_controls (110 rows), apply N/A from scoping_config
  - Postgres: bulk INSERT program_controls
  - Postgres: UPDATE programs SET current_phase = '1'
  - Function: log event to activity_log
  - HTTP POST: FastAPI `/api/webhooks/n8n/onboard-complete`
  - Respond to webhook with success

- **Workflow 2: `02_artifact_submitted.json`** (replace stub)
  - Webhook POST trigger (path: `artifact-submitted`)
  - Postgres: UPDATE artifacts SET assessment_status = 'processing', assessment_attempts += 1
  - HTTP GET: download file from MinIO (using presigned URL from payload)
  - HTTP POST: FastAPI `/api/artifacts/{id}/extract` → get extracted_text
  - Postgres: SELECT control_definition (requirement_text, assessment_objective, acceptable_proof_guidance) for this control
  - Function: build Claude assessment prompt (spec Section 7 format)
  - HTTP POST: Anthropic API (`claude-sonnet-4-5`, max_tokens 2000, JSON response)
  - Function: parse JSON response (verdict, confidence, rationale, gaps)
  - Postgres: INSERT into assessments
  - Postgres: UPDATE artifacts SET assessment_status = 'assessed', extracted_text = ...
  - IF verdict = 'pass': Postgres UPDATE program_controls SET status = 'fully_implemented'
  - IF verdict = 'partial': Postgres UPDATE program_controls SET status = 'implementation_begun'
  - Function: log to activity_log
  - HTTP POST: FastAPI `/api/webhooks/n8n/assessment-complete`
  - Respond to webhook with assessment result
  - Error handler: SET artifacts.assessment_status = 'failed', log error

- **Workflow 3: `03_sprs_recalculate.json`**
  - Webhook POST trigger (path: `sprs-recalculate`)
  - Postgres: SELECT program_controls + control_definitions for program_id
  - Function: SPRS formula (110 - sum of unimplemented scores, 3.12.4 gate → -203)
  - Function: FAR & Above score by phase
  - Postgres: UPDATE programs SET sprs_score, far_above_score
  - Execute sub-workflow: workflow 4 (phase unlock check)
  - Respond with scores

- **Workflow 4: `04_phase_unlock_check.json`**
  - Sub-workflow trigger (or webhook)
  - Postgres: SELECT current_phase from programs
  - Postgres: SELECT COUNT where status != 'fully_implemented' AND far_above_phase = current_phase AND is_applicable = TRUE
  - IF count = 0: Postgres UPDATE program_controls SET is_phase_unlocked = TRUE WHERE far_above_phase = next_phase
  - Postgres: UPDATE programs SET current_phase = next_phase
  - Function: log phase unlock to activity_log

- **Workflow 5: `05_poam_reminders.json`**
  - Cron trigger: 08:00 UTC daily
  - Postgres: SELECT milestones WHERE current_milestone_date <= NOW() + 7 days AND is_complete = FALSE, JOIN programs, orgs
  - IF results: Group by org, log reminder event (SMTP stubbed)

- **Workflow 6: `06_weekly_digest.json`**
  - Cron trigger: Monday 07:00 UTC
  - Postgres: SELECT programs with sprs_score, current_phase, control stats
  - Function: build summary object per org
  - Log digest event (SMTP stubbed)

- **Workflow 7: `07_hung_assessment_guard.json`** (replace stub concept)
  - Cron trigger: every 15 minutes
  - Postgres: SELECT artifacts WHERE assessment_status = 'processing' AND last_attempted_at < NOW() - INTERVAL '10 minutes'
  - For each: Postgres UPDATE SET assessment_status = 'pending'
  - Postgres: SELECT artifacts WHERE assessment_status = 'failed' AND assessment_attempts < 3
  - For each: HTTP POST trigger workflow 2 webhook

- **Workflow 8: `08_report_generator.json`**
  - Webhook POST trigger (path: `report-generator`)
  - HTTP POST: FastAPI report endpoint (SSP or POA&M based on payload.report_type)
  - Respond with download URL

**Files affected:**
- All files under `n8n/workflows/`

---

### Phase 3: Integration (Steps 6-7) — Sequential

---

### Step 6: Hasura Metadata

Track all tables, define relationships, set up role-based permissions.

**Actions:**

- Create metadata YAML or apply via Hasura metadata API:
  - Track all tables: control_definitions, orgs, users, programs, program_controls, assignments, artifacts, assessments, milestones, program_members, program_locations, hardware_inventory, software_inventory, cloud_services_inventory, activity_log
  - Object relationships: program_controls.control_definition_id → control_definitions, program_controls.program_id → programs, programs.org_id → orgs, artifacts.program_control_id → program_controls, assessments.artifact_id → artifacts, assignments.assigned_to → users, etc.
  - Array relationships: orgs → programs, programs → program_controls, program_controls → artifacts, artifacts → assessments, etc.
  - Permissions:
    - `msp_admin`: SELECT/INSERT/UPDATE/DELETE all tables, no row filter
    - `client_admin`: SELECT/INSERT/UPDATE own org (filter: `org_id = X-Hasura-Org-Id`), DELETE only artifacts
    - `contributor`: SELECT own org, INSERT artifacts, UPDATE own assignments
    - `viewer`: SELECT own org only
  - Role claim: `X-Hasura-Role` from JWT, `X-Hasura-Org-Id` for row filtering

- Create `scripts/apply_hasura_metadata.sh`:
  - Use `curl` to Hasura metadata API endpoint
  - Track tables, add relationships, set permissions via `pg_track_table`, `pg_create_object_relationship`, `pg_create_insert_permission`, etc.

**Files affected:**
- `hasura/metadata/tables.yaml`
- `scripts/apply_hasura_metadata.sh`

---

### Step 7: Deploy + Verify

Deploy all code to VM and run end-to-end verification.

**Actions:**

- Create `scripts/deploy.sh`:
  - Rsync `postgres/migrations/` to VM
  - Rsync `fastapi/` to VM
  - Rsync `nextjs/` to VM (excluding node_modules, .next)
  - Rsync `n8n/workflows/` to VM
  - SSH: run SQL migrations (`psql -f 001..., 002..., 003...`)
  - SSH: `docker compose up -d --build fastapi nextjs` (rebuild images)
  - SSH: apply Hasura metadata
  - SSH: import n8n workflows via API

- Verify:
  - FastAPI /health returns 200
  - `psql` shows all tables + 110 control_definitions
  - FastAPI `/api/controls/definitions` returns 110 controls
  - Hasura console shows all tables with permissions
  - Next.js loads at app.cmmc4msp.on-nex.us
  - n8n shows 8 workflows

**Files affected:**
- `scripts/deploy.sh`

---

## Execution Strategy — Parallelization Map

```
TIME →

Step 1 (Seed extract)  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
Step 2 (Schema+Index)  ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░
                           ↓ Phase 1 done
Step 3 (FastAPI)           ████████████████░░░░░░░░░░░░░░
Step 4 (Next.js)           ████████████████░░░░░░░░░░░░░░
Step 5 (n8n)               ████████████████░░░░░░░░░░░░░░
                                           ↓ Phase 2 done
Step 6 (Hasura)                            ████████░░░░░░
Step 7 (Deploy+Verify)                             ██████
```

**Agent delegation for `/implement`:**

| Step | Agent | Rationale |
|------|-------|-----------|
| 1 | engineer | Python script + SQL generation |
| 2 | engineer | SQL DDL authoring |
| 3 | engineer | Full FastAPI implementation |
| 4 | engineer | Full Next.js implementation |
| 5 | n8n-workflow-builder | n8n JSON workflow expertise |
| 6 | engineer | Hasura metadata API calls |
| 7 | engineer | Deploy script + verification |

Steps 1+2 parallel → Steps 3+4+5 parallel → Step 6 → Step 7.

---

## Validation Checklist

- [ ] `001_core_schema.sql` creates all tables + enums + triggers without errors
- [ ] `002_controls_seed.sql` inserts 109 parent controls + sub-objectives
- [ ] SPRS calculation: empty program = -203 (3.12.4 gate rule)
- [ ] SPRS calculation: all controls fully_implemented = 110
- [ ] FastAPI starts with no import errors
- [ ] All FastAPI routes return proper responses (not stub JSON)
- [ ] FastAPI JWT auth rejects invalid tokens with 401
- [ ] Next.js builds without TypeScript errors (`npm run build`)
- [ ] All 9 pages render without crashes
- [ ] GraphQL queries return data from Hasura
- [ ] All 8 n8n workflows are valid JSON with correct node types
- [ ] Workflow 2 (artifact-submitted) has correct Claude prompt format
- [ ] Hasura permissions: client_admin cannot see other orgs' data
- [ ] MinIO presigned URLs work for upload and download
- [ ] No hardcoded secrets — all from env vars
- [ ] Deploy script successfully updates all services on VM

---

## Success Criteria

1. SQL migrations run cleanly — all tables created, 110 controls seeded
2. FastAPI serves 12+ endpoints with JWT auth and real DB queries
3. Next.js renders 9 pages with GraphQL data from Hasura
4. n8n has 8 importable workflows covering full lifecycle
5. Hasura enforces row-level permissions by org_id per role
6. SPRS score calculation matches DoD methodology
7. End-to-end flow works: onboard → upload → assess → score updates → dashboard reflects
8. All services running on VM at cmmc4msp.on-nex.us

---

## Notes

- **Authentik OIDC is manual**: Creating the OIDC app, groups, and flows requires Authentik admin UI. Document steps but don't automate. Until configured, auth bypasses or test JWTs needed for development.
- **SMTP stubbed**: Notification workflows (5, 6) log events instead of sending email. Wire real SMTP post-MVP.
- **109 vs 110 controls**: Excel has 109 parent controls with scores. Seed what exists, document the discrepancy.
- **No automated tests this sprint**: 3-day deadline prioritizes working code. Tests are next sprint.
- **Hasura JWT_SECRET is hardcoded in docker-compose**: This is the HS256 shared secret. After Authentik OIDC is configured, switch to RS256 with JWKS endpoint. For MVP, HS256 works and FastAPI uses the same secret.
- **Report PDF quality**: ReportLab generates functional PDFs, not design-polished. Sufficient for C3PAO review.
- **MinIO is external**: Not in docker-compose. Already running on TrueNAS at 10.10.20.30:9000 with buckets created. FastAPI uses env vars MINIO_ENDPOINT/MINIO_SVC_KEY/MINIO_SVC_SECRET.

---

## ADDENDUM 2026-04-16 — Extension: Assignments, Invites, Authentik Provisioning

**Added in overnight session following MVP deployment.**

### New Database Migrations

| Migration | File | What It Adds |
|-----------|------|-------------|
| 010 | `postgres/migrations/010_assignments_state_machine.sql` | `in_progress`/`reassigned` enum values; `submitted_at`, `reviewed_at`, `reviewer_id`, `review_note` columns on `assignments`; new `assignment_events` audit table |
| 011 | `postgres/migrations/011_team_invites.sql` | `invites` table with `token_hash VARCHAR(64) UNIQUE`, 72h TTL, `accepted_at` |

### New FastAPI Routers

| Router | File | Endpoints |
|--------|------|-----------|
| assignments | `fastapi/app/routers/assignments.py` | `POST /api/assignments/bulk` (bulk assign), `POST /api/assignments/{id}/transition` (state machine), `GET /api/assignments/{id}` |
| invites | `fastapi/app/routers/invites.py` | `POST /api/invites` (create + n8n fire), `GET /api/invites/{token}/validate`, `POST /api/invites/{token}/accept` (Authentik provision + local user), `GET /api/invites` (list) |

### New Services

| Service | File | Purpose |
|---------|------|---------|
| authentik_service | `fastapi/app/services/authentik_service.py` | Creates Authentik users via REST API v3 with password set; username-collision retry; raises `AuthentikError` on failure (including password set) with best-effort rollback |

### New n8n Workflows

| Workflow | File | Trigger Path |
|----------|------|-------------|
| 09 — Assignment Notifications | `n8n/workflows/09_assignment_notifications.json` | `POST /webhook/{id}/webhook/assignment-status-changed` |
| 10 — User Invite | `n8n/workflows/10_user_invite.json` | `POST /webhook/{id}/webhook/user-invite` |

### New Frontend Pages

| Page | Path | Purpose |
|------|------|---------|
| Invite Accept | `nextjs/src/app/invite/[token]/page.tsx` | Public page — validates token, shows org/role/expiry card, form to create account |

### Env Vars Added

| Variable | Where | Purpose |
|----------|-------|---------|
| `AUTHENTIK_URL` | `.env`, `docker-compose.yml` | Authentik API base URL |
| `AUTHENTIK_API_TOKEN` | `.env`, `docker-compose.yml` | Authentik API token (identifier: `fastapi-svc`) |
| `OPENROUTER_API_KEY` | `docker-compose.yml` | Passed to FastAPI for embeddings (Phase C) |
| `N8N_WF_*` | `docker-compose.yml` | n8n workflow ID overrides (default to seeded UUIDs) |

### Security Fix

Removed `NEXT_PUBLIC_HASURA_ADMIN_SECRET` from docker-compose.yml build args and environment — was exposing Hasura admin secret to browser bundles. Apollo client now uses JWT Bearer token exclusively.

### Status

All items verified deployed and healthy on VM `10.10.110.41` as of 2026-04-16.

**See `outputs/session-report-2026-04-16.md` for full test suite metrics and RAG feature details.**
