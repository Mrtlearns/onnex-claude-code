# CMMC Compliance OS — Product Guide

**Version:** 1.1 | **Live Platform:** https://app.cmmc4msp.on-nex.us  
**Stack:** Next.js 14 · FastAPI · PostgreSQL + pgvector · Hasura GraphQL · n8n · MinIO · Authentik  
**Test Suite:** 353 passing, 0 failures

---

## Executive Summary

Eighty thousand U.S. defense contractors must achieve CMMC Level 2 certification — or lose DoD contract eligibility. Most MSPs today manage this in Excel. The ones who win will use purpose-built tooling.

**CMMC Compliance OS** is a multi-tenant SaaS platform built for MSPs to onboard defense contractor clients and guide them through CMMC Level 2 certification — NIST SP 800-171 Rev 2, 110 controls across 14 domains. It replaces the manual spreadsheet-driven process with a structured, AI-assisted workflow: automatic control seeding on client onboarding, phased task assignment, Claude LLM artifact assessment, live SPRS scoring, and one-click C3PAO audit package export.

**What makes it different from Drata, Vanta, or RegScale:**

- Built specifically for CMMC Level 2 — not a generic GRC tool mapped to CMMC as an afterthought
- MSP-native: one operator dashboard manages unlimited client organizations with full tenant isolation
- Claude LLM assesses every artifact — not rule-based keyword matching, but actual comprehension of whether a policy document satisfies a control's assessment objectives
- 12 AI-powered features: conversational copilot per control, policy draft generation, gap synthesis, SSP narrative interview, evidence freshness monitoring, drift detection, direct integrations with Entra ID/Okta/Defender/CrowdStrike/M365/Splunk, **program-level AI sweep** for the MSP controller, and **task-queue copilot** for individual contributors
- 353 tests, 14 active n8n workflows, 36 test files — production-ready, not prototype-grade

