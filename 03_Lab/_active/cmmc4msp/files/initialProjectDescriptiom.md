# CMMC Compliance OS — Project Intelligence Document

**For:** Claude Code  
**Project Codename:** `cmmc-compliance-os`  
**Owner:** Mr. T — Onnex AI Agency, Las Vegas NV  
**Stack:** Next.js 14 · FastAPI · PostgreSQL · Hasura · n8n · MinIO · Authentik · Traefik  
**Deployment:** Single Ubuntu 24.04 LTS VM · Docker Compose  

---

## 1. WHAT THIS PROJECT IS

CMMC Compliance OS is a **multi-tenant SaaS compliance management platform** built specifically for Managed Service Providers (MSPs) to onboard their clients and guide them through achieving **CMMC Level 2 certification** — the U.S. Department of Defense's Cybersecurity Maturity Model Certification framework, which maps 1:1 to **NIST SP 800-171 Rev 2** (110 security controls across 14 domains).

The platform replaces a manual Excel-based process (the CMMC Information Institute's open-source self-assessment spreadsheet) with a structured, sequenced, AI-assisted workflow that:

- Onboards a new client org and seeds all 110 controls automatically
- Assigns evidence collection tasks to members of the client's team
- Accepts artifact uploads (PDFs, screenshots, config exports, policy docs)
- Uses **Claude LLM** to assess uploaded artifacts against acceptable proof criteria
- Marks controls as complete when artifacts pass assessment
- Maintains a live SPRS score (DoD's scoring system, starts at 110, loses points per unimplemented control)
- Generates SSP (System Security Plan) and POA&M (Plan of Action & Milestones) documents
- Provides an MSP-level dashboard showing progress across all client organizations

---

## 2. BUSINESS CONTEXT

### Who Uses This

**MSP Admins (Onnex staff):**
- Onboard new client organizations
- Define system scope and CUI boundary
- Create team assignments
- Review Claude assessments and override if needed
- Monitor all clients from a single dashboard

**Client Admins (client's IT lead / CISO):**
- Manage their org's compliance program
- Assign controls to team members
- Review progress and reports
- Export SSP and POA&M for C3PAO assessors

**Client Contributors (client's technical staff):**
- Receive task assignments for specific controls
- Upload evidence artifacts
- View assessment results and gap guidance
- See their personal task queue

**Client Viewers:**
- Read-only access to dashboards and reports

### Why It Exists

~80,000 U.S. defense contractors must achieve CMMC Level 2 certification or lose DoD contract eligibility. Existing tools (Drata, Vanta, RegScale) are expensive, not CMMC-specific, or not MSP-native. This platform is purpose-built for the MSP delivery model with Claude-powered artifact assessment as the core differentiator.

### The Core Compliance Artifact

The platform is seeded from the **CMMC Information Institute's NIST SP 800-171 self-assessment spreadsheet** — a well-established open-source tool used by DoD contractors. All 110 controls, their DoD score values, FAR & Above phase ordering, and acceptable proof guidance are derived from this source and stored in the `control_definitions` table.

---

## 3. TECHNICAL ARCHITECTURE

### Infrastructure

```
Single VM: Ubuntu 24.04 LTS
CPU: 8-16 vCores
RAM: 32-64GB
Disk: 500GB-1TB SSD
Network: Port 80/443 only exposed
Stack: Docker Compose (all services containerized)
Ingress: Traefik v3 with Cloudflare DNS challenge TLS
```

### Service Map

```
INTERNET
    │
    ▼
TRAEFIK (443/80)
    ├── app.domain      → Next.js :3000
    ├── api.domain      → FastAPI :8000
    ├── gql.domain      → Hasura :8080
    └── auth.domain     → Authentik :9000

INTERNAL ONLY (never exposed):
    ├── PostgreSQL :5432
    ├── Redis :6379
    ├── MinIO :9000/:9001
    └── n8n :5678

EXTERNAL APIs:
    └── Anthropic API (Claude assessment calls from n8n)
```

### Docker Networks

```
traefik-public   → Traefik + Next.js + FastAPI + Hasura + Authentik
cmmc-internal    → All services (Postgres, Redis, MinIO, n8n internal only)
```

### Project Root

```
/opt/cmmc/
├── docker-compose.yml
├── .env
├── traefik/
├── postgres/
│   ├── init/
│   └── migrations/
├── fastapi/
├── nextjs/
├── hasura/
├── n8n/
│   └── workflows/
└── minio/
```

---

## 4. DATABASE SCHEMA

**Database:** PostgreSQL 16 with pgvector, uuid-ossp, pgcrypto extensions  
**Primary DB:** `cmmc_main`  
**Other DBs:** `n8n_db`, `authentik_db`, `hasura_meta`

### Core Tables

#### `control_definitions` (seeded, read-only)
The master list of all 110 NIST SP 800-171 Rev 2 controls. Seeded once at provisioning. Never modified by the application.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| nist_id | VARCHAR | e.g. "3.1.1" |
| nist_sort_order | VARCHAR | e.g. "03.01.01.0" |
| cmmc_id | VARCHAR | e.g. "AC.L1-3.1.1" |
| family | VARCHAR | e.g. "Access Control" |
| family_abbrev | VARCHAR | e.g. "AC" |
| far_above_phase | ENUM(1-5) | FAR & Above implementation phase |
| far_above_sort_order | VARCHAR | Ordering within phase |
| diy_type | ENUM | DIY / Outsource / Hybrid |
| is_objective | BOOLEAN | True for sub-objectives like 3.1.1[a] |
| parent_control_id | UUID FK | Links sub-objectives to parent |
| dod_score_value | INTEGER | Points lost if not implemented (1, 3, or 5) |
| requirement_text | TEXT | Full control requirement |
| assessment_objective | TEXT | What the assessor determines |
| dod_comment | TEXT | DoD assessor notes |
| acceptable_proof_guidance | TEXT | Used in Claude assessment prompts |
| is_basic | BOOLEAN | FAR basic safeguarding controls |

#### `orgs`
MSP client organizations.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| name | VARCHAR | Organization name |
| slug | VARCHAR UNIQUE | URL-safe identifier |
| status | ENUM | active / inactive / suspended |
| cage_code | VARCHAR | DoD CAGE code |
| primary_contact_* | VARCHAR | CIO/CISO contact info |

#### `users`
All users — both MSP staff and client team members.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| authentik_id | VARCHAR UNIQUE | Linked to Authentik IdP |
| email | VARCHAR UNIQUE | |
| role | ENUM | msp_admin / client_admin / contributor / viewer |
| org_id | UUID FK | null for MSP staff |
| is_msp_staff | BOOLEAN | |

#### `programs`
One per system/SSP per org. Contains all SSP Preamble fields.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| org_id | UUID FK | |
| name | VARCHAR | e.g. "Canopy Primary CUI System" |
| status | ENUM | scoping / in_progress / assessment_ready / certified |
| system_name | VARCHAR | SSP system name |
| cage_codes | TEXT[] | |
| sprs_score | INTEGER | Auto-calculated. Starts -203, target 110 |
| far_above_score | INTEGER | Auto-calculated. Target 500 |
| current_phase | ENUM(1-5) | Current FAR & Above phase |
| topology_narrative | TEXT | SSP system topology description |
| topology_diagram_url | TEXT | Link to network diagram |
| ssp_* | Various | All SSP Preamble required fields |

#### `program_controls`
Instantiated per program from `control_definitions`. 110 rows created per program on onboarding.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| program_id | UUID FK | |
| control_definition_id | UUID FK | |
| status | ENUM | not_yet_assessed / not_yet_addressed / implementation_planned / implementation_begun / fully_implemented / not_applicable |
| is_applicable | BOOLEAN | False if control is N/A (e.g. no wireless) |
| is_phase_unlocked | BOOLEAN | Controls unlock sequentially by phase |
| implementation_notes | TEXT | How the control is implemented |
| score_impact | INTEGER | Negative value representing SPRS point loss |
| target_completion_date | DATE | For POA&M |

**CRITICAL SCORING RULE:** Control 3.12.4 (SSP) has special handling. If not `fully_implemented`, the SPRS score is forced to -203 regardless of all other controls. This mirrors the real DoD assessment methodology.

#### `assignments`
Links a `program_control` to a `user` for evidence collection.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| program_control_id | UUID FK | |
| program_id | UUID FK | |
| assigned_to | UUID FK → users | |
| assigned_by | UUID FK → users | |
| status | ENUM | unassigned / assigned / submitted / in_review / accepted / rejected |
| due_date | DATE | |
| instructions | TEXT | MSP guidance for this specific control |

#### `artifacts`
Evidence files uploaded by contributors.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| program_control_id | UUID FK | |
| assignment_id | UUID FK | |
| uploaded_by | UUID FK → users | |
| file_name | VARCHAR | Original filename |
| mime_type | VARCHAR | |
| minio_bucket | VARCHAR | Always "cmmc-artifacts" |
| minio_key | VARCHAR | Path within bucket |
| extracted_text | TEXT | Text extracted for Claude |
| assessment_status | ENUM | pending / processing / assessed / failed |
| assessment_attempts | INTEGER | For retry logic, max 3 |
| last_attempted_at | TIMESTAMPTZ | For hung detection |

#### `assessments`
Claude LLM assessment result per artifact.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| artifact_id | UUID FK | |
| program_control_id | UUID FK | |
| verdict | ENUM | pass / partial / fail / not_applicable |
| confidence | DECIMAL(4,3) | 0.0 to 1.0 |
| rationale | TEXT | Claude's explanation |
| gaps | JSONB | Array of identified gaps |
| raw_response | JSONB | Full Claude API response |
| model_used | VARCHAR | claude-sonnet-4-5 |
| reviewer_override | BOOLEAN | MSP reviewer can override Claude |
| reviewer_notes | TEXT | Override justification |

#### `milestones`
POA&M entries — auto-generated for non-passing controls.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID PK | |
| program_control_id | UUID FK | |
| program_id | UUID FK | |
| responsible_org | VARCHAR | |
| resource_estimate | VARCHAR | Funded / Unfunded / Reallocated |
| remediation_plan | TEXT | |
| current_milestone_date | DATE | |
| is_complete | BOOLEAN | |

#### Supporting Tables
- `program_members` — users authorized for a program
- `program_locations` — physical locations per program (4 sites for a typical client)
- `hardware_inventory` — per program
- `software_inventory` — per program
- `cloud_services_inventory` — per program
- `activity_log` — audit trail of all actions
- `control_dependencies` — FAR & Above phase gate relationships

### Key Database Behaviors

**SPRS Auto-Recalculate Trigger:**
```sql
-- When any program_control status changes, pg_notify fires
-- n8n listens and calls FastAPI /api/sprs/{program_id}/recalculate
CREATE TRIGGER program_control_status_changed
AFTER UPDATE ON program_controls
FOR EACH ROW EXECUTE FUNCTION notify_sprs_recalc();
```

**SPRS Score Formula:**
```
Start: 110
For each control where status != 'fully_implemented' AND is_applicable = TRUE:
  score -= dod_score_value (1, 3, or 5)
Special: If 3.12.4 not fully_implemented → score = -203 (override everything)
Range: -203 to 110
```

**FAR & Above Score Formula:**
```
Phases 1-5, point values: 37, 32, 34, 37, 47 (total 187... wait, max 500)
Phases only count if ALL prior phases are complete
Range: 0 to 500
```

---

## 5. SERVICE DETAILS

### FastAPI (Python 3.12)

**Purpose:** Core application API. Business logic, file handling, SPRS calculation, report generation, n8n trigger calls.

**Port:** 8000 (internal), proxied by Traefik as `api.domain`

**Key Routes:**
```
GET  /health                                    → Health check
POST /api/orgs                                  → Create org (triggers n8n onboard)
GET  /api/orgs/{org_id}/programs               → List programs
POST /api/programs                              → Create program
POST /api/artifacts/{program_control_id}/upload → Upload artifact (triggers n8n assessment)
GET  /api/artifacts/{artifact_id}/status        → Check assessment status
POST /api/artifacts/{artifact_id}/extract       → Extract text from file (called by n8n)
POST /api/sprs/{program_id}/recalculate         → Recalculate SPRS score
POST /api/reports/{program_id}/ssp              → Generate SSP PDF
POST /api/reports/{program_id}/poam             → Generate POA&M PDF
POST /api/webhooks/n8n/assessment-complete      → Callback from n8n when done
POST /api/webhooks/n8n/onboard-complete         → Callback from n8n after seeding
```

**Auth:** Validates Authentik JWT on every request. Extracts `org_id`, `role`, `user_id` from token claims.

**Key Services:**
- `minio_service.py` — Presigned URL generation, file upload/download
- `sprs_service.py` — SPRS and FAR & Above score calculation
- `report_service.py` — ReportLab PDF generation for SSP and POA&M
- `n8n_service.py` — HTTP calls to trigger n8n webhooks

**File Extraction Logic** (called by n8n workflow):
```python
# PDF: pdfplumber extracts text
# Images: Claude vision API describes content
# DOCX: python-docx extracts text
# Returns: {"extracted_text": "...", "page_count": N}
```

---

### Hasura (GraphQL Engine v2.40)

**Purpose:** GraphQL API layer over PostgreSQL. Powers the Next.js frontend. Real-time subscriptions for live dashboard updates.

**Port:** 8080 (internal), proxied as `gql.domain`

**Auth Mode:** JWT — validates Authentik-issued JWTs. Row-level permissions enforced by `org_id` from JWT claims.

**Permission Levels:**
- `msp_admin` → Full access all orgs and programs
- `client_admin` → Full CRUD on own org only
- `contributor` → Read own org + insert artifacts/assignments
- `viewer` → Read-only own org

**Key Subscriptions (real-time):**
```graphql
subscription ProgramDashboard($orgSlug: String!) {
  programs(where: {org: {slug: {_eq: $orgSlug}}}) {
    sprs_score far_above_score current_phase
    program_controls { status control_definition { family_abbrev } }
    assignments_aggregate { aggregate { count } }
  }
}
```

**Remote Schema Actions:** Complex operations (generateReport, triggerAssessment, recalculateSPRS) are exposed as Hasura Actions backed by FastAPI.

---

### n8n (Workflow Automation)

**Purpose:** All async business logic. Replaces Temporal. Human-paced compliance workflows don't need durable execution — Postgres is the source of truth for all state.

**Port:** 5678 (INTERNAL ONLY — never exposed to internet, accessible via Tailscale/VPN only)

**Mode:** Queue mode with Redis backend

**Reliability Pattern:**
All workflow state is persisted in Postgres (`artifacts.assessment_status`), not in n8n internal state. If n8n crashes mid-workflow, the hung assessment guard cron resets stuck records and retries.

**The 8 Workflows:**

#### Workflow 1: `onboard-client`
**Trigger:** Webhook POST from FastAPI when new org is created  
**Steps:**
1. Receive `{org_id, program_id, scoping_config}`
2. Query all 110 `control_definitions` from Postgres
3. Bulk insert 110 `program_controls` for this program
4. Apply N/A markings from scoping config (no wireless → 3.1.16, 3.1.17 = N/A)
5. Calculate baseline SPRS score (-203 if SSP not done)
6. Create default assignments based on roles provided
7. Send welcome emails to client team via SMTP
8. Callback FastAPI `/api/webhooks/n8n/onboard-complete`

#### Workflow 2: `artifact-submitted` ⭐ CORE WORKFLOW
**Trigger:** Webhook POST from FastAPI when artifact uploaded  
**Steps:**
1. Set `artifacts.assessment_status = 'processing'`, increment `assessment_attempts`
2. Download file from MinIO
3. POST to FastAPI `/api/artifacts/{id}/extract` to get text content
4. Query `control_definitions` for this control's `requirement_text`, `assessment_objective`, `acceptable_proof_guidance`
5. Build Claude assessment prompt (see Section 7)
6. POST to Anthropic API (`claude-sonnet-4-5`, max_tokens: 2000)
7. Parse JSON verdict response
8. INSERT into `assessments` table
9. Set `artifacts.assessment_status = 'assessed'`
10. UPDATE `program_controls.status` if verdict = pass → `fully_implemented`
11. Trigger SPRS recalculate
12. Check phase completion → unlock next phase if all controls pass
13. Notify assignee via email with result
14. Callback FastAPI `/api/webhooks/n8n/assessment-complete`

#### Workflow 3: `sprs-recalculate`
**Trigger:** Called by workflow 2 after control status update  
**Steps:**
1. Query all program_controls with status and dod_score_value
2. Run SPRS formula (110 - sum of unimplemented control values)
3. Apply SSP penalty if 3.12.4 not passing
4. Calculate FAR & Above score by phase
5. UPDATE `programs.sprs_score` and `programs.far_above_score`

#### Workflow 4: `phase-unlock-check`
**Trigger:** Called by workflow 3  
**Steps:**
1. Query all controls in current phase
2. If all passing → UPDATE `program_controls.is_phase_unlocked = TRUE` for next phase controls
3. UPDATE `programs.current_phase`
4. Notify MSP admin of phase completion

#### Workflow 5: `poam-reminders`
**Trigger:** Cron 08:00 daily  
**Steps:**
1. Query `milestones` where `current_milestone_date <= NOW() + 7 days` AND `is_complete = FALSE`
2. Group by `org_id`
3. Send digest email to MSP admin + client admin per org

#### Workflow 6: `weekly-digest`
**Trigger:** Cron Monday 07:00  
**Steps:**
1. Query all active programs with SPRS score, phase, open tasks
2. Build progress summary per org
3. Email MSP admin with multi-client summary

#### Workflow 7: `hung-assessment-guard`
**Trigger:** Cron every 15 minutes  
**Steps:**
1. Reset artifacts stuck in `processing` > 10 min → set to `pending`
2. Query `failed` artifacts where `assessment_attempts < 3`
3. Re-trigger workflow 2 for each

#### Workflow 8: `report-generator`
**Trigger:** Webhook POST from FastAPI `/api/reports`  
**Steps:**
1. Query full program state (all controls, SSP preamble, POA&M items)
2. POST structured data to FastAPI report renderer
3. FastAPI generates PDF with ReportLab
4. Upload PDF to MinIO `cmmc-reports` bucket
5. Return presigned download URL to caller

---

### Authentik (Identity Provider)

**Purpose:** SSO, user management, JWT issuance, invitation flows.

**Port:** 9000 (proxied as `auth.domain`)

**OIDC Application:** `cmmc-app`

**JWT Claims Structure:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "org_id": "org-uuid",
  "role": "client_admin",
  "is_msp_staff": false
}
```

**Groups:**
- `msp_admin` — Onnex staff
- `client_admin` — Client org admins
- `contributor` — Client evidence collectors
- `viewer` — Read-only stakeholders

**Invitation Flow:** MSP admin creates user → Authentik sends invite email → User sets password → JWT issued on login.

---

### MinIO (S3-Compatible Blob Storage)

**Purpose:** All artifact file storage and report storage.

**Port:** 9000 API (internal), 9001 console (internal/VPN only)

**Buckets:**
```
cmmc-artifacts  → Evidence uploaded by contributors (PDF, PNG, DOCX, XLSX)
cmmc-reports    → Generated SSP and POA&M PDFs
cmmc-backups    → Daily Postgres dumps
cmmc-exports    → Client-downloadable compliance packages
```

**Access Pattern:**
- FastAPI generates **presigned upload URLs** → client browser uploads directly to MinIO
- FastAPI generates **presigned download URLs** → client browser downloads directly
- n8n downloads files directly using S3 node for text extraction
- All buckets: `anonymous = none` (no public access)

---

### Next.js 14 (Frontend)

**Purpose:** Full application UI. App Router. TypeScript. Tailwind CSS.

**Port:** 3000 (proxied as `app.domain`)

**Auth:** next-auth with Authentik OIDC provider. JWT stored in httpOnly cookie.

**Data Layer:**
- Apollo Client with Hasura GraphQL for queries/mutations
- Hasura WebSocket subscriptions for live dashboard updates
- Direct FastAPI REST calls for file uploads and report generation

**Key Pages:**

```
/                           → MSP dashboard (all clients overview)
/onboard                    → New client wizard (5-step)
/[orgSlug]/dashboard        → Client compliance dashboard
/[orgSlug]/controls         → 110 controls list with filters
/[orgSlug]/controls/[id]    → Control detail with artifact uploader
/[orgSlug]/tasks            → Personal task queue
/[orgSlug]/team             → Assignment management
/[orgSlug]/poam             → POA&M viewer and export
/[orgSlug]/reports          → SSP + POA&M PDF generation
/auth/callback              → Authentik OIDC callback
```

**Dashboard Components:**
- `SPRSGauge` — Animated gauge showing score -203 to 110, color-coded (red/amber/green)
- `PhaseProgress` — Phase 1-5 completion status with lock/unlock indicators
- `DomainHeatmap` — 14-domain grid showing % complete per domain (AC, AT, AU, CM, IA, IR, MA, MP, PE, PS, RA, CA, SC, SI)
- `ActivityFeed` — Real-time stream of assessment results and completions
- `TaskQueue` — Personal evidence submission queue for contributors

---

### Redis

**Purpose:** n8n queue mode backend, Authentik session cache, FastAPI cache layer.

**Port:** 6379 (internal only)

**Databases:**
- DB 0 → n8n queue
- DB 1 → Authentik sessions
- DB 2 → FastAPI cache (SPRS score cache, control list cache)

---

### Traefik v3

**Purpose:** Reverse proxy, TLS termination, subdomain routing.

**TLS:** Cloudflare DNS challenge (wildcard cert for `*.domain`)

**Routes:**
```
app.domain   → nextjs:3000
api.domain   → fastapi:8000
gql.domain   → hasura:8080
auth.domain  → authentik-server:9000
```

**Security Middlewares:** Secure headers, HTTPS redirect, rate limiting.

---

## 6. THE CMMC CONTROL FRAMEWORK

### What "CMMC Level 2" Means

- 110 security practices from NIST SP 800-171 Rev 2
- Organized into 14 domains (families)
- Must be assessed by a C3PAO (certified third-party assessor) or self-attested
- Results submitted to SPRS (Supplier Performance Risk System) — DoD's database
- Score range: -203 to 110 (higher is better, 110 = fully compliant)

### The 14 Domains

| Abbrev | Full Name | Controls |
|--------|-----------|----------|
| AC | Access Control | 22 |
| AT | Awareness & Training | 3 |
| AU | Audit & Accountability | 9 |
| CM | Configuration Management | 9 |
| IA | Identification & Authentication | 11 |
| IR | Incident Response | 3 |
| MA | Maintenance | 6 |
| MP | Media Protection | 9 |
| PE | Physical Protection | 6 |
| PS | Personnel Security | 2 |
| RA | Risk Assessment | 3 |
| CA | Security Assessment | 4 |
| SC | System & Communications Protection | 16 |
| SI | System & Information Integrity | 7 |

### FAR & Above Phased Implementation

Controls are implemented in 5 phases. **Phase N+1 is locked until Phase N is complete.** This is the primary sequencing mechanism.

| Phase | Controls | Points | Focus |
|-------|----------|--------|-------|
| 1 | 17 | 37 | Boundary protection, physical, basic identity, AV, patching |
| 2 | 23 | 32 | SSP, MFA, training, risk assessment, maintenance |
| 3 | 22 | 34 | Remote access, crypto, incident response, audit basics |
| 4 | 23 | 37 | Full audit logging, configuration management, media |
| 5 | 25 | 47 | Advanced network controls, personnel security, CUI flow |

**Critical Control:** 3.12.4 (SSP) is in Phase 2 but acts as a global gate. Without a completed SSP, SPRS = -203 regardless of all other controls. This is by design per the DoD Assessment Methodology.

### DoD Score Values

Controls are weighted 1, 3, or 5 points:
- **5 points** — High-impact controls (boundary protection, MFA, AV, SSP-related)
- **3 points** — Medium-impact (risk assessment, maintenance, some media)
- **1 point** — Lower-impact (session lock, logging failures, physical access logs)

---

## 7. CLAUDE ASSESSMENT SYSTEM

### Assessment Flow

```
Contributor uploads file
    → FastAPI stores in MinIO
    → FastAPI creates artifact record (status: pending)
    → FastAPI POSTs to n8n webhook
        → n8n downloads file
        → n8n calls FastAPI /extract endpoint
        → FastAPI extracts text (pdfplumber / Claude vision for images)
        → n8n builds assessment prompt
        → n8n calls Anthropic API
        → Claude returns JSON verdict
        → n8n saves assessment to Postgres
        → n8n updates control status
        → n8n triggers SPRS recalculate
        → n8n notifies contributor via email
```

### Assessment Prompt Structure

```
SYSTEM: You are a CMMC Level 2 compliance assessor with expertise in NIST SP 
800-171 Rev 2. Assess whether submitted evidence artifacts satisfy the given 
security control requirement. Be precise, objective, and thorough. Always 
respond with valid JSON only.

USER:
CONTROL ID: {cmmc_id}

CONTROL REQUIREMENT: {requirement_text}

ASSESSMENT OBJECTIVE: {assessment_objective}

ACCEPTABLE PROOF CRITERIA:
{acceptable_proof_guidance}

SUBMITTED ARTIFACT CONTENT:
{extracted_text}

Assess whether this artifact satisfies the control requirement. Respond ONLY 
with this JSON structure, no other text:
{
  "verdict": "pass|partial|fail",
  "confidence": 0.0-1.0,
  "rationale": "detailed explanation of why this artifact does or does not satisfy the control",
  "gaps": ["specific gap 1", "specific gap 2"]
}
```

### Verdict Definitions

| Verdict | Meaning | Control Status |
|---------|---------|----------------|
| `pass` | Artifact fully satisfies the control | → `fully_implemented` |
| `partial` | Artifact partially satisfies, gaps identified | → `implementation_begun` |
| `fail` | Artifact does not satisfy the control | Status unchanged |

### MSP Override

MSP admins can override Claude's verdict. When overriding:
- `assessments.reviewer_override = TRUE`
- `assessments.reviewer_notes` captures justification
- Control status updated manually
- Activity log records the override with user and timestamp

### Acceptable Proof Examples

For **3.5.3 (MFA):**
> MFA enforcement policy; Conditional Access policy exports showing MFA required for all users; Okta/Entra MFA enrollment report showing 100% coverage; privileged account list with MFA status confirmed; sample MFA prompt screenshots.

For **3.12.4 (SSP):**
> Completed System Security Plan document covering all required sections: system boundary description, environment of operation, CUI types handled, implementation statements for all 110 controls, network topology diagram, personnel roles and responsibilities, interconnection agreements with external systems.

For **3.13.11 (FIPS Cryptography):**
> FIPS 140-2/140-3 validation certificates for all cryptographic modules in use; encryption configuration showing FIPS mode enabled where applicable; Azure GCCH/M365 GCC High FedRAMP authorization documentation (inherits FIPS compliance); VPN/TLS FIPS cipher suite configuration export.

---

## 8. KEY WORKFLOWS FOR DEVELOPMENT

### Onboarding a New Client

```
MSP Admin fills onboard wizard:
  1. Org details (name, CAGE code, contacts)
  2. System scoping (# users, locations, CUI types)
  3. Control N/A selections (no wireless? no mobile devices?)
  4. Team setup (invite client admin + contributors)
  5. Initial assignment bulk creation

→ POST /api/orgs (FastAPI)
→ Triggers n8n onboard-client workflow
→ 110 program_controls created in Postgres
→ N/A controls marked
→ Phase 1 controls unlocked, phases 2-5 locked
→ Assignments created
→ Welcome emails sent
→ Client admin can now log in and see their dashboard
```

### Evidence Submission Flow

```
Contributor logs in → sees task queue
→ Clicks control "3.5.3 - MFA"
→ Reads requirement + acceptable proof guidance
→ Uploads "Okta_MFA_Enrollment_Report.pdf"
→ FastAPI stores in MinIO → creates artifact record
→ FastAPI triggers n8n webhook
→ n8n extracts text from PDF (pdfplumber)
→ n8n sends to Claude with MFA control prompt
→ Claude returns: {"verdict": "pass", "confidence": 0.92, ...}
→ Control status → fully_implemented
→ SPRS score recalculated (+5 points)
→ Contributor receives email: "Control 3.5.3 passed assessment"
→ Dashboard updates in real-time (Hasura subscription)
```

### Phase Unlock Flow

```
All 17 Phase 1 controls → fully_implemented
→ SPRS recalculate runs
→ Phase unlock check runs
→ program.current_phase → '2'
→ Phase 2 program_controls.is_phase_unlocked → TRUE
→ MSP admin notified
→ Phase 2 controls now appear in task queue
```

---

## 9. ENVIRONMENT CONFIGURATION

All configuration via `.env` file at `/opt/cmmc/.env`. Key variable groups:

```bash
# Core domains
DOMAIN=cmmc.yourdomain.com

# Postgres (5 databases)
POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB

# Redis with password
REDIS_PASSWORD

# MinIO (4 buckets)
MINIO_ACCESS_KEY / MINIO_SECRET_KEY

# Authentik OIDC
AUTHENTIK_SECRET_KEY / AUTHENTIK_CLIENT_ID / AUTHENTIK_CLIENT_SECRET

# Hasura
HASURA_GRAPHQL_ADMIN_SECRET
HASURA_GRAPHQL_JWT_SECRET  ← JSON config pointing to Authentik JWKS endpoint

# n8n
N8N_ENCRYPTION_KEY
N8N_EXECUTIONS_MODE=queue  ← Important: must be queue for reliability

# Anthropic
ANTHROPIC_API_KEY
ANTHROPIC_MODEL=claude-sonnet-4-5

# SMTP (for notifications)
SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS

# Next.js auth
NEXTAUTH_SECRET / NEXTAUTH_URL
```

---

## 10. DEPLOYMENT & OPERATIONS

### Startup Order

Services must start in this dependency order:
```
1. postgres     (all other services depend on this)
2. redis        (n8n queue + authentik sessions)
3. minio        (artifact storage)
4. minio-init   (create buckets — runs once and exits)
5. authentik-server + authentik-worker
6. fastapi
7. hasura
8. n8n + n8n-worker
9. nextjs
10. traefik     (last — exposes everything to internet)
```

### Database Migrations

Run in order at first deploy:
```
001_core_schema.sql    → All tables, enums, triggers
002_controls_seed.sql  → All 110 controls with full metadata
003_indexes.sql        → Performance indexes
```

### Health Endpoints
```
FastAPI:  GET  /health              → {"status":"healthy"}
Hasura:   GET  /healthz             → "OK"
n8n:      GET  /healthz             → HTTP 200
Next.js:  GET  /api/health          → {"status":"healthy"}
MinIO:    GET  /minio/health/live   → HTTP 200
```

### Backup Strategy
```
Daily pg_dump → MinIO cmmc-backups bucket
Retention: 30 days
MinIO data → External backup (manual/Proxmox snapshot)
```

### n8n Workflow Import
After n8n is healthy, import all 8 workflow JSON files:
```bash
for f in /opt/cmmc/n8n/workflows/*.json; do
  curl -X POST http://localhost:5678/rest/workflows \
    -H "Content-Type: application/json" \
    -u "$N8N_ADMIN_EMAIL:$N8N_ADMIN_PASSWORD" \
    -d @$f
done
# Then activate each workflow via the n8n UI or API
```

---

## 11. CURRENT STATE & WHAT'S BEEN BUILT

The following has been fully specified and is ready to implement:

| Component | Status |
|-----------|--------|
| VM provisioning spec | ✅ Complete |
| docker-compose.yml | ✅ Complete |
| Traefik config | ✅ Complete |
| Postgres schema (all tables) | ✅ Complete |
| Control seed data (110 controls) | ✅ Complete |
| Performance indexes | ✅ Complete |
| FastAPI application structure | ✅ Complete |
| FastAPI artifact upload router | ✅ Complete |
| FastAPI SPRS calculation service | ✅ Complete |
| n8n artifact assessment workflow | ✅ Complete |
| n8n hung assessment guard | ✅ Complete |
| Next.js dashboard page | ✅ Complete |
| MinIO bucket init | ✅ Complete |
| Environment variable spec | ✅ Complete |

**Still needs to be built:**
- FastAPI: remaining routers (orgs, programs, controls, assignments, reports, webhooks)
- FastAPI: database.py connection layer (asyncpg)
- FastAPI: models.py and schemas.py (SQLAlchemy + Pydantic)
- FastAPI: auth.py (JWT validation middleware)
- FastAPI: minio_service.py full implementation
- FastAPI: report_service.py (SSP + POA&M PDF generation)
- FastAPI: artifact text extraction endpoint
- n8n: Workflows 1, 3, 4, 5, 6, 8 (only 2 and 7 are fully defined)
- Next.js: All pages except dashboard
- Next.js: Apollo Client setup and GraphQL queries/mutations/subscriptions
- Next.js: next-auth Authentik configuration
- Next.js: All reusable components
- Hasura: Metadata configuration and permissions
- Authentik: OIDC application configuration
- Postgres: Additional migrations for alembic integration

---

## 12. CODING CONVENTIONS

### FastAPI
- Async everywhere (`async def`, `asyncpg`, `httpx`)
- Pydantic v2 for all request/response models
- JWT auth as a FastAPI dependency (`Depends(get_current_user)`)
- Structured logging with `structlog`
- All DB operations via asyncpg connection pool (not ORM for performance)
- Error responses: `{"detail": "message", "code": "ERROR_CODE"}`

### Next.js
- TypeScript strict mode
- App Router (not Pages Router)
- Server Components for data fetching where possible
- Client Components only where real-time subscriptions or interactivity needed
- Tailwind CSS for all styling (no CSS modules, no styled-components)
- Apollo Client for all Hasura GraphQL operations
- `fetch` directly for FastAPI REST calls (upload, reports)

### Database
- UUID primary keys everywhere
- All timestamps as `TIMESTAMPTZ` (UTC)
- Soft deletes NOT used (hard deletes with cascade)
- `updated_at` trigger on all mutable tables
- Never expose Postgres connection string outside the internal Docker network

### n8n Workflows
- All workflow state reflected in Postgres — never rely on n8n internal state
- Postgres node for all DB operations (not HTTP to FastAPI for simple queries)
- HTTP Request node for FastAPI calls (complex business logic, file operations)
- Error handling: set `assessment_status = 'failed'` on any exception
- Always log activity to `activity_log` table on significant state changes

### Security
- All secrets in `.env`, never in code
- n8n never exposed to internet (internal network only)
- Hasura admin secret only used server-side (FastAPI, n8n) — never in browser
- MinIO has no public access — all access via presigned URLs
- Postgres never exposed outside Docker network
- Row-level security enforced at Hasura layer — every query filtered by `org_id`

---

## 13. GLOSSARY

| Term | Definition |
|------|-----------|
| CMMC | Cybersecurity Maturity Model Certification — DoD contractor cybersecurity framework |
| NIST 800-171 | The 110-control standard CMMC Level 2 maps to |
| CUI | Controlled Unclassified Information — the data being protected |
| SPRS | Supplier Performance Risk System — DoD database where scores are submitted |
| SSP | System Security Plan — the primary compliance document |
| POA&M | Plan of Action & Milestones — tracks unimplemented controls with remediation plans |
| C3PAO | Certified Third-Party Assessment Organization — performs CMMC audits |
| DIB | Defense Industrial Base — the ~80K defense contractors |
| FAR & Above | Phased implementation framework from CMMC Information Institute |
| CAGE Code | Commercial and Government Entity code — unique DoD contractor identifier |
| DFARS | Defense Federal Acquisition Regulation Supplement — requires CMMC compliance |
| Program | In this codebase: one SSP per client. A client may have multiple programs for different systems |
| Control | One of the 110 NIST 800-171 security requirements |
| Objective | Sub-component of a control (e.g. 3.1.1[a], 3.1.1[b]) |
| Artifact | Evidence file uploaded to prove a control is implemented |
| Assessment | Claude's verdict on whether an artifact satisfies a control |
| Phase Gate | Phase N+1 controls locked until all Phase N controls pass |
| Score Impact | Negative integer: SPRS points lost if control not implemented |
| Verdict | Claude's assessment result: pass / partial / fail |
| MSP | Managed Service Provider — the operator of this platform (Onnex) |
| Org | An MSP client organization (e.g. Canopy Aerospace and Defense) |

---

## 14. REFERENCE: REAL CLIENT CONTEXT

The platform was designed based on an active engagement with **Canopy Aerospace and Defense** (fictional name for reference). Key parameters:

- 180 employees, ~50 with CUI access, 3 contractors
- 4 locations: Ontario CA, Riverside CA, Littleton CO, Cape Canaveral FL
- CUI type: Controlled Technical Information (aerospace/defense)
- Tech stack: Microsoft 365 GCC High, Azure Government Cloud, Okta for Government, Cloudflare Zero Trust for Government, CrowdStrike Falcon, Microsoft Intune, BeyondTrust PAM
- Current SPRS: -203 (no SSP completed, all controls "Implementation Begun")
- MSP assessor: AirGap Labs (G. Lazo)
- CIO: Richard Bays

This context informs the `acceptable_proof_guidance` fields in `control_definitions` — many examples reference the Cloudflare/Okta/M365 GCC High stack as that is the most common enterprise setup for DIB contractors.

---

*Document version: 1.0 | Generated for claude-code project initialization*