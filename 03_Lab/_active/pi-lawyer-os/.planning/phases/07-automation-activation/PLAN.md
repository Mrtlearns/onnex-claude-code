# Phase 07 — Automation Activation

**Milestone:** v3.0
**Priority:** CRITICAL — product cannot be sold without this

## Scope

Wire outbound SMS (Twilio) into all 6 existing n8n workflows that currently have the trigger + data fetch logic but no outbound message delivery. Also: configure `.env` Twilio vars, verify webhook triggers, and activate all workflows. No new features — this is pure completion of Phase 1's original intent.

Workflows to fix:
1. `speed-to-lead` — lead created → immediate Twilio SMS to lead
2. `missed-call-recovery` — Twilio missed call webhook → SMS callback within 5 min
3. `intake-reminder` — 48h after lead created (status: new/contacted) → nudge SMS
4. `retainer-follow-up` — lead signed but no document uploaded → SMS day 3, day 7
5. `lost-lead-resurrection` — daily cron, leads inactive >30 days → SMS (exists, needs Twilio node wired)
6. `referral-thankyou` — lead signed + partner linked → SMS to partner (exists, needs Twilio node wired)

---

## Wave 1: Environment + Credentials

**Goal:** Twilio env vars in `.env` on server; n8n has Twilio credentials configured.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Document `.env` additions: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `TWILIO_WEBHOOK_URL`, `TWILIO_TEST_MODE`, `TWILIO_TEST_TO_NUMBER` | `docs/TWILIO-SETUP.md` (new) | No |
| 1.2 | Add Twilio credential to n8n via n8n API (POST /credentials) — credential type: `twilioApi` | server commands | No |
| 1.3 | Verify `docker-compose.yml` passes `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` to n8n service | `docker-compose.yml` | No |

---

## Wave 2: Wire Speed-to-Lead + Missed Call Recovery

**Goal:** Two highest-priority workflows fully functional and tested end-to-end.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Update `speed-to-lead` workflow: after HTTP GET lead data → add IF node (TWILIO_TEST_MODE) → stub: log to communications / real: Twilio Send SMS (body: "Hi {first_name}, we received your inquiry about your {injury_type} case. An attorney will call you within 15 minutes. — {firm_name}") → POST /api/communications log | `n8n/workflows/speed-to-lead.json` | Yes (n8n-workflow-builder) |
| 2.2 | Update `missed-call-recovery` workflow: add IF test mode node → stub log / real Twilio SMS (body: "We missed your call! We're reviewing your case and will call back within 10 minutes. — {firm_name}") + communications log | `n8n/workflows/missed-call-recovery.json` | Yes (n8n-workflow-builder) |
| 2.3 | Configure Twilio webhook URL for missed calls in Twilio console — point to `{BASE_URL}/n8n/webhook/missed-call` | docs only | No |

---

## Wave 3: Wire Intake Reminder + Retainer Follow-up

**Goal:** Two nurture sequence workflows wired.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Update `intake-reminder` workflow: after data fetch → IF test mode → stub log / real Twilio SMS (body: "Hi {first_name}, we still have your case on file. Ready to move forward? Reply YES and we'll call you right away.") + communications log | `n8n/workflows/intake-reminder.json` | Yes (n8n-workflow-builder) |
| 3.2 | Update `retainer-follow-up` workflow: IF test mode → stub log / real Twilio SMS (body: "Hi {first_name}, your retainer is ready for signature. We can complete this over the phone in 5 minutes. When's a good time?") + communications log | `n8n/workflows/retainer-followup.json` | Yes (n8n-workflow-builder) |

---

## Wave 4: Verify + Activate Resurrection + Referral Workflows

**Goal:** Last two workflows confirmed wired (they were partially built in Phase 4); all 6 activated in n8n.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Audit `lost-lead-resurrection.json` — confirm IF test mode node + Twilio node present with credential reference; if missing, add | `n8n/lost-lead-resurrection.json` | No |
| 4.2 | Audit `referral-thankyou.json` — confirm IF test mode node + Twilio node present; if missing, add | `n8n/referral-thankyou.json` | No |
| 4.3 | Import/update all 6 workflows via n8n API; activate each | server commands | No |

---

## Wave 5: Automated Verification + Docs + Proceed

**Goal:** All criteria auto-verified; docs updated; context cleared; Phase 08 begins.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | Upload updated workflow JSONs, re-import to n8n on server; activate all 6 workflows | server commands | No |
| 5.2 | Auto-test: POST test lead via API → query `communications` table after 5s → assert row with `channel='sms'` + body contains lead's first_name | automated curl + psql | No |
| 5.3 | Auto-test: n8n API `GET /api/v1/workflows` → assert all 6 expected workflow names present with `active: true` | automated curl | No |
| 5.4 | Auto-test: trigger resurrection workflow manually via n8n API execution → query communications → assert stub SMS log for inactive leads | automated | No |
| 5.5 | Write Playwright spec `playwright-tests/tests/10-automation.spec.ts` — tests: n8n healthz, all 6 workflow names in API response, speed-to-lead communication logged after lead creation | `playwright-tests/tests/10-automation.spec.ts` | No |
| 5.6 | Run full Playwright suite — all tests must pass | `cd playwright-tests && npx playwright test` | No |
| 5.7 | Invoke `/update-project-docs` → commit + push | docs command | No |
| 5.8 | Update `STATE.md` + `MILESTONES.md`: Phase 07 complete, v3.0 milestone archived, Phase 08 next | `.planning/STATE.md`, `.planning/MILESTONES.md` | No |
| 5.9 | Commit all: `feat(phase-07): automation activation complete — v3.0 milestone` → push → begin Phase 08 | git | No |

---

## Success Criteria

- [ ] All 6 n8n workflows exist and `active: true` (verified via n8n API, not manually)
- [ ] Speed-to-lead stub SMS logged to `communications` within 10s of lead creation (automated curl test)
- [ ] Resurrection workflow manually triggered → stub SMS rows in `communications` for inactive leads
- [ ] Referral thank-you stub SMS logged when test lead marked signed with partner linked
- [ ] All stub IF nodes use `TWILIO_TEST_MODE=true` — zero real SMS sent; swappable via env flag
- [ ] Playwright suite `10-automation.spec.ts` passes (all tests green)
- [ ] `/update-project-docs` run and docs committed

---

## Technical Notes

- n8n Twilio credential type: `twilioApi` (accountSid + authToken fields)
- SMS from number must be a Twilio-verified number in the `.env`
- Webhook URL for missed call: configure in Twilio console per-client (client onboarding step)
- All SMS templates include firm name: use `{{ $vars.FIRM_NAME }}` or inject via n8n env
- Communications log POST: `{ lead_id, channel: "sms", direction: "outbound", message: <sms body> }`
- `TWILIO_TEST_MODE=true` (default) → log to communications; `TWILIO_TEST_MODE=false` → real send
- `TWILIO_TEST_TO_NUMBER` — verified number all test SMS route to
- Real creds swap: zero code changes, env only (per SOP rule 1)
