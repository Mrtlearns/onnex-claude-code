# A5 — SSP Narrative Generation via Conversational Interview

## Status: Planned | Priority: M–L (1–2 weeks) | Sprint: Q3

---

## Problem Statement

The System Security Plan (SSP) is the central document of a CMMC assessment. C3PAO assessors read it first. It must tell the story of how the organization protects Controlled Unclassified Information (CUI): what their systems are, where CUI flows, how they've implemented each control, and who is responsible.

The five SSP narrative fields in the platform today (`ssp_system_description`, `ssp_environment_of_operation`, `ssp_information_types`, `ssp_security_requirements`, `ssp_interconnections`) are optional strings on the `programs` table. In practice they are always "Not yet provided." The platform generates beautiful PDF shells with empty bodies.

The reason: writing these sections requires compliance knowledge and knowledge of the org's environment. The typical client doesn't have a compliance writer on staff. The MSP charges $2,000–5,000 to draft an SSP manually. It takes days.

This feature replaces that with a 15-minute conversational interview that extracts the information from the client in plain English, grounds it in the inventory tables (which may be partially populated), and produces professionally-written, NIST-citation-backed narrative sections that are ready for MSP review and C3PAO submission.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To complete an SSP interview in one sitting | I have all narrative sections drafted within a day |
| US-02 | Client admin | To answer questions in plain English, not NIST jargon | I don't need a compliance background to participate |
| US-03 | MSP admin | To review each narrative section before it's saved | I maintain quality control over what goes into the C3PAO document |
| US-04 | MSP admin | To regenerate specific sections with different interview answers | I can refine without starting the whole interview over |
| US-05 | Client admin | To see the generated narrative before committing it | I can verify it's accurate before the MSP reviews it |
| US-06 | Platform | To pre-populate questions with answers from inventory tables | The interview is shorter when data already exists |
| US-07 | MSP admin | To edit the narrative directly (not just approve/reject) | I can make small corrections without re-running the interview |

---

## Technical Design

### Interview Structure

**15 questions across 5 sections, branching based on previous answers:**

**Section 1: System Overview (→ ssp_system_description)**
1. "What is the primary purpose of the system covered by this SSP? In a sentence or two, describe what it does."
2. "What does this system allow your organization to do that relates to your DoD work or contracts?"
3. "How many users interact with this system, and what are their primary roles? (e.g., 'engineers, project managers, admins')"
4. "Is this a single system or a collection of systems/applications that work together?"

**Section 2: Environment of Operation (→ ssp_environment_of_operation)**
5. "Where is your system hosted? (On-premises servers, cloud like Azure/AWS/GCP, or a mix?)"
6. "Walk me through how an employee accesses the system — from sitting at their desk to getting to their work."
7. "Are there any remote access scenarios? VPN, remote desktop, work-from-home?"
8. "What physical locations house your systems or the people who use them?"

**Section 3: CUI Information Types (→ ssp_information_types)**
9. "What types of information does this system handle that relate to your DoD contracts? (e.g., drawings, specifications, test results, proposals)"
10. "Does this system create, store, process, or transmit technical data — like engineering drawings or performance specs?"

**Section 4: Security Requirements (→ ssp_security_requirements)**
11. "How do employees log in to the system? Username/password only, or multi-factor authentication?"
12. "Who is responsible for IT security in your organization? Is it an internal IT person, or a managed service provider like us?"
13. "What happens when someone leaves the organization — how quickly are their accounts disabled?"

**Section 5: Interconnections (→ ssp_interconnections)**
14. "Does your system connect to or share information with any other systems — like a cloud storage service, a client portal, or a subcontractor's network?"
15. "Do any of your systems receive automatic software updates from external sources?"

### Narrative Generation Prompts (one per SSP section)

**Example — System Description:**
```
Based on the following interview answers, write a professional System Description 
section for a NIST SP 800-171 System Security Plan.

ORGANIZATION: {org_name} | CAGE Code: {cage_code}
PROGRAM: {program_name} | System: {system_name}

INVENTORY CONTEXT:
- Hardware assets: {hardware_count} assets including {hardware_examples}
- Software: {software_examples}
- Cloud services: {cloud_services}
- Team size: ~{user_count} users

INTERVIEW ANSWERS:
Q1 (System purpose): "{answer_1}"
Q2 (DoD work relationship): "{answer_2}"
Q3 (Users and roles): "{answer_3}"
Q4 (Single vs. collection): "{answer_4}"

REQUIREMENTS:
- 200–400 words
- Professional, formal tone appropriate for DoD documentation
- Reference the organization name and system name explicitly
- Do not fabricate specific technical details not provided in the interview answers
- Do not use the phrase "it should be noted" or passive constructions
- End with a sentence about the organization's commitment to protecting CUI

Write the System Description section now.
```

Model: `anthropic/claude-sonnet-4-6` — high quality needed for C3PAO-facing prose.

### Data Model Changes

**New table: `ssp_interviews`**

```sql
CREATE TABLE ssp_interviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    started_by      UUID NOT NULL REFERENCES users(id),
    status          TEXT DEFAULT 'in_progress',  -- in_progress | completed | abandoned
    responses       JSONB DEFAULT '{}',  -- { "q1": "...", "q2": "...", ... }
    generated_sections JSONB DEFAULT '{}',  -- { "system_description": "...", ... }
    sections_reviewed JSONB DEFAULT '{}',   -- { "system_description": "approved" | "rejected" | null }
    reviewer_notes  JSONB DEFAULT '{}',
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**No new columns on `programs`** — `ssp_system_description`, `ssp_environment_of_operation`, etc. already exist (added in initial migration). The interview writes to these columns upon MSP approval.

### FastAPI Changes

**New router: `app/routers/ssp_interview.py`**

```
POST   /api/programs/{program_id}/ssp-interview
    # Start a new interview session. Returns interview_id + first question set.
    # Pre-populates answers from inventory tables where available.

