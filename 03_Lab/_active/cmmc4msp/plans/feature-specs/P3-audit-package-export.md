# P3 — C3PAO Audit-Package Export + Evidence Chain-of-Custody

## Status: Planned | Priority: M (1 week) | Sprint: Q2

---

## Problem Statement

The end goal of CMMC compliance isn't a green dashboard — it's passing a C3PAO (Certified Third-Party Assessment Organization) audit. Today, the platform generates SSP and POA&M PDFs, but a C3PAO assessor needs much more than those two documents:

- Every piece of evidence (artifacts) for every control, in their original form
- Cryptographic proof that artifacts haven't been tampered with since upload
- A complete timeline of who did what, when, and why (chain of custody)
- Evidence that humans (not just AI) reviewed and approved the assessments
- A manifest tying every artifact to the specific control objectives it was assessed against

Without this, the platform is a compliance *management* tool but not a compliance *audit* tool. Adding audit-package export closes that gap and directly supports the C3PAO conversation: "Here's everything your assessor needs, packaged and signed."

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To generate a complete audit package with one click | I have everything my C3PAO needs in a single artifact |
| US-02 | MSP admin | To review the audit package before handing it to the assessor | I can quality-check the evidence bundle |
| US-03 | C3PAO assessor | To receive a read-only portal link that expires after 30 days | I can review evidence without being given platform credentials |
| US-04 | Client admin | To see the SHA-256 hash of each artifact in the package | I can prove artifacts are unmodified since upload |
| US-05 | MSP admin | To include all `activity_log` events per control in the package | Auditors can see the full change history, not just the final state |
| US-06 | Client admin | To know when the package was generated and who generated it | The manifest is itself evidence of when attestation occurred |
| US-07 | Any | To download the package as a single zip file | I can deliver it via email, USB, or assessor portal |

---

## Technical Design

### Audit Package Structure

```
audit_package_{org_slug}_{program_name}_{YYYYMMDD}/
├── MANIFEST.json                          # SHA-256 of every file + generation metadata
├── MANIFEST.txt                           # Human-readable version of manifest
├── ssp_{timestamp}.pdf                    # System Security Plan
├── poam_{timestamp}.pdf                   # Plan of Action & Milestones
├── controls/
│   ├── AC.L2-3.1.1/
│   │   ├── control_summary.json           # status, score, implementation notes, objectives
│   │   ├── assessment_history.json        # all assessments (AI + overrides) with timestamps
│   │   ├── activity_log.json             # all activity_log events for this control
│   │   ├── artifacts/
│   │   │   ├── {artifact_id}_policy.pdf   # original artifact file from MinIO
│   │   │   └── {artifact_id}_assessment.json  # assessment verdict + rationale
│   │   └── assignments.json              # assignment events, transitions, who did what
│   └── ... (one folder per control)
├── inventory/
│   ├── hardware.json
│   ├── software.json
│   └── cloud_services.json
└── signatures/
    └── package_signature.json            # HMAC-SHA256 of MANIFEST.json using server key
```

### MANIFEST.json Schema

```json
{
  "schema_version": "1.0",
  "package_id": "uuid",
  "generated_at": "2026-04-17T14:30:00Z",
  "generated_by": { "user_id": "...", "email": "...", "role": "msp_admin" },
  "program": { "id": "...", "name": "...", "org_name": "...", "sprs_score": -47 },
  "files": [
    {
      "path": "controls/AC.L2-3.1.1/artifacts/abc123_policy.pdf",
      "sha256": "e3b0c44298fc1c149afbf4c8996fb924...",
      "size_bytes": 204800,
      "artifact_id": "abc123",
      "uploaded_at": "2026-02-14T09:22:00Z",
      "uploaded_by": "user@acme.com",
      "assessed_verdict": "partial",
      "assessed_confidence": 0.78
    }
  ],
  "controls_summary": {
    "total": 110,
    "fully_implemented": 43,
    "partially_implemented": 27,
    "not_implemented": 32,
    "not_applicable": 8
  }
}
```

### Data Model Changes

**New table: `audit_packages`**

```sql
CREATE TABLE audit_packages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    generated_by    UUID NOT NULL REFERENCES users(id),
    minio_key       TEXT NOT NULL,          -- path in cmmc-reports bucket
    manifest_hash   TEXT NOT NULL,          -- SHA-256 of MANIFEST.json
    controls_count  INT,
    files_count     INT,
    size_bytes      BIGINT,
    status          TEXT DEFAULT 'generating',  -- generating | ready | error
    assessor_token  TEXT UNIQUE,            -- time-limited read-only access token
    assessor_token_expires_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**New table: `artifact_approvals`** (for policy sign-off, referenced in audit package)

```sql
CREATE TABLE artifact_approvals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    artifact_id     UUID NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
    approved_by     UUID NOT NULL REFERENCES users(id),
    role_at_time    TEXT NOT NULL,
    notes           TEXT,
    approved_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### FastAPI Changes

