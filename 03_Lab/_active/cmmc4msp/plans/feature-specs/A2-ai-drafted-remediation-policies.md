# A2 — AI-Drafted First-Pass Remediation Policies

## Status: Planned | Priority: M (1 week) | Sprint: Next

---

## Problem Statement

The single biggest blocker in CMMC compliance projects isn't understanding what controls require — it's writing the policies and procedures to satisfy them. A 20-person defense contractor has no compliance department. They need a written Access Control Policy, a Media Protection Procedure, an Incident Response Plan — 30+ documents — and have no idea where to start.

Today's workaround: clients pay their MSP $150–250/hour to draft these documents manually, pulling from generic internet templates and adapting them. This is time-consuming, expensive, and produces boilerplate that often fails C3PAO review because it isn't tailored to the org's actual environment.

An AI that has access to the org's inventory (what systems they run, what cloud services they use, what their team structure looks like) can draft a policy that references their actual environment in 10 seconds. The MSP reviews it, the client approves it, it's uploaded as an artifact and assessed immediately.

This is likely the highest billable-value AI feature in the platform — every policy draft saves 2–4 hours of MSP time.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To click "Generate Draft Policy" on any not-implemented control | I have a starting point in seconds instead of hours |
| US-02 | MSP admin | To review the draft before the client can use it as evidence | Poor drafts don't get assessed and falsely inflate SPRS |
| US-03 | Client admin | To edit the generated DOCX in Word/Google Docs | I can tailor the policy to our actual processes |
| US-04 | Client admin | To upload the edited DOCX directly from the draft page | There's no friction between "reviewed and approved" and "submitted as evidence" |
| US-05 | MSP admin | To regenerate a draft with different parameters | I can refine the output without starting from scratch |
| US-06 | Any | To see that a document is AI-drafted in the activity log | There's a clear audit trail that AI was used and a human reviewed it |
| US-07 | MSP admin | To configure a policy template library | I can add my MSP's preferred policy structure as a starting scaffold |

---

## Technical Design

### Context Assembly for Policy Drafting

The AI draft quality depends entirely on the context it receives. For a given control:

```python
async def build_policy_context(
    program_control_id: UUID,
    conn: asyncpg.Connection,
) -> PolicyContext:
    # 1. Control definition — the "what" to cover
    control = await conn.fetchrow(
        "SELECT cd.*, pc.implementation_notes FROM program_controls pc "
        "JOIN control_definitions cd ON pc.control_definition_id = cd.id "
        "WHERE pc.id = $1", program_control_id
    )

    # 2. Program + org info — names, CAGE codes, system description
    program = await conn.fetchrow(
        "SELECT p.*, o.name AS org_name, o.cage_code, o.primary_contact_name "
        "FROM programs p JOIN orgs o ON p.org_id = o.id "
        "WHERE p.id = (SELECT program_id FROM program_controls WHERE id = $1)",
        program_control_id
    )

    # 3. System inventory — what they're actually running
    hardware = await conn.fetch(
        "SELECT asset_name, asset_type, os, location FROM hardware_inventory "
        "WHERE org_id = $1 LIMIT 20", program["org_id"]
    )
    software = await conn.fetch(
        "SELECT name, version, purpose FROM software_inventory WHERE org_id = $1 LIMIT 20",
        program["org_id"]
    )
    cloud = await conn.fetch(
        "SELECT provider, service_name, purpose FROM cloud_services_inventory WHERE org_id = $1",
        program["org_id"]
    )

    # 4. All objectives for this control (the full decomposition)
    objectives = await conn.fetch(
        "SELECT requirement_text, assessment_objective FROM control_definitions "
        "WHERE nist_id LIKE $1 AND is_objective = TRUE ORDER BY nist_id",
        control["nist_id"] + ".%"
    )

    # 5. NIST implementation guidance
    nist_guidance = await conn.fetch(
        "SELECT chunk_text FROM nist_guide_chunks WHERE nist_id = $1 "
        "AND section IN ('Discussion', 'Implementation', 'Recommendations') ORDER BY chunk_index",
        control["nist_id"]
    )

    # 6. Existing policies from other controls (cross-reference for consistency)
    related_policies = await conn.fetch(
        "SELECT ar.file_name, ar.extracted_text FROM artifacts ar "
        "JOIN program_controls pc ON ar.program_control_id = pc.id "
        "WHERE pc.program_id = (SELECT program_id FROM program_controls WHERE id = $1) "
        "AND ar.assessment_status = 'assessed' LIMIT 3",
        program_control_id
    )

    return PolicyContext(control, program, hardware, software, cloud, objectives, nist_guidance, related_policies)
```

