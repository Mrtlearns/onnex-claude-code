# P1 — Real Email Delivery + Digest Infrastructure

## Status: Planned | Priority: S (2–3 days) | Sprint: Next

---

## Problem Statement

Every notification workflow in the platform silently fails in production. Workflows 05, 06, 09, and 10 contain SMTP nodes that are stubs — they log to n8n's execution log but never reach a recipient. The consequence:

- Invited users never receive their invite link. Onboarding requires manual URL sharing.
- Assigned contributors don't know they have an open task. Assignments go stale.
- POA&M milestone deadlines pass without warning. Audit timelines slip.
- MSP operators get no weekly digest. They must log in to notice a client is stuck.
- Phase unlock events are invisible. Momentum breaks.

This is the highest-leverage non-AI improvement because it unblocks every other notification-dependent feature on the roadmap, costs the least to build, and is a table-stakes requirement for any real SaaS.

---

## User Stories

| ID | As a… | I want… | So that… |
|----|--------|---------|---------|
| US-01 | Invited user | To receive a branded email with my invite link | I can accept the invitation without asking the MSP for the URL |
| US-02 | Assigned contributor | To get an email when I'm assigned a control | I don't miss tasks or check the app constantly |
| US-03 | Client admin | To get a reminder 14, 7, and 1 day before a POA&M deadline | I never miss a milestone date |
| US-04 | MSP admin | To receive a Monday morning digest of all client SPRS changes and stuck programs | I can triage my book of business before the week starts |
| US-05 | Client admin | To get notified when a phase unlocks | I know work can begin on the next phase immediately |
| US-06 | Any user | To get an email when an artifact assessment completes (pass/partial/fail) | I know the verdict without polling the dashboard |
| US-07 | Any user | To unsubscribe from any email category | I control my notification preferences |

---

## Technical Design

### Email Provider

**Recommended: Resend** — REST API, React Email templates, generous free tier (3k/month), built-in unsubscribe headers, native n8n HTTP node compatible. Alternative: Postmark (more mature, better deliverability for transactional), AWS SES (cheapest at scale).

Configuration: `RESEND_API_KEY` env var in Docker Compose + n8n credentials store.

### Data Model Changes

**New table: `user_notification_preferences`**

```sql
CREATE TABLE user_notification_preferences (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category        TEXT NOT NULL,   -- 'invite','assignment','poam_deadline','weekly_digest','phase_unlock','assessment_complete'
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, category)
);
```

**New column on `users`:**
```sql
ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');
```

> Note: `users` currently stores Authentik `sub` as `id` and `role`. Email is not stored locally — fetch from Authentik `get_user_by_email` on invite accept, or store at that point.

**New table: `email_log`** (for idempotency + delivery tracking)

```sql
CREATE TABLE email_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT NOT NULL,
    category        TEXT NOT NULL,
    subject         TEXT,
    reference_id    UUID,            -- artifact_id, assignment_id, program_id, etc.
    provider_id     TEXT,            -- Resend message ID for delivery tracking
    sent_at         TIMESTAMPTZ DEFAULT NOW(),
    status          TEXT DEFAULT 'sent'  -- sent | bounced | complained
);
```

### n8n Changes

**Workflow 10 — User Invite:**
- Replace stub SMTP node with HTTP Request node → `POST https://api.resend.com/emails`
- Headers: `Authorization: Bearer {{$env.RESEND_API_KEY}}`
- Body: `{ from: "no-reply@cmmc4msp.on-nex.us", to: "{{invite.email}}", subject: "You've been invited to [OrgName] on CMMC OS", html: "..." }`
- Include invite deep-link: `https://app.cmmc4msp.on-nex.us/invite/{{token}}`
- Log to `email_log` via FastAPI webhook after send

**Workflow 09 — Assignment Notifications:**
- Replace stub with Resend HTTP node
- Payload: assignee email, control name, program name, due date, deep-link to `/[orgSlug]/tasks`
- Two sub-paths: `assigned` (new task) and `status_changed` (transition event)

