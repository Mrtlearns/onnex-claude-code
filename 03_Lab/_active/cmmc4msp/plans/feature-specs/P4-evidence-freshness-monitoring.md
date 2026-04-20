# P4 — Evidence Freshness / Expiry Monitoring + Continuous Re-Assessment

## Status: Planned | Priority: M (4–5 days) | Sprint: Q2

---

## Problem Statement

CMMC is not a one-time certification — it requires ongoing compliance. The DoD's assessment methodology assumes that evidence is current at the time of assessment. Today the platform treats an artifact as permanently valid once assessed: upload a vuln scan in January, get "met," and the control stays green forever even if the scan is now six months old and the organization's posture has changed.

This is an audit failure waiting to happen. C3PAO assessors will ask: "When was this evidence gathered? Is it still representative of your current state?" Without freshness tracking, the platform cannot answer that question.

The evidence currency requirements vary by control family (sourced from NIST SP 800-171A and C3PAO practice guidance):

| Family | Evidence Type | Recommended Max Age |
|--------|--------------|---------------------|
| AU (Audit) | Log samples | 30 days |
| SI (System Integrity) | Vulnerability scan | 30 days |
| CM (Config Mgmt) | Baseline config | 90 days |
| AC (Access Control) | User access review | 90 days |
| IA (Identification & Auth) | MFA enrollment report | 90 days |
| MP (Media Protection) | Media sanitization log | 180 days |
| IR (Incident Response) | IR test results | 365 days |
| AT (Awareness & Training) | Training completion records | 365 days |
| PE (Physical) | Facility access log review | 180 days |
| Policy documents | All policy/procedure docs | 365 days |

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Client admin | To see on the dashboard which controls have stale evidence | I know what to refresh before an audit |
| US-02 | Assigned contributor | To get a warning email 30 days before evidence expires | I have time to gather and upload fresh evidence |
| US-03 | MSP admin | To see a "freshness heat map" across all my clients | I can proactively manage expiry risk across my portfolio |
| US-04 | Platform | To auto-demote a control's status to `stale` when its evidence expires | The SPRS score accurately reflects current posture |
| US-05 | Client admin | To set a custom max-age for a specific control | We have internal policies that are more stringent than the defaults |
| US-06 | Client admin | To see how long until each artifact expires | I can plan my compliance calendar |
| US-07 | Platform | To auto-open a POA&M item when a control goes stale | Stale controls are tracked as remediation items |

---

## Technical Design

### Data Model Changes

**New column on `control_definitions`:**
```sql
ALTER TABLE control_definitions
    ADD COLUMN evidence_max_age_days INT DEFAULT 365;
```

Seeded values (new migration file `014_evidence_freshness.sql`):
```sql
-- AU family: 30 days
UPDATE control_definitions SET evidence_max_age_days = 30
WHERE nist_id LIKE '3.3.%';

-- SI family: 30 days (vuln scans)
UPDATE control_definitions SET evidence_max_age_days = 30
WHERE nist_id LIKE '3.14.%';

-- CM, AC, IA families: 90 days
UPDATE control_definitions SET evidence_max_age_days = 90
WHERE nist_id LIKE '3.4.%' OR nist_id LIKE '3.1.%' OR nist_id LIKE '3.5.%';

-- IR, AT, PE families: 365 days
UPDATE control_definitions SET evidence_max_age_days = 365
WHERE nist_id LIKE '3.6.%' OR nist_id LIKE '3.2.%' OR nist_id LIKE '3.10.%';
```

**New columns on `program_controls`:**
```sql
ALTER TABLE program_controls
    ADD COLUMN evidence_max_age_days_override INT,  -- NULL = use control_definition default
    ADD COLUMN last_evidence_at TIMESTAMPTZ,        -- timestamp of most recent assessed artifact
    ADD COLUMN evidence_expires_at TIMESTAMPTZ,     -- last_evidence_at + max_age_days
    ADD COLUMN stale_since TIMESTAMPTZ;             -- when status demoted to stale
```

**New status value:** Add `'stale'` to the valid status enum used in `program_controls.status`. Status transitions:

```
not_implemented → partially_implemented → fully_implemented
                                        ↘
                                    stale (evidence expired)
                                        ↙
                            (re-upload re-assesses → status restored)
```

**New pg_notify trigger:**
```sql
-- Extend existing status-change trigger to also fire on evidence_expires_at passing
CREATE OR REPLACE FUNCTION notify_sprs_recalc() RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify('sprs_recalc', NEW.program_id::text);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**New view: `program_control_freshness`**
```sql
CREATE VIEW program_control_freshness AS
SELECT
    pc.id,
    pc.program_id,
    cd.nist_id,
    cd.family,
    pc.status,
    pc.last_evidence_at,
    pc.evidence_expires_at,
    COALESCE(pc.evidence_max_age_days_override, cd.evidence_max_age_days) AS max_age_days,
    CASE
        WHEN pc.evidence_expires_at IS NULL THEN 'no_evidence'
        WHEN pc.evidence_expires_at < NOW() THEN 'expired'
        WHEN pc.evidence_expires_at < NOW() + INTERVAL '30 days' THEN 'expiring_soon'
        ELSE 'fresh'
    END AS freshness_status,
    EXTRACT(DAY FROM (pc.evidence_expires_at - NOW())) AS days_until_expiry