**New endpoints in `app/routers/reports.py`:**

```
POST   /api/reports/{program_id}/audit-package     # generate (async, background task)
GET    /api/reports/{program_id}/audit-packages    # list all generated packages
GET    /api/reports/audit-packages/{package_id}   # status + download URL
DELETE /api/reports/audit-packages/{package_id}   # delete package
POST   /api/reports/audit-packages/{package_id}/assessor-link  # generate time-limited link
GET    /api/reports/assessor/{token}              # public: download package if token valid
```

**New service: `app/services/audit_package_service.py`**

```python
async def generate_audit_package(
    program_id: str,
    generated_by_user_id: str,
    conn: asyncpg.Connection,
    minio_client: Minio,
) -> str:
    """
    Background task. Assembles all components:
    1. Fetch SSP + POA&M from report_service (reuse existing)
    2. For each program_control: fetch artifacts from MinIO, assessment history,
       activity_log events, assignment events
    3. Stream artifacts directly from MinIO (no full load into RAM)
    4. Build zipfile in memory chunks (use zipfile.ZipFile with BytesIO)
    5. Compute SHA-256 of each file as added
    6. Generate MANIFEST.json with all hashes
    7. Upload zip to MinIO: cmmc-reports/{program_id}/audit_{timestamp}.zip
    8. Update audit_packages record status='ready'
    Returns: audit_package.id
    """
```

**Key implementation detail — streaming ZIP:** For large evidence sets, don't load all artifacts into RAM. Use `zipfile.ZipFile` writing to a `BytesIO`, and stream artifacts from MinIO one-by-one using `download_bytes()` from `minio_service.py`.

**Assessor portal:**
- `POST /api/reports/audit-packages/{id}/assessor-link` generates a 30-day HMAC token, stores in `audit_packages.assessor_token`
- `GET /api/reports/assessor/{token}` validates expiry, returns presigned download URL for the zip
- No auth required — token is the credential

### Frontend Changes

**Reports page (`/[orgSlug]/reports/page.tsx`):**
- New "Audit Package" section below SSP/POA&M
- "Generate Audit Package" button → shows progress spinner (polls status endpoint every 5s)
- Package history table: generated_by, generated_at, size, controls_count, Download + Share buttons
- "Share with Assessor" → generates link, shows copy-to-clipboard modal with 30-day expiry notice

**Control detail (`/[orgSlug]/controls/[id]/page.tsx`):**
- "Approve" button on each artifact → writes to `artifact_approvals`
- Approved artifacts show approval badge with approver name + timestamp

---

## Chain of Custody Detail

Each control folder in the audit package includes `activity_log.json` with every event from the existing `activity_log` table, filtered to that control's `program_control_id`. Events include:

- Control status changes (with who + when)
- Artifact uploads (who uploaded, from what IP if logged)
- Assessment results (AI verdict + timestamp + model used)
- MSP override events (who overrode, original verdict → new verdict, notes)
- Assignment events (assigned to whom, due date set, transitions)
- Phase unlock events

This creates an immutable, time-ordered record that a C3PAO can walk through to verify the compliance journey.

---

## Security Considerations

- ZIP file SHA-256 hash stored in `audit_packages.manifest_hash` — any download can be verified
- `MANIFEST.json` itself is hashed and signed with an HMAC using `settings.audit_signing_key` (new env var)
- Assessor token is a random 64-byte hex string; no JWT (no expiry bypass via clock manipulation)
- Assessor token grants read-only access to the specific package only — not to the org's live data
- Package generation is logged in `activity_log`

---

## Implementation Phases

**Phase 1 (Days 1-2):** DB migration. `audit_package_service.py` core assembler. ZIP generation with SHA-256 manifest. Upload to MinIO. Basic FastAPI endpoint.

**Phase 2 (Day 3):** Assessor token system. Public download endpoint. Frontend reports page updates.

**Phase 3 (Day 4-5):** Activity log inclusion per control. Artifact approvals (sign-off UX). Polish: progress polling, error handling, package size display.

---

## Acceptance Criteria

- [ ] Audit package generates in <60s for a program with 110 controls and 50 artifacts
- [ ] Every artifact file in the zip matches its SHA-256 in MANIFEST.json
- [ ] Package includes SSP, POA&M, all artifacts, all assessments, activity logs
- [ ] Assessor link works without platform login and expires after 30 days
- [ ] `artifact_approvals` records approval with role and timestamp
- [ ] Package listed in package history with size, date, generated_by
- [ ] Package generation is non-blocking (background task — API returns immediately)
- [ ] Failed generation sets status='error' with error detail
- [ ] All existing pytest tests still pass