**Workflow 05 — POA&M Reminders:**
- Cron: daily 08:00 UTC
- Query: `SELECT pc.*, p.name, o.name FROM program_controls pc JOIN programs p ... WHERE pc.target_completion_date BETWEEN NOW() AND NOW() + INTERVAL '14 days' AND pc.status != 'fully_implemented'`
- Group by assignee → send one digest email per person (not per control)
- Include 14d, 7d, 1d reminder tiers in a single template with highlighted urgency

**Workflow 06 — Weekly MSP Digest:**
- Cron: Monday 07:00 UTC
- Query: aggregate SPRS delta (current vs 7 days ago), programs with no activity in 7 days, controls assessed this week
- One email per MSP admin with table of all their orgs

**New Workflow 11 — Assessment Complete Notification:**
- Trigger: existing `POST /api/webhooks/n8n/assessment-complete` (already fires, already updates DB)
- Add: after DB update, trigger n8n workflow 11 via `n8n_service.trigger_assessment_notify(artifact_id, verdict, program_control_id)`
- n8n 11: fetch assignee email → send Resend email with verdict badge + rationale snippet + deep-link

### FastAPI Changes

**New router: `app/routers/notifications.py`**

```python
GET  /api/notifications/preferences          # get current user prefs
PATCH /api/notifications/preferences         # update prefs by category
GET  /api/notifications/unsubscribe/{token}  # public; disables all emails for that user
```

**New service: `app/services/email_service.py`**

```python
async def send_email(to: str, subject: str, html: str, category: str, reference_id: str = None) -> str:
    """POST to Resend API, write to email_log, return provider_id."""
```

> Used by any FastAPI route that needs to send email outside n8n (e.g., invite resend from UI).

### Frontend Changes

**New page: `/[orgSlug]/settings/notifications`**
- Toggle grid: rows = categories (assignment, assessment, poam_deadline, etc.), toggle per row
- Calls `PATCH /api/notifications/preferences`

**Invite page (`/invite/[token]/page.tsx`):**
- No change needed — invite email delivers the URL, page handles the rest

### Email Template Design

All templates: branded header (logo + "CMMC Compliance OS"), org context, action button, footer with unsubscribe link.

| Template | Subject | Key data |
|----------|---------|---------|
| Invite | `[OrgName] has invited you to CMMC OS` | Org name, role, invite URL, 72h expiry |
| Assignment | `You've been assigned: [ControlID]` | Control name, program, due date, instructions, link |
| POA&M Reminder | `[N] controls due within [X] days` | Table of control IDs, deadlines, status |
| Weekly Digest | `CMMC OS — Weekly Summary for [MSP]` | SPRS changes, stuck programs, assessments done |
| Phase Unlock | `Phase [N] is now unlocked for [OrgName]` | Phase name, controls count, next steps |
| Assessment Done | `Assessment complete: [verdict] for [ControlID]` | Verdict badge, confidence %, rationale excerpt, link |

---

## Dependencies

- `RESEND_API_KEY` set in Docker Compose `.env` and n8n environment
- `users.email` column must be populated at invite-accept time (currently not stored)
- `invites.email` column already exists — use as source at accept time
- Authentik `get_user_by_email` service already exists at `app/services/authentik_service.py`

---

## Implementation Phases

**Phase 1 (Day 1):** DB migration (user_notification_preferences, email_log, users.email, users.unsubscribe_token). Resend credential in n8n. Wire workflow 10 (invites) — most urgent.

**Phase 2 (Day 2):** Wire workflows 09 (assignments) and new workflow 11 (assessment complete). FastAPI email_service.py. Unsubscribe endpoint.

**Phase 3 (Day 3):** Wire workflows 05 (POA&M reminders) and 06 (weekly digest). Frontend notification preferences page. Smoke-test full cycle with Mailhog locally.

---

## Acceptance Criteria

- [ ] Invite email arrives in <30s with working deep-link
- [ ] Assignment email fires on `POST /api/assignments/bulk` and on state transitions
- [ ] POA&M reminder fires daily for controls with `target_completion_date` within 14 days
- [ ] Weekly digest arrives Monday morning with accurate SPRS delta
- [ ] Assessment-complete email fires after workflow 02 completes
- [ ] Unsubscribe link disables all emails for that token without logging in
- [ ] Notification preferences persist across sessions
- [ ] No email sent if user has disabled that category
- [ ] `email_log` records every send with provider_id
- [ ] All existing pytest tests still pass