FROM program_controls pc
JOIN control_definitions cd ON pc.control_definition_id = cd.id;
```

### n8n Changes

**New Workflow 13 — Evidence Freshness Monitor (nightly cron):**

```
Trigger: Cron — daily 01:00 UTC

Step 1: PostgreSQL — find all stale controls
  SELECT pc.id, pc.program_id, pc.status, p.org_id, p.name, cd.nist_id, cd.family,
         pc.evidence_expires_at, u.email AS assignee_email
  FROM program_controls pc
  JOIN control_definitions cd ON pc.control_definition_id = cd.id
  JOIN programs p ON pc.program_id = p.id
  LEFT JOIN assignments a ON a.program_control_id = pc.id AND a.status NOT IN ('closed','cancelled')
  LEFT JOIN users u ON a.assigned_to = u.id
  WHERE pc.status = 'fully_implemented'
    AND pc.evidence_expires_at < NOW()

Step 2: For each result → update program_control status to 'stale'
  UPDATE program_controls SET status = 'stale', stale_since = NOW() WHERE id = $1

Step 3: Insert POA&M entry (into activity_log or a dedicated poam_items table)

Step 4: Trigger SPRS recalculation for each affected program
  POST /api/webhooks/n8n/sprs-recalc (existing webhook)

Step 5: Send stale-evidence email to assignee (via Resend, from P1)
  "Control [NIST ID] evidence has expired. Please upload fresh evidence."

Separate branch: expiry-warning (30 days before expiry)
  SELECT ... WHERE evidence_expires_at BETWEEN NOW() AND NOW() + INTERVAL '30 days'
  Send warning email (different template: "evidence expires in X days")
```

### FastAPI Changes

**Updates to existing endpoints:**

`PATCH /api/controls/program/{program_id}/{control_id}` (existing):
- When an artifact is assessed as `met` or `partial`, update `program_controls.last_evidence_at = NOW()`
- Recompute `evidence_expires_at = NOW() + INTERVAL '{max_age_days} days'`

`POST /api/webhooks/n8n/assessment-complete` (existing):
- After updating `assessment_status`, update `last_evidence_at` and `evidence_expires_at` on the `program_control`

**New endpoint:**

`PATCH /api/controls/program/{program_id}/{control_id}/freshness`
```python
body: { "evidence_max_age_days_override": int }  # null to reset to default
```
- Requires `client_admin` or above
- Updates `evidence_max_age_days_override` + recomputes `evidence_expires_at`

**New Hasura tracked view:** Track `program_control_freshness` view in Hasura for frontend queries.

### SPRS Impact

When a control transitions from `fully_implemented` to `stale`:
- Its `dod_score_value` deduction is re-applied to the SPRS score
- SPRS recalculates exactly as if the control were `not_implemented`
- This reflects the real-world consequence: stale evidence = no credit

### Frontend Changes

**Dashboard (`/[orgSlug]/dashboard/page.tsx`):**
- New "Evidence Freshness" panel below the SPRS gauge
- Color-coded by freshness: green (fresh), amber (expiring < 30d), red (expired/stale)
- Shows count: "3 controls expiring this month, 1 already stale"
- Click-through to controls list filtered by freshness status

**Controls list (`/[orgSlug]/controls/page.tsx`):**
- New filter: "Freshness" → fresh / expiring_soon / expired / no_evidence
- Evidence expiry column (optional, toggleable): "Expires in 22 days" or "Expired 5 days ago"
- Row highlight: amber for expiring_soon, red for expired

**Control detail (`/[orgSlug]/controls/[id]/page.tsx`):**
- Evidence freshness badge on the artifact list: "Evidence fresh until Mar 15, 2027" or "Expired Jan 01, 2027 — re-upload required"
- Custom max-age override input (for MSP admin / client admin)

**MSP Dashboard (new panel — leverages P5 analytics):**
- Cross-client freshness heat map: orgs on X-axis, control families on Y-axis, color = worst freshness status in that family

---

## Implementation Phases

**Phase 1 (Day 1):** DB migration (014). Seed `evidence_max_age_days` per family. Add `last_evidence_at`, `evidence_expires_at`, `stale_since` columns. Update webhook handler to set freshness fields on assessment.

**Phase 2 (Day 2):** n8n Workflow 13 (nightly cron — staleness check + status demotion + SPRS trigger). Hasura track new view.

**Phase 3 (Day 3):** Email notifications (expiry warnings + stale alerts, reusing P1 infrastructure). Frontend: freshness panel on dashboard, filter on controls list.

**Phase 4 (Day 4-5):** Custom override endpoint + UI. MSP freshness heat map. Edge case: what if a control was `not_implemented` — skip staleness (it's already not evidenced). What if `not_applicable` — skip.

---

## Acceptance Criteria

- [ ] `evidence_max_age_days` seeded correctly for all 110 control families
- [ ] Assessment complete webhook updates `last_evidence_at` + `evidence_expires_at`
- [ ] Nightly cron demotes `fully_implemented` controls to `stale` when expired
- [ ] SPRS score decreases when a control goes stale (verified against known-good calculation)
- [ ] Warning email fires at 30 days before expiry
- [ ] Stale email fires on day-of expiry with control ID and upload link
- [ ] Dashboard freshness panel shows correct counts
- [ ] Controls list freshness filter works correctly
- [ ] Custom override persists and overrides the default
- [ ] Stale status does not affect `not_applicable` controls
- [ ] Re-uploading and re-assessing a stale control restores status and SPRS credit
- [ ] All existing pytest tests still pass