### Policy Generation Prompt

```
You are a CMMC Level 2 compliance policy writer. Generate a complete, professionally written 
policy document for the following organization and control.

ORGANIZATION:
- Name: {org_name}
- CAGE Code: {cage_code}
- System Name: {system_name}
- Hardware assets: {hardware_summary}
- Software stack: {software_summary}
- Cloud services: {cloud_summary}

CONTROL TO ADDRESS:
- NIST ID: {nist_id}
- Requirement: {requirement_text}
- All objectives that must be addressed: {objectives_list}

NIST IMPLEMENTATION GUIDANCE:
{nist_guidance}

EXISTING ORGANIZATIONAL POLICIES (for cross-reference and consistency of terms):
{related_policy_excerpts}

DOCUMENT REQUIREMENTS:
1. Title: "[OrgName] [Policy Type] Policy"  
2. Document number: TBD (leave as placeholder)
3. Revision: 1.0 | Date: {today}
4. Approved by: [APPROVER NAME] (leave as placeholder)
5. Sections: Purpose, Scope, Policy Statements (one per objective), Procedures, 
   Roles and Responsibilities, Exceptions, Review Schedule, References
6. Reference actual systems from the inventory by name
7. Policy statements must directly map to the NIST objectives
8. Use plain English — this is for a small business, not a defense contractor with lawyers
9. Length: 800–1500 words
10. Format: Markdown (will be converted to DOCX)

Generate the complete policy document now.
```

Model: `anthropic/claude-opus-4-7` for this task (high-quality document generation, not chat). Cost: ~$0.05 per draft — negligible.

### Data Model Changes

**New table: `policy_drafts`**

```sql
CREATE TABLE policy_drafts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_control_id  UUID NOT NULL REFERENCES program_controls(id) ON DELETE CASCADE,
    generated_by        UUID NOT NULL REFERENCES users(id),
    status              TEXT NOT NULL DEFAULT 'draft',  -- draft | reviewed | uploaded | rejected
    content_markdown    TEXT NOT NULL,
    content_hash        TEXT,               -- SHA-256 of markdown at generation time
    minio_key           TEXT,               -- path to DOCX in MinIO (after conversion)
    reviewed_by         UUID REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    reviewer_notes      TEXT,
    model_used          TEXT,
    generation_params   JSONB,              -- context snapshot for reproducibility
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### FastAPI Changes

**New endpoints in `app/routers/controls.py`:**

```
POST   /api/controls/program/{program_id}/{control_id}/draft-policy
    # Generate a new draft. Returns draft_id immediately.
    # Background task: generate → save markdown → convert to DOCX → upload to MinIO
    # Returns: { "draft_id": "...", "status": "generating" }

GET    /api/controls/program/{program_id}/{control_id}/draft-policy
    # List all drafts for this control
    # Returns: [{ draft_id, status, created_by, created_at, reviewed_by, reviewed_at }]

GET    /api/controls/program/{program_id}/{control_id}/draft-policy/{draft_id}
    # Get draft content (markdown) + DOCX download URL
    # Returns: { content_markdown, docx_url, status, reviewer_notes }