GET    /api/programs/{program_id}/ssp-interview/{interview_id}
    # Get current interview state (responses so far, which sections completed)

PATCH  /api/programs/{program_id}/ssp-interview/{interview_id}
    # Submit answers for one section. Returns next question set (or "complete").
    # Body: { "section": "system_overview", "responses": { "q1": "...", "q2": "..." } }

POST   /api/programs/{program_id}/ssp-interview/{interview_id}/generate
    # Generate narrative for a specific section (or all sections)
    # Body: { "sections": ["system_description", "environment"] }
    # Background task. Returns immediately.

GET    /api/programs/{program_id}/ssp-interview/{interview_id}/preview
    # Get all generated narratives for preview before MSP review

POST   /api/programs/{program_id}/ssp-interview/{interview_id}/review
    # MSP admin: approve/reject each section with notes
    # Body: { "section": "system_description", "decision": "approved", "notes": "" }

POST   /api/programs/{program_id}/ssp-interview/{interview_id}/commit
    # MSP admin: commit all approved sections to programs.ssp_* columns
    # Also writes to activity_log: "SSP narratives generated via AI interview"
```

**New service: `app/services/ssp_interview_service.py`**

```python
async def generate_section(
    section: str,           # 'system_description' | 'environment' | 'cui_types' | 'requirements' | 'interconnections'
    interview: dict,        # full interview record including responses
    program: dict,          # program + org data
    conn: asyncpg.Connection,
) -> str:
    """
    Builds section-specific prompt.
    Calls OpenRouter (claude-sonnet-4-6).
    Returns generated narrative text.
    """

async def pre_populate_from_inventory(program_id: UUID, conn: asyncpg.Connection) -> dict:
    """
    Returns a dict of pre-populated question answers derived from:
    - hardware_inventory (asset types, OS, locations)
    - software_inventory (software names)
    - cloud_services_inventory (provider names)
    - program.system_name
    - users count
    """
```

### Frontend Changes

**New page: `/[orgSlug]/programs/[programId]/ssp-interview`**

**Step 1 — Introduction:**
"We'll ask you 15 questions about your systems and security practices. Your answers will be used to draft the System Security Plan sections required for CMMC assessment. This takes about 15–20 minutes."

**Step 2 — Sectioned questionnaire:**
- One section at a time (5 sections × 2-4 questions)
- Progress bar: "Section 2 of 5 — Environment of Operation"
- Pre-populated answers shown in light grey (from inventory) — user can accept or override
- Free-text inputs (no multiple choice — narrative quality depends on free text)
- "Save and continue" → moves to next section
- Can navigate back to previous sections

**Step 3 — Generation:**
- "Generating your SSP narratives..." spinner
- Background: parallel OpenRouter calls for all 5 sections
- Takes ~30s; polls status

**Step 4 — Preview:**
- Side-by-side view: left = interview answers, right = generated narrative
- Regenerate button per section (re-runs that section's generation with same answers)
- "Submit for MSP Review" button → marks interview status = 'awaiting_review'

**Step 5 — MSP Review (MSP admin only):**
- Section-by-section review: "Approve" or "Reject with notes"
- Inline editing of the narrative text (rich text editor — simple, no markdown)
- "Commit All Approved Sections" → writes to programs.ssp_* and redirects to reports page

**Integration with Reports page:**
- SSP PDF generation is already implemented
- After commit, the SSP PDF will now include the full narrative sections (no more "Not yet provided.")
- Reports page shows "SSP Narratives: Complete ✅" or "Incomplete — Start Interview"

---

## Diff Preview (Re-run Scenario)

If narratives were previously committed and the user re-runs the interview:
- Show a diff view: old narrative vs. new draft, highlighted changes
- MSP must explicitly approve the replacement to avoid accidental overwrite

---

## Implementation Phases

**Phase 1 (Days 1-3):** DB migration (ssp_interviews). FastAPI router (start, patch answers, generate). `ssp_interview_service.py` (5 section prompts + generation). Pre-population from inventory.

**Phase 2 (Days 4-5):** FastAPI review + commit endpoints. Activity log entries. Integration test: full interview → generate → commit → SSP PDF contains narratives.

**Phase 3 (Week 2):** Frontend questionnaire flow (5 sections, progress bar, pre-fill). Preview page. MSP review UI. Diff view for re-runs. Full E2E test with Canopy Aerospace program.

---

## Acceptance Criteria

- [ ] Interview pre-populates answers from hardware/software/cloud inventory
- [ ] All 5 narrative sections generate in <45s total (parallel calls)
- [ ] Generated system_description is 200–400 words and references org name and system name
- [ ] Generated narratives do not contain fabricated specific technical details
- [ ] MSP review step blocks commit without approval
- [ ] Committed narratives appear in the SSP PDF (no "Not yet provided.")
- [ ] Diff view appears when re-running interview after commit
- [ ] activity_log records the narrative commit event with user_id
- [ ] Regenerating a single section doesn't overwrite other sections
- [ ] 403 if client_admin attempts to access another org's interview
- [ ] All existing pytest tests still pass