If your MSP manages five defense contractor clients, this platform saves 200+ hours of manual compliance work per engagement and produces a defensible, C3PAO-ready audit package on demand.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Multi-Tenant Structure & RBAC](#multi-tenant-structure--rbac)
3. [110 NIST Controls — Auto-Seeded & Phase-Gated](#110-nist-controls--auto-seeded--phase-gated)
4. [Artifact Assessment Pipeline (AI-Powered)](#artifact-assessment-pipeline-ai-powered)
5. [Feature 1: Real Email Delivery (Resend)](#feature-1-real-email-delivery-resend)
6. [Feature 2: Conversational Compliance Copilot](#feature-2-conversational-compliance-copilot)
7. [Feature 3: AI Policy Draft Generation](#feature-3-ai-policy-draft-generation)
8. [Feature 4: Evidence Freshness Monitoring](#feature-4-evidence-freshness-monitoring)
9. [Feature 5: Evidence Drift Detection](#feature-5-evidence-drift-detection)
10. [Feature 6: C3PAO Audit Package Export](#feature-6-c3pao-audit-package-export)
11. [Feature 7: MSP Portfolio Analytics](#feature-7-msp-portfolio-analytics)
12. [Feature 8: Gap Synthesis](#feature-8-gap-synthesis)
13. [Feature 9: SSP Narrative Generation](#feature-9-ssp-narrative-generation)
14. [Feature 10: Evidence Source Integrations (6 Providers)](#feature-10-evidence-source-integrations-6-providers)
15. [Feature 11: Program AI Sweep (MSP Controller Bulk Analysis)](#feature-11-program-ai-sweep-msp-controller-bulk-analysis)
16. [Feature 12: Task Queue Inline Copilot (Task Member AI)](#feature-12-task-queue-inline-copilot-task-member-ai)
17. [Test Coverage](#test-coverage)
16. [Deployment & Operations](#deployment--operations)
17. [Pricing & Packaging](#pricing--packaging)
18. [Glossary](#glossary)

---

## Architecture Overview

```
INTERNET (port 443 only)
        │
        ▼
   TRAEFIK v3  ← Cloudflare DNS challenge TLS (wildcard cert)
        │
        ├── app.domain    →  Next.js 14         :3000  (frontend)
        ├── api.domain    →  FastAPI             :8000  (core API)
        ├── gql.domain    →  Hasura GraphQL      :8080  (real-time data)
        └── auth.domain   →  Authentik OIDC      :9000  (identity)

INTERNAL NETWORK (never internet-exposed)
        ├── PostgreSQL 16 + pgvector  :5432
        ├── Redis                     :6379  (n8n queue + session cache)
        ├── MinIO (S3-compatible)     :9000  (artifact + report storage)
        └── n8n (queue mode)          :5678  (14 async workflows)

EXTERNAL APIs
        └── Anthropic API  ← LLM assessment, copilot, policy generation
        └── Resend API     ← Transactional email delivery
        └── OpenRouter     ← Workflow-level LLM calls (claude-sonnet via n8n)
```

**Deployment target:** Single Ubuntu 24.04 LTS VM (8-16 vCores, 32-64 GB RAM, 500 GB SSD) running all services via Docker Compose. No Kubernetes overhead for SME-scale MSP deployments.

**Data isolation:** PostgreSQL with `org_id`-scoped row-level permissions enforced at the Hasura GraphQL layer. A client user cannot query data from another org regardless of what they send — the JWT claim carries `org_id` and Hasura filters every query.

**Real-time updates:** Hasura WebSocket subscriptions push SPRS score changes, control status updates, and activity feed events to the browser immediately after each artifact assessment completes — no polling required.

**Async reliability:** n8n runs in queue mode with Redis backend. All workflow state is mirrored to PostgreSQL (`artifacts.assessment_status`). If n8n restarts mid-assessment, a 15-minute hung-assessment guard cron automatically resets and retries stuck records.

### Service Responsibilities

| Service | Role |
|---------|------|
| FastAPI | Business logic, file handling, SPRS calculation, report generation, AI orchestration |
| Hasura | GraphQL API with real-time subscriptions, row-level security enforcement |
| n8n | Async workflows: artifact assessment, onboarding, email, freshness, drift, integrations |
| PostgreSQL | Source of truth — all state persisted here, never in n8n |
| MinIO | Artifact storage, report storage, audit package assembly |
| Authentik | OIDC identity provider, user management, invitation flows |
| Traefik | TLS termination, subdomain routing, security headers |

### Key Data Model Entities

| Entity | Description |
|--------|-------------|
| `orgs` | MSP client organizations — each with name, CAGE code, slug |
| `programs` | One SSP per system per org; holds SPRS score, phase, all SSP fields |
| `control_definitions` | 110 seeded NIST controls (read-only); includes requirement text, DoD score weight, phase |
| `program_controls` | Per-program instantiation of each control; tracks status and score impact |
| `artifacts` | Evidence files uploaded per control; tracks assessment status |
| `assessments` | Claude's verdict per artifact: pass/partial/fail, confidence, rationale, gaps |
| `milestones` | POA&M entries — auto-generated for unimplemented controls |
| `activity_log` | Full audit trail of every action across the platform |

---

## Multi-Tenant Structure & RBAC

### Four-Tier Role Model

| Role | Who | Access |
|------|-----|--------|
| `super_admin` | Platform operator (Onnex) | All orgs, all programs, platform config |
| `msp_admin` | MSP staff | All client orgs; full CRUD; portfolio analytics |
| `client_admin` | Client's IT lead / CISO | Own org only; manage team, assignments, reports |
| `client_user` | Client's technical staff | Own org; upload artifacts, view assessments, task queue |

Roles are issued as JWT claims by Authentik OIDC and enforced at two layers:

1. **FastAPI** — checks `role` from JWT on every request; returns 403 immediately for unauthorized roles
2. **Hasura** — row-level permissions filter every GraphQL query by `org_id` from the JWT claim

A client_user cannot see another organization's controls, artifacts, or SPRS scores — the Hasura permission layer ensures this even if the frontend is compromised or a token is leaked.

### Onboarding a New Client

```
POST /api/orgs/onboard
```

**Payload:**
```json
{
  "name": "Canopy Aerospace and Defense",
  "cage_code": "8AXZ1",
  "slug": "canopy",
  "primary_contact_name": "Richard Bays",
  "primary_contact_email": "rbays@canopydefense.com",
  "scoping_config": {
    "has_wireless": false,
    "has_mobile_devices": true,
    "locations": ["Ontario CA", "Riverside CA", "Littleton CO", "Cape Canaveral FL"]
  }
}
```

**What happens automatically:**
1. Org record created in `orgs` table
2. n8n Workflow 01 (Onboard Client) triggered via webhook
3. All 110 `control_definitions` instantiated as `program_controls` for the new program
4. Scoping config applied — e.g., `has_wireless: false` marks controls 3.1.16 and 3.1.17 as `not_applicable`
5. Phase 1 controls unlocked; Phases 2-5 locked until Phase 1 completes
6. Baseline SPRS score calculated (starts at -203 if SSP not complete)
7. Welcome emails sent to client admin and invited contributors
8. MSP dashboard updated in real-time

**Result:** Client is ready to start evidence collection in under 2 minutes, with 110 controls organized, scored, and phase-sequenced.

---

## 110 NIST Controls — Auto-Seeded & Phase-Gated

### The Control Framework

Every platform instance contains all 110 NIST SP 800-171 Rev 2 controls and 297 sub-objectives, sourced from the CMMC Information Institute's official self-assessment methodology. Controls span 14 domains:

| Domain | Abbrev | Controls | Example Requirement |
|--------|--------|----------|---------------------|
| Access Control | AC | 22 | Limit system access to authorized users and functions |
| Audit & Accountability | AU | 9 | Create and retain audit logs to enable monitoring |
| Awareness & Training | AT | 3 | Ensure personnel are aware of security risks |
| Configuration Management | CM | 9 | Establish baseline configurations for IT systems |
| Identification & Authentication | IA | 11 | Identify and authenticate users before access |
| Incident Response | IR | 3 | Establish an incident response capability |
| Maintenance | MA | 6 | Perform maintenance on organizational systems |
| Media Protection | MP | 9 | Protect system media containing CUI |
| Personnel Security | PS | 2 | Screen individuals prior to authorizing access |
| Physical Protection | PE | 6 | Limit physical access to systems and CUI |
| Risk Assessment | RA | 3 | Periodically assess risk to organizational operations |
| Security Assessment | CA | 4 | Periodically assess security controls |
| System & Comms Protection | SC | 16 | Monitor, control, and protect communications |
| System & Info Integrity | SI | 7 | Identify, report, and correct system flaws |

### Per-Control Data

Every control in the platform carries:

- `requirement_text` — the verbatim NIST requirement
- `assessment_objective` — what an assessor determines (used as LLM context)
- `dod_comment` — DoD assessor guidance notes
- `acceptable_proof_guidance` — specific artifacts that satisfy the control (drives Claude assessment prompts)
- `dod_score_value` — SPRS weight: 1, 3, or 5 points
- `far_above_phase` — which of the 5 implementation phases this control belongs to
- `diy_type` — DIY / Outsource / Hybrid (implementation guidance)

### Control Status Lifecycle

```
not_implemented
    → partially_implemented    (artifact assessed as "partial")
    → fully_implemented        (artifact assessed as "pass")
    → not_applicable           (scoped out during onboarding)
```

Status transitions trigger automatic SPRS recalculation.

### SPRS Scoring

**Formula:**
```
SPRS = 110 − Σ(dod_score_value for each not-fully-implemented applicable control)
Range: −203 to 110

Special rule: If control 3.12.4 (SSP) is not fully_implemented → SPRS forced to −203
```

This mirrors the actual DoD Assessment Methodology. The SSP penalty exists because you cannot self-attest without a completed System Security Plan — so the platform enforces this gate exactly as DoD does.

SPRS recalculates automatically after every artifact assessment verdict via a PostgreSQL trigger (`pg_notify`) that fires n8n Workflow 03.

### FAR & Above Phased Implementation

Controls are unlocked sequentially. A client cannot work on Phase 2 until all Phase 1 controls pass. This prevents the common failure mode where a client skips foundational controls and builds compliance on a broken foundation.

| Phase | Controls | SPRS Points | Primary Focus |
|-------|----------|-------------|---------------|
| 1 | 17 | 37 | Boundary protection, physical security, basic identity, AV, patching |
| 2 | 23 | 32 | SSP completion, MFA, security training, risk assessment, maintenance |
| 3 | 22 | 34 | Remote access, cryptography, incident response, basic audit logging |
| 4 | 23 | 37 | Full audit logging, configuration management, media protection |
| 5 | 25 | 47 | Advanced network controls, personnel security, CUI data flow controls |

When all controls in a phase reach `fully_implemented`, n8n Workflow 04 automatically unlocks the next phase, notifies the MSP admin, and sends the client a phase completion email with the next phase control list.

---

## Artifact Assessment Pipeline (AI-Powered)

This is the core differentiator. Instead of a human reviewer reading every uploaded document, Claude assesses it against the control's specific requirements and returns a structured verdict.

### End-to-End Flow

```
1. Contributor uploads evidence file (PDF, DOCX, PNG, XLSX)
2. FastAPI stores file in MinIO bucket: cmmc-artifacts
3. FastAPI creates artifact record (assessment_status: pending)
4. FastAPI POSTs to n8n Workflow 02 webhook

n8n Workflow 02 — Artifact Submitted:
5.  Set assessment_status = 'processing', increment assessment_attempts
6.  Download file from MinIO
7.  POST to FastAPI /api/artifacts/{id}/extract
        → PDF: pdfplumber text extraction
        → Images: Claude Vision API describes visual content
        → DOCX: python-docx text extraction
        → Returns: {extracted_text, page_count}
8.  Query control_definitions for: requirement_text, assessment_objective,
    acceptable_proof_guidance
9.  Build assessment prompt (see below)
10. POST to OpenRouter claude-sonnet → structured JSON verdict
11. INSERT into assessments table
12. Set assessment_status = 'assessed'
13. UPDATE program_controls.status based on verdict
14. Trigger SPRS recalculation (Workflow 03)
15. Check phase completion → unlock next phase if warranted (Workflow 04)
16. Email assignee with result (Workflow 11 via Resend)
17. Callback FastAPI /api/webhooks/n8n/assessment-complete
```

### Assessment Prompt Structure

```
SYSTEM: You are a CMMC Level 2 compliance assessor with expertise in NIST SP
800-171 Rev 2. Assess whether the submitted evidence artifact satisfies the
given security control requirement. Be precise, objective, and thorough.
Always respond with valid JSON only.

USER:
CONTROL ID: AC.L2-3.5.3

CONTROL REQUIREMENT:
Use multifactor authentication for local and network access to privileged
accounts and for network access to non-privileged accounts.

ASSESSMENT OBJECTIVE:
Determine if MFA is used for local access to privileged accounts; network
access to privileged accounts; and network access to non-privileged accounts.

ACCEPTABLE PROOF CRITERIA:
MFA enforcement policy; Conditional Access policy exports showing MFA required
for all users; Okta/Entra MFA enrollment report showing 100% coverage;
privileged account list with MFA status confirmed; sample MFA prompt screenshots.

SUBMITTED ARTIFACT CONTENT:
[extracted text from uploaded file]

Respond ONLY with this JSON, no other text:
{
  "verdict": "pass|partial|fail",
  "confidence": 0.0-1.0,
  "rationale": "detailed explanation",
  "gaps": ["gap 1", "gap 2"]
}
```

### Verdict Mapping

| Claude Verdict | Confidence | Control Status | SPRS Impact |
|---------------|-----------|----------------|-------------|
| `pass` | Any | `fully_implemented` | Full points recovered |
| `partial` | Any | `partially_implemented` | No change (still losing points) |
| `fail` | Any | Unchanged | No change |

### MSP Override

MSP admins can override Claude's verdict with justification:

```
PATCH /api/assessments/{assessment_id}/override
```

Override records `reviewer_override: true`, captures `reviewer_notes`, updates control status, and logs the action to `activity_log` with the reviewer's identity and timestamp. This creates a defensible paper trail if a C3PAO questions the assessment decision.

### Hung Assessment Guard

n8n Workflow 07 runs every 15 minutes and:
1. Finds artifacts stuck in `processing` status for > 10 minutes
2. Resets them to `pending`
3. Re-queues for assessment (up to 3 attempts total)

No manual intervention needed for transient API failures.

---

## Feature 1: Real Email Delivery (Resend)

**What it does:** Transactional email for all compliance events, delivered via Resend API with per-user preference controls and unsubscribe support.

**Why it matters:** Compliance work fails when people don't know what to do next. Every control assignment, assessment result, and deadline reminder is automatically delivered to the right person — without the MSP manually chasing updates.

### Emails Sent

| Event | Workflow | Recipients | Contents |
|-------|----------|-----------|----------|
| User invitation | WF-10 | New user | Deep link to `/invite/{token}`, 72-hour expiry, role-aware greeting |
| Control assigned | WF-09 | Assignee | Control name, deep link, due date, MSP instructions |
| Assessment complete | WF-11 | Assignee | Verdict badge (PASS/PARTIAL/FAIL), control ID, confidence score, gap list, deep link to evidence |
| POA&M deadline | WF-05 | MSP admin + client admin | 14/7/1-day warnings; remediation plan summary |
| Phase unlocked | WF-04 | MSP admin + client admin | Celebration notice + next-phase control list |
| Weekly digest | WF-06 | MSP admin | Cross-portfolio summary: SPRS scores, overdue items, top failing controls |

### User Preference Controls

```
GET  /api/notifications/preferences
     → Returns 6 toggleable categories per user

PATCH /api/notifications/preferences
      Body: {"assignments": true, "assessments": true, "poam_reminders": false, ...}
```

**6 categories:** `assignments`, `assessments`, `poam_reminders`, `phase_unlocks`, `weekly_digest`, `system_alerts`

Users control their own notification preferences from `/{orgSlug}/settings/notifications`.

### Unsubscribe

```
GET /api/notifications/unsubscribe/{token}
```

One-click unsubscribe link included in every email footer. Disables all notifications for that user without requiring login.

### How to Set Up

1. Add `RESEND_API_KEY=re_...` to `.env`
2. Configure sender domain in Resend dashboard (SPF/DKIM required)
3. Set `EMAIL_FROM_ADDRESS=compliance@yourdomain.com` in `.env`
4. All emails fire automatically on platform events — no additional configuration

---

## Feature 2: Conversational Compliance Copilot

**What it does:** A Claude Sonnet 4.6 chatbot on every control detail page, grounded in four RAG sources specific to that control and that organization's evidence.

**Why it matters:** A client contributor staring at "AC.L2-3.1.5 — Employ the principle of least privilege" does not know what to upload. The copilot answers specific questions: "How do we satisfy this with Azure AD?" or "What gaps does our current evidence have?" — with answers grounded in the actual evidence already in the system, not generic guidance.

### RAG Sources (per query)

| Source | Description | Retrieval Method |
|--------|-------------|-----------------|
| Control definition | Full requirement text, objectives, DoD guidance from DB | Direct lookup |
| Org's artifacts for this control | Evidence already uploaded and assessed | pgvector cosine similarity on `artifact_chunks` |
| Cross-control evidence | Related chunks from other controls in the same program | Cosine similarity > 0.6 threshold |
| NIST SP 800-171A guide | 1,331 chunks from the official NIST assessment guide, seeded across 407 controls | pgvector cosine similarity |

The copilot does not hallucinate control requirements — it reads them from the database. It does not invent what evidence exists — it queries the actual uploaded artifacts via vector search.

### API

```
POST /api/controls/program/{program_id}/{control_id}/chat
     Body: {"message": "How do we satisfy AC.L2-3.1.1 with Azure AD?"}
     Response: Server-Sent Events (streaming)

GET  /api/controls/program/{program_id}/{control_id}/chat
     → Returns conversation history for this (user, program_control) pair

DELETE /api/controls/program/{program_id}/{control_id}/chat
       → Clears conversation history
```

### How to Use

1. Navigate to any control: `/{orgSlug}/controls/{control_id}`
2. Click the **Copilot** tab (star icon)
3. Type a question — responses stream in real-time
4. Citations show which uploaded artifacts informed the answer
5. Conversation history persists per user per control — pick up where you left off

### Example Queries That Work Well

- "How do we satisfy this control with our current Okta setup?"
- "What evidence do we still need to fully pass this control?"
- "Our assessor said our MFA policy is incomplete — what's missing?"
- "Can the CrowdStrike report we uploaded satisfy this?"
- "What does NIST say about acceptable implementations for this requirement?"

---

## Feature 3: AI Policy Draft Generation

**What it does:** Generates a complete, org-specific policy document for any control using Claude Opus, then automatically submits the draft for artifact assessment.

**Why it matters:** For controls in the AC, IA, SC, and SI families, a written policy is often required evidence. Writing 15-20 policies from scratch is the single most time-consuming part of a CMMC engagement. This feature reduces that to a review-and-approve workflow.

### Context Used for Generation

The model receives:
- Org name and CAGE code
- Hardware inventory (from `hardware_inventory` table)
- Software inventory (from `software_inventory` table)
- Cloud services in use (from `cloud_services_inventory` table)
- Control requirement text and assessment objectives
- NIST SP 800-171A guidance for the control
- Specific policy sections required per NIST

### Output Pipeline

```
POST /api/controls/program/{program_id}/{control_id}/draft-policy
     (background task — returns immediately)

n8n receives trigger →
Claude Opus generates Markdown policy (~800-1500 words) →
python-docx converts Markdown to formatted DOCX →
DOCX uploaded to MinIO bucket: cmmc-drafts →
Artifact record created automatically →
Artifact submitted for assessment (Workflow 02 triggered) →
Assessment verdict returned
```

### Endpoints

```
POST /api/controls/program/{program_id}/{control_id}/draft-policy
     → Triggers generation; returns {draft_id, status: "generating"}

GET  /api/controls/program/{program_id}/{control_id}/draft-policy
     → Lists all drafts for this control with status

POST /api/controls/program/{program_id}/{control_id}/draft-policy/{draft_id}/review
     Body: {"action": "approve"|"reject", "notes": "..."}
     → MSP reviews and approves/rejects the draft
```

### How to Use

1. Navigate to any control with status `not_implemented` or `partially_implemented`
2. Click the purple **Generate Draft Policy** button (visible only on eligible controls)
3. Wait 30-60 seconds for generation to complete
4. Open the draft from the policy drafts list — read the generated DOCX
5. If acceptable: click Approve — draft is committed and assessment verdict is applied
6. If revision needed: click Reject with notes — the MSP can regenerate with adjusted context

> **Technical note:** The DOCX generation uses python-docx with a corporate policy template — heading hierarchy, section numbering, review date fields, and signature blocks are included. The output is ready for client letterhead and signature, not just compliance filing.

---

## Feature 4: Evidence Freshness Monitoring

**What it does:** Enforces time-based expiry on evidence per control family. A firewall config export from 14 months ago is not current evidence — the platform knows this and acts automatically.

**Why it matters:** CMMC is not a one-time certification. Evidence goes stale. Without automated freshness monitoring, an MSP's clients can silently fall out of compliance between assessment cycles — with no one noticing until the C3PAO arrives.

### Expiry Thresholds by Control Family

| Family | Threshold | Rationale |
|--------|-----------|-----------|
| AU (Audit) | 30 days | Audit logs must be current; old logs don't prove active monitoring |
| AC, IA, MA, SC, SI | 90 days | Policy and configuration evidence reviewed quarterly |
| CM (Configuration) | 180 days | Baselines are longer-lived but must be reviewed semi-annually |
| All other families | 365 days | Annual review cycle matches typical SSP review cadence |

### How It Works

n8n Workflow 13 runs nightly at 01:00 UTC and:
1. Queries all `program_controls` with `assessment_status = assessed`
2. Checks artifact age against the family threshold
3. For stale controls:
   - Demotes `program_controls.status` → `needs_review`
   - Opens a new POA&M `milestones` entry
   - Notifies the control assignee to upload fresh evidence
   - Logs to `activity_log`

### API

```
GET  /api/programs/{program_id}/freshness
     → Returns: {fresh_count, stale_count, expiring_soon_count, per_control_breakdown}

POST /api/webhooks/n8n/mark-stale
     Auth: WEBHOOK_SECRET header
     Body: {program_control_ids: [...]}
     → Internal webhook called by Workflow 13
```

### How to Use

Freshness runs automatically — no manual intervention. To check current status:

```bash
curl -H "Authorization: Bearer {token}" \
  https://api.cmmc4msp.on-nex.us/api/programs/{program_id}/freshness
```

The MSP dashboard freshness section displays a heat view showing which controls are fresh (green), expiring soon (amber, within 14 days), or stale (red). Upload new evidence to any stale control to reset its freshness clock.

---

## Feature 5: Evidence Drift Detection

**What it does:** Nightly re-embedding of all artifacts detects when a document has been materially changed since it was assessed — and flags which specific sections were altered.

**Why it matters:** Defense contractors update their policies and configurations continuously. An artifact assessed as "pass" six months ago may have had critical sections removed since then. Without drift detection, the control appears compliant in the platform while the actual document no longer satisfies the requirement.

### How Drift Is Detected

```
n8n Workflow 14 (nightly, 03:00 UTC):
1. Re-embed all artifacts using text-embedding-3-large (via pgvector)
2. Compare new embedding to embedding captured at assessment time (baseline)
3. If cosine distance > 0.15 threshold → flag as drifted
4. Call claude-haiku-4-5 to generate human-readable diff summary
5. Update artifact.drift_status = 'drifted'
6. Demote program_control.status → 'needs_review'
7. Notify control reviewer
8. Log to activity_log with diff summary
```

### Drift Summary (AI-Generated)

The diff summary is not just "document changed." Claude Haiku reads the old extracted text vs. the current extracted text and explains what compliance-relevant content was removed. Example:

> "Sections 3.1 through 3.3 of the Access Control Policy were removed. These sections contained the system access authorization procedures and least-privilege enforcement statements that satisfied objectives AC.L2-3.1.1[b] and AC.L2-3.1.2[a]. The current document no longer demonstrates enforcement of these requirements."

### API

```
POST /api/artifacts/{artifact_id}/dismiss-drift
     Body: {"note": "Version change was approved — old sections removed intentionally"}
     → Sets drift_status = 'dismissed', logs justification to activity_log

POST /api/webhooks/n8n/batch-drift-check
     Auth: WEBHOOK_SECRET header
     Body: {artifact_ids: [...]}
     → Internal; processes batch drift check for specified artifacts
```

### How to Use

Drift detection runs automatically. When a drift flag appears:

1. Reviewer sees alert in the control detail UI with the AI-generated diff summary
2. **Option A:** Upload a new version of the artifact (clears drift flag, triggers fresh assessment)
3. **Option B:** Dismiss the drift with a justification note (audit trail preserved)

Dismissed drift events are logged to `activity_log` and visible in the C3PAO audit package.

---

## Feature 6: C3PAO Audit Package Export

**What it does:** One-click export of a complete, C3PAO-ready audit package — every evidence artifact, the SSP, the POA&M, a SHA-256 manifest, and a control-to-evidence map — assembled into a single ZIP file.

**Why it matters:** Preparing an audit package manually takes days. The C3PAO needs to see every artifact, understand which control each one supports, and have a way to verify file integrity. This feature produces that package in under two minutes for a typical engagement.

### Package Contents

| Item | Source |
|------|--------|
| `SSP.pdf` | Generated from `programs.ssp_*` fields via ReportLab |
| `POAM.pdf` | Generated from `milestones` table via ReportLab |
| `artifacts/` | All assessed artifacts downloaded from MinIO |
| `MANIFEST.json` | SHA-256 hash of every file; artifact ID, control ID, assessment verdict, confidence |
| `control-evidence-map.pdf` | Table mapping each of the 110 controls to its artifacts and verdicts |
| `activity-log.pdf` | Filtered timeline of assessment events, override decisions, approvals |

### Endpoints

```
POST /api/audit/programs/{program_id}/audit-package
     → Triggers background assembly; returns {package_id, status: "pending"} immediately

GET  /api/audit/programs/{program_id}/audit-package
     → Lists all packages for this program with status: pending | ready | failed

GET  /api/audit/programs/{program_id}/audit-package/{package_id}/download
     → Returns presigned MinIO URL (valid 1 hour) when status = ready
```

### Artifact Approval Workflow

Before including artifacts in a package, MSPs can formally approve each one:

```
POST /api/audit/artifacts/{artifact_id}/approve
     Body: {"notes": "Reviewed and approved for C3PAO submission"}
```

Approval status is tracked in the `artifact_approvals` table and included in the audit package manifest.

### How to Use

1. Navigate to the program dashboard
2. Click **Export Audit Package**
3. Poll `GET /api/audit/programs/{program_id}/audit-package` until `status: ready` (typically < 2 minutes for < 50 artifacts)
4. Click Download — receives a presigned URL to the assembled ZIP in MinIO
5. Hand the ZIP to the C3PAO assessor

> **For large engagements** (> 100 artifacts): package assembly may take 3-5 minutes. The endpoint is non-blocking — the UI polls for status and notifies when ready.

---

## Feature 7: MSP Portfolio Analytics

**What it does:** An MSP-only dashboard aggregating compliance health metrics across every client organization managed by the MSP.

**Why it matters:** An MSP managing 15 defense contractor clients cannot manually check each one. The portfolio dashboard surfaces which clients are at risk (negative SPRS), which controls are failing consistently across clients, and where to focus attention this week.

### Metrics Available

| Metric | Description |
|--------|-------------|
| Total client orgs | Count of active orgs managed |
| Artifacts assessed this week | Across all clients combined |
| Controls marked "met" this week | New fully_implemented controls across portfolio |
| Orgs with negative SPRS | At-risk clients (score < 0) |
| SPRS distribution | Histogram: negative / 0-50 / 50-100 / 110 (perfect) |
| Top 10 failing controls | Controls with highest fail counts across all clients |
| Per-org table | Name, program count, SPRS score, color-coded status |
| Weekly activity feed | Recent assessment events across portfolio |

### API

```
GET /api/analytics/msp-summary
    Auth: msp_admin role required (403 for client roles)
    Response: {
      total_orgs, artifacts_this_week, controls_met_this_week,
      negative_sprs_orgs, sprs_distribution, top_failing_controls,
      org_table, activity_feed
    }
```

### How to Use

1. Log in as `msp_admin`
2. Navigate to **Admin → Analytics** (`/admin/analytics`)
3. Use the per-org table to identify clients needing attention (red = SPRS < 0, amber = 0-50)
4. Drill into top failing controls to build targeted remediation guidance for multiple clients at once

---

## Feature 8: Gap Synthesis

**What it does:** Claude Sonnet 4.6 analyzes every artifact in the organization against a control's objectives and produces a precise list of what is covered and what is still missing.

**Why it matters:** A client uploads five artifacts for a control and it still fails. The copilot can answer questions, but the MSP needs a definitive, structured answer: "Which specific objectives are covered, which are not, and what type of evidence would close each gap?" That is what gap synthesis produces.

### How It Works

```
1. Decompose control into individual assessment objectives
2. Retrieve all org artifacts with cosine similarity > threshold to this control
3. Retrieve cross-control evidence from related controls in the program
4. Send to claude-sonnet-4-6 with structured analysis prompt
5. Parse structured JSON response
6. Store in control_gap_analyses table
```

### Output Structure

```json
{
  "covered_objectives": ["AC.L2-3.1.1[a]", "AC.L2-3.1.1[b]", "AC.L2-3.1.1[c]"],
  "missing_objectives": ["AC.L2-3.1.1[d]"],
  "missing_objective_details": {
    "AC.L2-3.1.1[d]": "Requires evidence that access reviews occur quarterly — no periodic review documentation found in uploaded artifacts"
  },
  "recommended_artifacts": [
    "Screenshot of quarterly access review approval in Entra ID",
    "User access review report export with manager attestation",
    "Procedure document defining the access review schedule"
  ],
  "confidence": 0.87
}
```

### API

```
POST /api/controls/program/{program_id}/{control_id}/gap-analysis
     → Triggers analysis (background task, 15-30 seconds)
     → Returns {analysis_id, status: "pending"}

GET  /api/controls/program/{program_id}/{control_id}/gap-analysis
     → Lists all gap analyses for this control

GET  /api/controls/program/{program_id}/{control_id}/gap-analysis/{analysis_id}
     → Full analysis result with covered/missing objectives and recommendations
```

### How to Use

1. Navigate to a control that has artifacts but hasn't fully passed
2. Click **Analyze Gaps** button on the control detail page
3. Wait 15-30 seconds
4. Read the structured results:
   - Green checkmarks on covered objectives
   - Red markers on missing objectives with specific explanation
   - Recommended artifact types with precise descriptions
5. Send the recommended artifact list directly to the client contributor as assignment instructions

---

## Feature 9: SSP Narrative Generation (Conversational Interview)

**What it does:** A 15-question guided interview generates the five narrative sections of a System Security Plan using Claude Sonnet 4.6, pre-populated from the organization's existing inventory data.

**Why it matters:** The SSP is the single most important compliance document — without it, SPRS is forced to -203 regardless of all other controls. Writing an SSP narrative from scratch takes a compliance consultant 8-20 hours. The interview reduces that to 30-45 minutes of answering questions, with Claude generating publication-quality prose.

### Five SSP Narrative Sections Generated

| Section | Column | Word Count | Content |
|---------|--------|-----------|---------|
| System Description | `programs.ssp_system_description` | 800-1,200 | System name, purpose, users, CUI types handled |
| Environment of Operation | `programs.ssp_environment_of_operation` | 1,000-1,500 | Infrastructure, cloud services, network architecture |
| Information Types | `programs.ssp_information_types` | 600-900 | CUI categories, data flows, handling requirements |
| Security Requirements | `programs.ssp_security_requirements` | 1,200-1,500 | Implementation approach for each of the 14 domains |
| Interconnections | `programs.ssp_interconnections` | 600-1,000 | External system connections, data sharing agreements |

### Pre-Population from Inventory

The interview pre-fills answers for technical questions using:
- `hardware_inventory` table — system names, types, locations
- `software_inventory` table — applications, versions, functions
- `cloud_services_inventory` table — SaaS and IaaS services in use

Approximately 5 of the 15 questions auto-populate from inventory data. The user reviews and corrects rather than typing from scratch.

### Interview API

```
POST /api/programs/{program_id}/ssp-interview
     → Creates new interview session; returns pre-populated answers
     Response: {interview_id, questions: [{id, text, pre_populated_answer}]}

GET  /api/programs/{program_id}/ssp-interview/{interview_id}
     → Current interview state and answers

PATCH /api/programs/{program_id}/ssp-interview/{interview_id}
      Body: {answers: {question_id: "answer text", ...}}
      → Save answers (auto-saves on every change in UI)

POST /api/programs/{program_id}/ssp-interview/{interview_id}/generate
     → Trigger Claude generation for all 5 sections (background, ~60-90 seconds)

POST /api/programs/{program_id}/ssp-interview/{interview_id}/review
     Body: {section: "system_description", action: "approve"|"reject", notes: "..."}
     → MSP reviews and approves/rejects each section independently

POST /api/programs/{program_id}/ssp-interview/{interview_id}/commit
     → Write all approved sections to programs.ssp_* columns
     → Log commit event to activity_log
     → SSP report now includes the generated narratives
```

### How to Use

1. Navigate to the program and click **Start SSP Interview**
2. Answer 15 questions (expect ~30-45 minutes; 5 are pre-filled from inventory)
3. Click **Generate Narratives** — Claude generates all 5 sections
4. Review each section — approve or reject with notes per section
5. Click **Commit Approved Sections** — narratives are written to the SSP
6. Generate SSP report (`POST /api/reports/{program_id}/ssp`) to produce the final PDF with narratives included

---

## Feature 10: Evidence Source Integrations (6 Providers)

**What it does:** OAuth and API-key connectors that pull evidence directly from the client's existing security tools and automatically submit that evidence through the assessment pipeline.

**Why it matters:** Defense contractors already have Entra ID, Defender, CrowdStrike, and M365 deployed. Their compliance evidence lives inside those tools. Instead of exporting PDFs manually and uploading them, the platform pulls the evidence directly, formats it, and runs it through assessment automatically — nightly.

### Six Supported Providers

| Provider | Evidence Pulled | Controls Addressed |
|----------|----------------|-------------------|
| **Microsoft Entra ID** | User roster, Conditional Access policies, MFA enrollment status | AC.L2-3.1.1, 3.1.2, 3.1.3 |
| **Okta** | Users, MFA enrollment, password policies, session policies | IA.L2-3.5.1 through 3.5.11 |
| **Microsoft Defender** | Endpoint hardening reports, device compliance status, AV coverage | SI.L2-3.14.*, CM.L2-3.4.* |
| **CrowdStrike** | Device IDs, Falcon sensor protection status, policy assignments | SI.L2-3.14.1, 3.14.2 |
| **Microsoft 365 Secure Score** | Security posture score, active recommendations, control coverage | CM.L2-3.4.1, AC.L2-3.1.* |
| **Splunk** | Audit log export, event counts by category, retention verification | AU.L2-3.3.1 through 3.3.9 |

Each connector creates a real `artifact` record in the database and triggers Workflow 02 — the same assessment pipeline used for manual uploads. The C3PAO sees these as assessed artifacts with verdicts, confidence scores, and rationale, identical to human-uploaded evidence.

### Endpoints

```
POST /api/integrations
     Body: {
       "provider": "entra_id",
       "credentials": "<base64-encoded JSON with client_id, client_secret, tenant_id>",
       "org_id": "uuid"
     }
     → Creates or upserts integration; returns {integration_id}

GET  /api/integrations
     → Lists all integrations for the current org

POST /api/integrations/{integration_id}/sync
     → Triggers manual sync (background task)
     → Returns {sync_log_id}

GET  /api/integrations/{integration_id}/sync-history
     → Last 20 sync log entries with status, artifact counts, errors

DELETE /api/integrations/{integration_id}
       → Revokes integration, removes stored credentials
```

### Nightly Sync

n8n Workflow 12 runs at 02:00 UTC and syncs all active integrations automatically. Artifacts from the previous sync are versioned — the new sync creates new artifact records rather than overwriting, maintaining an evidence history.

### How to Use

1. Navigate to **Integrations** (`/{orgSlug}/integrations`)
2. Click **Add Integration** and select provider
3. Enter credentials:
   - **Entra ID / Defender / M365:** App registration client ID + secret + tenant ID
   - **Okta:** API token + org domain
   - **CrowdStrike:** Client ID + client secret
   - **Splunk:** API token + instance URL
4. Click **Sync Now** to run immediately, or wait for the nightly 02:00 UTC job
5. Evidence artifacts appear in the control list automatically assessed within minutes

> **Security note:** Credentials are stored base64-encoded in the `integrations` table. In production, integrate with a secrets manager (HashiCorp Vault or AWS Secrets Manager) rather than storing in the application database.

---

## Feature 11: Program AI Sweep (MSP Controller Bulk Analysis)

**What it does:** One API call analyzes all non-fully-implemented controls across an entire program, returns a Claude-ranked action plan, and lets the MSP apply bulk status updates with a single click.

**Why it matters:** MSPs managing 20-50 client orgs can't afford to open each control one at a time to understand what's needed. The Sweep gives the controller a portfolio triage tool — exactly which controls to attack first, why, and what to do — in under 60 seconds.

### How It Works

1. Sweep fetches every non-fully-implemented, applicable control for the program (up to 50 at a time) — including Phase, current status, artifact count, and any prior gap analysis results
2. A ranked prompt is sent to Claude Sonnet 4.6, which produces:
   - A 2-3 sentence executive summary of the program's compliance posture
   - 2-4 recurring gap themes across controls
   - A ranked action list — each entry has: `nist_id`, `priority_rank`, `recommended_action`, `gap_summary`, `confidence`
3. Ranked actions are stored in `sweep_actions` table for review and selective application
4. Controller selects which actions to apply → bulk status updates fire with activity log entries

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/programs/{program_id}/ai-sweep` | Trigger sweep (background, returns immediately) |
| `GET` | `/api/programs/{program_id}/ai-sweep` | List recent sweeps (last 10) |
| `GET` | `/api/programs/{program_id}/ai-sweep/{sweep_id}` | Get sweep results + ranked actions |
| `POST` | `/api/programs/{program_id}/ai-sweep/{sweep_id}/apply` | Apply selected actions (bulk status update) |

### Example Sweep Response

```json
{
  "id": "uuid",
  "status": "ready",
  "control_count": 32,
  "sweep_report": {
    "summary": "Phase 1 is 70% complete. AC and IA families are the primary blockers — 8 of 17 Phase 1 controls lack any evidence. Immediate priority: upload Conditional Access policy and MFA configuration screenshots.",
    "themes": [
      "Missing access control policy documentation (AC family)",
      "No MFA evidence uploaded (IA family)",
      "Audit logging not configured or evidenced (AU family)"
    ]
  },
  "actions": [
    {
      "nist_id": "3.1.1",
      "priority_rank": 1,
      "current_status": "not_implemented",
      "recommended_action": "Upload Entra ID Conditional Access policy export — satisfies AC.L2-3.1.1 through 3.1.3",
      "gap_summary": "No access control policy artifact uploaded. Phase 1 gate blocker — must be satisfied before Phase 2 unlocks.",
      "confidence": 0.91,
      "applied": false
    }
  ]
}
```

### How to Use

1. `POST /api/programs/{program_id}/ai-sweep` — fires in background; response: `{"sweep_id": "uuid", "status": "pending"}`
2. Poll `GET /api/programs/{program_id}/ai-sweep/{sweep_id}` until `status = "ready"` (~30-60s for 30 controls)
3. Review ranked actions — read `gap_summary` and `recommended_action` per control
4. `POST /api/programs/{program_id}/ai-sweep/{sweep_id}/apply` with `{"action_ids": ["uuid1", "uuid2"]}` to bulk-update selected controls to `planned` status
5. Each applied action is logged to `activity_log` with sweep attribution

> **Role gate:** msp_admin, client_admin, super_admin only. client_user receives 403.

---

## Feature 12: Task Queue Inline Copilot (Task Member AI)

**What it does:** Embeds the full RAG-powered Copilot directly inside each task card in the task queue — so contributors get AI guidance on their assigned controls without navigating away from their work list.

**Why it matters:** Previously, a task member assigned to AC.L2-3.1.1 had to click through to the control detail page, find the Copilot tab, and then ask their question. With inline Copilot, the AI meets them where they work — inside their task queue. This is the highest-frequency touchpoint for contributors and the feature most likely to drive daily active use.

### How It Works

- Each task card in `/{orgSlug}/tasks` now has a purple **✦ Copilot** button alongside **Upload Evidence**
- Clicking opens an inline streaming chat panel grounded in:
  - The assigned control's definition + objectives + proof guidance
  - The org's uploaded artifacts for that control (pgvector similarity)
  - NIST SP 800-171A assessment guidance (1,331 chunks across 407 controls)
- One panel open at a time — clicking another card's button closes the previous
- Chat history persists per user per control (same backend as the full Copilot)
- Clicking **Close** collapses the panel without losing history

### How to Use

1. Navigate to `/{orgSlug}/tasks`
2. Find an assigned task — click the purple **✦ Copilot** button on the card
3. Type your question directly: *"What evidence do I need to satisfy this?"* / *"We use CrowdStrike — what screenshot proves this?"*
4. Response streams in real-time; ask follow-ups
5. Click **Upload Evidence** when ready to upload artifacts based on the guidance

### Typical Contributor Flow

```
Task queue loads → see 5 assigned controls
→ Click ✦ Copilot on "AC.L2-3.1.1 (Assigned, due in 3 days)"
→ Ask: "We use Azure AD — what exactly do I need to screenshot?"
→ Copilot: "Upload a screenshot of your Conditional Access policy list
   showing all policies applied to CUI-accessing users. The assessor
   needs to see policy names, enforcement mode, and target groups.
   Your existing 'MFA-Required-CUI' policy (seen in artifact a3f2...) 
   already covers objectives [a] and [b] — you just need [c]: 
   the audit log showing a failed login attempt was blocked."
→ Contributor uploads targeted screenshot → evidence assessed automatically
```

> **No additional API calls required** — the inline Copilot reuses the existing `/api/controls/program/{program_id}/{control_id}/chat` streaming endpoint. Both `program_id` and `program_control.id` are already present in the `GET_MY_ASSIGNMENTS` GraphQL query.

---

## Test Coverage

**353 tests · 0 failures · 22.44 seconds runtime · 36 test files**

Every router, service, and workflow integration is covered. The test suite runs in CI on every commit and is a hard gate before deployment.

| Test File | Tests | Coverage Area |
|-----------|-------|---------------|
| `test_analytics.py` | 8 | MSP portfolio analytics endpoint, role enforcement, SPRS histogram |
| `test_audit.py` | 10 | Audit package creation, status polling, download URL generation |
| `test_copilot_service.py` | 8 | RAG retrieval, embedding search, context assembly |
| `test_copilot_endpoints.py` | 10 | Chat API, history retrieval, SSE streaming |
| `test_docx_service.py` | 6 | DOCX generation from Markdown, template application |
| `test_drift_service.py` | 10 | Embedding comparison, drift threshold, diff summary generation |
| `test_drift_endpoints.py` | 8 | Drift flag retrieval, dismiss endpoint, batch check |
| `test_email_service.py` | 8 | Email template rendering, Resend API calls, preference enforcement |
| `test_freshness.py` | 8 | Threshold calculation per family, stale detection, notification trigger |
| `test_gap_analysis.py` | 10 | Objective decomposition, vector retrieval, gap output structure |
| `test_integrations_router.py` | 12 | All 6 integration endpoints, credential storage, sync trigger |
| `test_integration_service.py` | 10 | Per-provider sync logic, artifact creation, assessment trigger |
| `test_notifications_router.py` | 8 | Preference CRUD, unsubscribe token validation |
| `test_policy_draft_service.py` | 8 | Context assembly, prompt construction, DOCX output |
| `test_policy_draft_endpoints.py` | 10 | Draft trigger, list, review (approve/reject) |
| `test_ssp_interview.py` | 12 | Interview creation, pre-population, generation, commit flow |
| `test_sweep.py` | 12 | Sweep creation (202 async), list, get detail, apply bulk actions, role gate, service unit test |
| `test_artifacts_router.py` | 9 | Upload, presigned URL, status check, drift dismiss |
| `test_assessments_router.py` | 17 | Verdict retrieval, MSP override, confidence scoring |
| `test_assignments_router.py` | 21 | Assignment CRUD, state machine transitions, role enforcement |
| `test_controls_router.py` | 4 | Control list, filter by phase/family/status, PATCH trigger |
| `test_orgs_router.py` | 8 | Org creation, onboarding trigger |
| `test_programs_router.py` | 21 | Program CRUD, SPRS retrieval, freshness, sweep endpoints |
| `test_reports_router.py` | 15 | SSP PDF, POA&M PDF generation, download URL |
| `test_webhooks_router.py` | 5 | n8n callback handling, assessment-complete, secret enforcement |
| `test_sprs_service.py` | 7 | SPRS formula, FAR & Above scoring, SSP gate rule |
| `test_minio_service.py` | 11 | Presigned URL generation, bucket operations |
| `test_embeddings_service.py` | 12 | Chunk embedding, cosine similarity search |
| `test_extraction_service.py` | 7 | PDF, DOCX, image text extraction |
| `test_n8n_service.py` | 10 | Webhook trigger construction, retry logic |
| `test_authentik_service.py` | 8 | JWT validation, claim extraction, invite flow |
| `test_health.py` | 2 | Health endpoint, DB connectivity check |
| `test_deps.py` | 10 | Auth dependency injection, role checking |
| `test_invites_router.py` | 13 | Invite token creation, 72h expiry, role assignment |
| `test_suggestions_router.py` | 7 | RAG cross-control suggestions, apply suggestion |
| `test_msps_router.py` | 8 | MSP CRUD, admin management |

```bash
# Run full test suite
cd /opt/cmmc/fastapi
pytest tests/ -v

# Run specific feature tests
pytest tests/test_copilot_endpoints.py tests/test_copilot_service.py -v

# Run with coverage report
pytest tests/ --cov=app --cov-report=html
```

---

## Deployment & Operations

### Prerequisites

| Requirement | Specification |
|------------|---------------|
| OS | Ubuntu 24.04 LTS |
| CPU | 8 vCores minimum (16 recommended for LLM workloads) |
| RAM | 32 GB minimum (64 GB recommended) |
| Disk | 500 GB SSD (1 TB for large artifact volumes) |
| Network | Port 80 and 443 only exposed to internet |
| Domain | Wildcard DNS for `*.yourdomain.com` pointing to VM IP |
| Cloudflare | DNS API token for TLS certificate challenge |

### Required Environment Variables

```bash
# Core domains
DOMAIN=cmmc.yourdomain.com

# PostgreSQL
POSTGRES_USER=cmmc_user
POSTGRES_PASSWORD=<strong_random>
POSTGRES_DB=cmmc_main

# Redis
REDIS_PASSWORD=<strong_random>

# MinIO
MINIO_ACCESS_KEY=<access_key>
MINIO_SECRET_KEY=<strong_random>

# Authentik
AUTHENTIK_SECRET_KEY=<strong_random>
AUTHENTIK_CLIENT_ID=<from_authentik_ui>
AUTHENTIK_CLIENT_SECRET=<from_authentik_ui>

# Hasura
HASURA_GRAPHQL_ADMIN_SECRET=<strong_random>
HASURA_GRAPHQL_JWT_SECRET={"type":"RS256","jwks_uri":"https://auth.yourdomain.com/application/o/cmmc-app/jwks/"}

# n8n
N8N_ENCRYPTION_KEY=<strong_random>
N8N_EXECUTIONS_MODE=queue

# AI APIs
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM_ADDRESS=compliance@yourdomain.com

# Security
WEBHOOK_SECRET=<strong_random>     # n8n → FastAPI internal webhooks

# Next.js
NEXTAUTH_SECRET=<strong_random>
NEXTAUTH_URL=https://app.yourdomain.com
```

### Service Startup Order

```
1. postgres          — all services depend on this
2. redis             — n8n queue + Authentik sessions
3. minio             — artifact storage
4. minio-init        — creates buckets (runs once, exits)
5. authentik-server
   authentik-worker
6. fastapi
7. hasura
8. n8n
   n8n-worker
9. nextjs
10. traefik          — last: exposes everything to internet
```

### Database Migrations (First Deploy)

```bash
# Run in order:
psql -U cmmc_user -d cmmc_main -f postgres/migrations/001_core_schema.sql
psql -U cmmc_user -d cmmc_main -f postgres/migrations/002_controls_seed.sql
psql -U cmmc_user -d cmmc_main -f postgres/migrations/003_indexes.sql
psql -U cmmc_user -d cmmc_main -f postgres/migrations/004_pgvector_setup.sql
psql -U cmmc_user -d cmmc_main -f postgres/migrations/005_nist_171a_chunks.sql
```

Migration 005 seeds the 1,331 NIST SP 800-171A assessment guide chunks used by the copilot RAG system. This takes 2-3 minutes.

### n8n Workflow Import

```bash
# Import all 14 workflows after n8n is healthy:
for f in /opt/cmmc/n8n/workflows/*.json; do
  curl -X POST http://localhost:5678/rest/workflows \
    -H "Content-Type: application/json" \
    -u "$N8N_ADMIN_EMAIL:$N8N_ADMIN_PASSWORD" \
    -d @$f
done
# Activate each workflow via the n8n UI or:
curl -X POST http://localhost:5678/rest/workflows/{id}/activate \
  -u "$N8N_ADMIN_EMAIL:$N8N_ADMIN_PASSWORD"
```

### Health Checks

```bash
curl https://api.yourdomain.com/health              # FastAPI → {"status":"healthy"}
curl https://gql.yourdomain.com/healthz             # Hasura  → "OK"
curl https://app.yourdomain.com/api/health          # Next.js → {"status":"healthy"}
curl http://localhost:9000/minio/health/live         # MinIO   → HTTP 200
curl http://localhost:5678/healthz                   # n8n     → HTTP 200
```

### Backup Strategy

| Target | Method | Frequency | Retention |
|--------|--------|-----------|-----------|
| PostgreSQL | `pg_dump` → MinIO `cmmc-backups` | Daily 02:30 UTC | 30 days |
| MinIO data | VM snapshot or `rclone` to offsite | Weekly | 4 weeks |
| `.env` file | Encrypted offsite backup | On change | Indefinite |

### Operational Runbooks

**Assessment pipeline stuck?**
1. Check n8n Workflow 07 logs (hung-assessment guard runs every 15 min)
2. Query: `SELECT id, assessment_status, assessment_attempts, last_attempted_at FROM artifacts WHERE assessment_status = 'processing'`
3. If attempts < 3 and guard hasn't reset: manually set `assessment_status = 'pending'` and trigger Workflow 02

**SPRS score not updating?**
1. Check `pg_notify` trigger is active: `SELECT * FROM pg_trigger WHERE tgname = 'program_control_status_changed'`
2. Check n8n Workflow 03 execution logs
3. Manually trigger: `POST /api/sprs/{program_id}/recalculate`

**pgvector search returning poor copilot results?**
1. Verify 1,331 NIST chunks are seeded: `SELECT COUNT(*) FROM nist_chunks`
2. Check `artifact_chunks` table has embeddings: `SELECT COUNT(*) FROM artifact_chunks WHERE embedding IS NOT NULL`
3. Rerun extraction and embedding for specific artifacts via: `POST /api/artifacts/{id}/reembed`

---

## Pricing & Packaging

The following tiers are suggested for an MSP going to market with this platform. Adjust based on your cost structure and target client size.

### Recommended Tier Structure

#### Tier 1 — Starter | $1,500/month per client org
Best for: Small DIB contractors, < 50 employees, single CUI system

**Includes:**
- Full 110-control compliance program (one program/system)
- AI artifact assessment (unlimited uploads)
- SPRS scoring and POA&M
- SSP and POA&M PDF export
- Email notifications
- Up to 5 user seats
- MSP managed service: monthly check-in, assessment reviews

**Not included:** Copilot, policy generation, integrations, portfolio analytics (MSP-side features), gap synthesis, Program AI Sweep, task queue Copilot

---

#### Tier 2 — Professional | $3,500/month per client org
Best for: Mid-size DIB contractors, 50-500 employees, 1-3 CUI systems

**Includes everything in Starter, plus:**
- Per-control AI Copilot (conversational RAG)
- **Task Queue Inline Copilot** — AI guidance inside each contributor's work list
- AI Policy Draft Generation (up to 30 policies)
- Gap Synthesis analysis
- Evidence Freshness Monitoring
- Evidence Drift Detection
- C3PAO Audit Package Export
- Up to 3 programs (systems/SSPs)
- Up to 25 user seats
- Quarterly MSP compliance review call

---

#### Tier 3 — Enterprise | $7,500/month per client org
Best for: Large DIB contractors, 500+ employees, complex multi-system environments

**Includes everything in Professional, plus:**
- SSP Narrative Generation (interview-driven)
- **Program AI Sweep** — one-click portfolio triage, ranked action plan, bulk status apply
- All 6 Evidence Source Integrations (Entra ID, Okta, Defender, CrowdStrike, M365, Splunk)
- Unlimited programs
- Unlimited user seats
- White-glove onboarding (MSP conducts scoping session, configures integrations)
- Monthly MSP compliance review call
- Priority assessment SLA (< 4 hours for artifact assessments)
- Direct escalation to C3PAO partner for final assessment scheduling

---

#### MSP Operator License | $500/month (flat, per MSP)
Required for MSP to operate the platform. Includes:
- MSP portfolio analytics dashboard (cross-client SPRS, top failing controls, weekly activity)
- Program AI Sweep access across all managed orgs
- Unlimited client org management
- Super admin access
- Platform updates and bug fixes
- Access to n8n workflow updates and new feature releases

---

### Unit Economics Reference

| Cost Driver | Approximate Cost |
|-------------|-----------------|
| Anthropic API (artifact assessment) | ~$0.002-0.008 per artifact |
| Anthropic API (copilot query) | ~$0.005-0.015 per query |
| Anthropic API (policy draft) | ~$0.05-0.20 per policy |
| Anthropic API (gap synthesis, per control) | ~$0.01-0.05 per analysis |
| Anthropic API (program AI sweep, 30 controls) | ~$0.05-0.15 per sweep |
| Resend (email) | ~$0.001 per email |
| VM hosting (32 GB RAM) | ~$200-400/month total |
| MinIO storage | ~$0.02/GB/month |

At 10 client orgs on Professional tier, monthly Anthropic costs are typically $50-150. Margins are high. The primary cost is MSP labor for onboarding and review — which this platform reduces by approximately 60-70% vs. manual processes. The Program AI Sweep alone typically saves 2-4 hours of MSP review time per client per quarter.

---

## Glossary

| Term | Definition |
|------|-----------|
| CMMC | Cybersecurity Maturity Model Certification — DoD contractor cybersecurity framework, required for contracts involving CUI |
| NIST 800-171 | National Institute of Standards and Technology Special Publication 800-171 — the 110-control standard that CMMC Level 2 maps to exactly |
| CUI | Controlled Unclassified Information — the data being protected (technical specifications, contracts, export-controlled data) |
| SPRS | Supplier Performance Risk System — DoD database where contractors submit their compliance scores |
| SSP | System Security Plan — the primary compliance document; describes the system, its environment, and how each control is implemented |
| POA&M | Plan of Action & Milestones — documents unimplemented controls with remediation timelines and resource estimates |
| C3PAO | Certified Third-Party Assessment Organization — the auditors who conduct CMMC Level 2 assessments |
| DIB | Defense Industrial Base — the ~80,000 U.S. defense contractors subject to CMMC requirements |
| FAR & Above | Phased implementation framework from the CMMC Information Institute — organizes the 110 controls into 5 sequential phases |
| CAGE Code | Commercial and Government Entity code — unique DoD contractor identifier required for SPRS submission |
| DFARS | Defense Federal Acquisition Regulation Supplement — the acquisition clause that mandates CMMC compliance |
| Program | One SSP per system per org; a client with two separate CUI systems has two programs |
| Artifact | Evidence file uploaded to prove a control is implemented (policy document, screenshot, config export, report) |
| Assessment | Claude's structured verdict on whether an artifact satisfies a control: pass / partial / fail |
| Phase Gate | Phase N+1 controls locked until all Phase N controls reach fully_implemented status |
| Verdict | Claude's assessment result — pass (control complete), partial (partially satisfied), fail (not satisfied) |
| MSP | Managed Service Provider — the operator of this platform, providing CMMC compliance as a managed service |
| Org | An MSP client organization — one tenant in the multi-tenant platform |
| pgvector | PostgreSQL extension enabling vector similarity search — used for RAG in the copilot and gap synthesis features |
| RAG | Retrieval-Augmented Generation — querying a vector database for relevant context before sending to the LLM |
| Drift | When an artifact's content has changed materially since it was assessed — detected via cosine distance between embeddings |
| Freshness | Whether evidence is still current based on family-specific expiry thresholds |

---

*CMMC Compliance OS — Built by Onnex AI Agency*  
*Platform: https://app.cmmc4msp.on-nex.us*  
*Contact: mrtmaharaj@gmail.com*
