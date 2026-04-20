# CMMC Compliance OS — Implementation Tracker

**Started:** 2026-04-17 | **Stack decisions:** Resend (email), Full stack, Deploy after each, All 6 P2 connectors
**Completed:** 2026-04-17 | **Tests:** 341 passing (was 211)

## Build Sequence

| # | Feature | Status | Tests | Branch/Commit |
|---|---------|--------|-------|---------------|
| 1 | P1 — Real Email (Resend) | ✅ Done | ✅ 16 new | 93feb2b |
| 2 | A1 — Compliance Copilot | ✅ Done | ✅ 18 new | 22b99f6 |
| 3 | A2 — AI Policy Drafts | ✅ Done | ✅ 24 new | b398e5b |
| 4 | P4 — Evidence Freshness | ✅ Done | ✅ 8 new | 5d727f1 |
| 5 | A3 — Drift Detection | ✅ Done | ✅ 18 new | 5d727f1 |
| 6 | P3 — Audit Package | ✅ Done | ✅ 10 new | 98d8420 |
| 7 | P5 — MSP Analytics | ✅ Done | ✅ 8 new | 98d8420 |
| 8 | A4 — Gap Synthesis | ✅ Done | ✅ 10 new | e707efc |
| 9 | A5 — SSP Interview | ✅ Done | ✅ 12 new | e707efc |
| 10 | P2 — All 6 Integrations | ✅ Done | ✅ 22 new | 79c67b8 |

## Legend
✅ Done | 🔄 In Progress | ⬜ Pending | ❌ Blocked

## New Files (Backend)

### Services
- `fastapi/app/services/email_service.py` — Resend REST API + email_log
- `fastapi/app/services/copilot_service.py` — RAG context assembly + OpenRouter streaming
- `fastapi/app/services/policy_draft_service.py` — claude-opus-4-7 policy generation
- `fastapi/app/services/docx_service.py` — markdown → DOCX via python-docx
- `fastapi/app/services/drift_service.py` — cosine distance + claude-haiku-4-5 diff summaries
- `fastapi/app/services/gap_analysis_service.py` — objective coverage mapping via claude-sonnet-4-6
- `fastapi/app/services/ssp_interview_service.py` — 15-question interview + section generation
- `fastapi/app/services/integration_service.py` — 6 provider pullers + sync orchestrator

### Routers
- `fastapi/app/routers/notifications.py` — GET/PATCH preferences, GET unsubscribe
- `fastapi/app/routers/audit.py` — audit package export (ZIP + SHA256 manifest)
- `fastapi/app/routers/analytics.py` — MSP portfolio analytics
- `fastapi/app/routers/ssp_interview.py` — conversational SSP interview flow
- `fastapi/app/routers/integrations.py` — 6-provider connector CRUD + sync

### Extended Routers
- `fastapi/app/routers/controls.py` — +chat (3 endpoints) +draft-policy (4 endpoints) +gap-analysis (3 endpoints)
- `fastapi/app/routers/programs.py` — +freshness report endpoint
- `fastapi/app/routers/webhooks.py` — +mark-stale +batch-drift-check
- `fastapi/app/routers/artifacts.py` — +dismiss-drift endpoint

## New Files (DB Migrations)
- `014_email_infrastructure.sql` — user_notification_preferences, email_log, users.email/unsubscribe_token
- `015_integrations.sql` — (spec number; actually filed as 023 to maintain sequence)
- `016_audit_package.sql` — audit_packages, artifact_approvals
- `017_evidence_freshness.sql` — evidence_max_age_days, expires_at, stale_since, freshness view
- `018_copilot.sql` — control_chat_messages, nist_guide_chunks
- `019_policy_drafts.sql` — policy_drafts
- `020_drift_detection.sql` — artifacts drift columns, artifact_drift_events
- `021_gap_analysis.sql` — control_gap_analyses
- `022_ssp_interviews.sql` — ssp_interviews
- `023_integrations.sql` — integrations, integration_credentials, integration_sync_log

## n8n Workflows Added
- `10_user_invite.json` — updated with real Resend API call
- `11_assessment_notify.json` — NEW: assessment-complete email
- `12_integration_sync.json` — NEW: nightly 02:00 UTC integration sync
- `13_evidence_freshness_monitor.json` — NEW: nightly 01:00 UTC freshness check
- `14_evidence_drift_monitor.json` — NEW: nightly 03:00 UTC drift detection

## Frontend Pages/Components Added
- `nextjs/src/app/[orgSlug]/settings/notifications/page.tsx` — notification preference toggles
- `nextjs/src/app/admin/analytics/page.tsx` — MSP portfolio analytics dashboard
- `nextjs/src/components/CopilotChat.tsx` — streaming chat component
- `nextjs/src/app/[orgSlug]/controls/[id]/page.tsx` — +Copilot tab, +Generate Draft Policy button

## Deployment Pending (SSH access needed)
SSH key not authorized on 10.10.110.41. MrT needs to:
1. Add SSH public key to VM: `ssh-copy-id -i ~/.ssh/id_ed25519 <user>@10.10.110.41`
2. Pull and deploy: `git pull && docker compose up -d --build`
3. Run all pending migrations (014–023) against postgres
4. Set env vars: RESEND_API_KEY, OPENROUTER_API_KEY (if not set)
5. Import n8n workflows 11–14 via n8n UI
6. Create Resend API credential in n8n (name: "Resend API", type: httpHeaderAuth, value: Bearer {key})