POST   /api/controls/program/{program_id}/{control_id}/draft-policy/{draft_id}/review
    # MSP admin marks as reviewed (approved or rejected with notes)
    # Body: { "status": "reviewed" | "rejected", "reviewer_notes": "..." }

POST   /api/controls/program/{program_id}/{control_id}/draft-policy/{draft_id}/upload-as-artifact
    # Creates an artifact from the reviewed DOCX (copies from drafts bucket to artifacts bucket)
    # Triggers assessment via existing n8n workflow 02
    # Returns: { "artifact_id": "..." }
```

**New service: `app/services/policy_draft_service.py`**

```python
async def generate_policy_draft(
    program_control_id: UUID,
    generated_by: UUID,
    conn: asyncpg.Connection,
    minio: Minio,
) -> UUID:
    """
    1. Build context (inventory + control + NIST guidance)
    2. Call OpenRouter with claude-opus-4-7
    3. Save markdown to policy_drafts
    4. Convert markdown → DOCX via python-docx
    5. Upload DOCX to MinIO: cmmc-drafts/{program_control_id}/{draft_id}/policy.docx
    6. Update draft status to 'draft'
    7. Notify MSP admin (email via P1) that a draft is ready for review
    Returns draft_id
    """
```

**Markdown → DOCX conversion (`app/services/docx_service.py`):**
```python
def markdown_to_docx(markdown: str, org_name: str, control_id: str) -> bytes:
    """
    Uses python-docx to convert structured markdown to DOCX.
    Applies Onnex/MSP-branded styles: header, body, section headings.
    Includes document metadata: title, author, revision.
    Returns bytes (for MinIO upload).
    """
```

**New MinIO bucket:** `cmmc-drafts` — for policy drafts (separate from `cmmc-artifacts`)

### Frontend Changes

**Control detail page (`/[orgSlug]/controls/[id]/page.tsx`):**
- "Generate Policy Draft" button — only shown for `not_implemented` or `partially_implemented` controls
- Clicking shows a loading spinner ("Drafting your policy... this takes ~15 seconds")
- Draft card appears in new "Policy Drafts" section:
  - Markdown preview (rendered)
  - "Download DOCX" button
  - Status badge: Draft / Awaiting Review (MSP) / Approved / Rejected
  - MSP review notes (if rejected: shows what to fix)
  - "Submit as Evidence" button (enabled only when status = 'reviewed')

**MSP admin view:**
- Draft review queue in MSP dashboard: list of all pending drafts across all orgs
- Each item: org name, control ID, generated by, generated at, "Review" button
- Review modal: full markdown preview, approve/reject with notes, one click

---

## Implementation Phases

**Phase 1 (Days 1-2):** DB migration. `policy_draft_service.py` (context assembly + OpenRouter call + markdown save). `docx_service.py` (markdown → DOCX). FastAPI endpoints (generate + get).

**Phase 2 (Day 3):** MSP review endpoint + notification (email via P1). Upload-as-artifact endpoint (reuses artifacts router logic). `cmmc-drafts` MinIO bucket setup.

**Phase 3 (Days 4-5):** Frontend draft cards. MSP review queue page. "Submit as Evidence" flow. Manual testing across 10 representative controls.

---

## Acceptance Criteria

- [ ] Draft generates in <30s for a control with full inventory context
- [ ] Generated policy references org name, system name, and at least one inventory item by name
- [ ] Every objective for the control has at least one corresponding policy statement
- [ ] DOCX is well-formatted and opens correctly in Word and Google Docs
- [ ] Draft is marked AI-drafted in `activity_log`
- [ ] MSP review step is enforced — client cannot submit draft as evidence without review
- [ ] Rejected draft shows rejection reason to the client
- [ ] Uploading as artifact triggers workflow 02 assessment automatically
- [ ] Generated DOCX artifact assesses successfully (not rejected as unreadable)
- [ ] Generate button is hidden for `fully_implemented` and `not_applicable` controls
- [ ] All existing pytest tests still pass
