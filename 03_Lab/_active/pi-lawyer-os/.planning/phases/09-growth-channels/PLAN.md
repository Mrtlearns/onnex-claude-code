# Phase 09 — Growth Channels

**Milestone:** v3.2

## Scope

New lead acquisition channels: Google My Business review monitoring (reviews become leads), after-hours IVR (missed calls after hours get immediate SMS + voicemail logged), and a smarter web intake form with pre-qualification branching.

---

## Wave 1: After-Hours IVR

**Goal:** Twilio voice webhook handles after-hours calls — auto-SMS + voicemail capture + lead log.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Create n8n workflow `after-hours-ivr.json` — Twilio voice webhook → check hour (if 6pm–8am or weekend) → TwiML response (play greeting, record voicemail) → POST lead to /api/leads (source: 'phone', status: 'new') → send SMS to caller | `n8n/after-hours-ivr.json` | Yes (n8n-workflow-builder) |
| 1.2 | Store voicemail URL in communications log (channel: 'voicemail', message: recording URL) | workflow | No |
| 1.3 | Add `voicemail` to channel enum in `communications` table (if not already present) | `postgres/migrations/010_growth_channels.sql` | No |

---

## Wave 2: GMB Review Monitor

**Goal:** Daily scrape (or webhook) of firm's Google reviews → positive reviews auto-create lead.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Research and decide approach: Google My Business API (requires OAuth) vs. SerpAPI review scraping vs. manual-trigger. Document in `docs/GMB-INTEGRATION.md`. Default to SerpAPI if GMB OAuth friction is high. | `docs/GMB-INTEGRATION.md` | Yes (researcher) |
| 2.2 | Create n8n workflow `gmb-review-monitor.json` — daily cron → fetch reviews via chosen API → filter 4–5 star reviews from last 24h → deduplicate by reviewer name → POST lead (source: 'review', first_name from reviewer, notes: review text, status: 'new'). Stub: if API key unset, use one fixed fake 5-star review per run. | `n8n/gmb-review-monitor.json` | Yes (n8n-workflow-builder) |
| 2.3 | Frontend: verify `review` source badge/icon renders on Leads list (already in schema as LeadSource enum) | `frontend/src/pages/Leads.tsx` | No |

---

## Wave 3: Web Form v2

**Goal:** Improved intake form with injury-type branching and pre-qualification.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Create standalone intake form page `/intake` (no auth required) — multi-step: Step 1 contact info, Step 2 injury type + accident date + fault (yes/no/unsure), Step 3 medical treatment (yes/no), Step 4 submit | `frontend/src/pages/IntakeForm.tsx` | No |
| 3.2 | Add pre-qualification logic: if fault=no → show "We handle fault-based cases" message but still capture lead with status='new'; if no medical treatment → flag low-priority (score hint) | form logic | No |
| 3.3 | POST completed intake to `/api/leads` with all captured fields; trigger speed-to-lead webhook | form submit | No |
| 3.4 | Add `/intake` route to App.tsx (unauthenticated); add link to `/intake` on Login page | `frontend/src/App.tsx` | No |

---

## Wave 4: Source Attribution Dashboard

**Goal:** Lead source breakdown tile with conversion rates per source on Analytics page.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | DB view `source_attribution_stats`: lead counts + signed counts + conversion rate grouped by source | `postgres/migrations/010_growth_channels.sql` | No |
| 4.2 | Frontend: add `SourceAttributionChart` to Analytics page — bar chart of leads by source, stacked signed vs. not | `frontend/src/pages/Analytics.tsx` | No |

---

## Success Criteria

- [ ] After-hours IVR: Twilio voice webhook triggers, SMS sent to caller within 60 seconds, lead created
- [ ] GMB review monitor: at least one 4+ star review creates a lead (test with stub/demo review)
- [ ] Web intake form `/intake` loads without auth, completes multi-step flow, creates lead in DB
- [ ] Source attribution chart visible on Analytics with data from demo leads

---

## Technical Notes

- GMB default approach: SerpAPI (simpler) — GMB OAuth is per-client onboarding step anyway
- IVR TwiML: `<Response><Say>...</Say><Record maxLength="60"/></Response>`
- Intake form: detect browser language (`navigator.language`) — if `es`, show Spanish version (coordinate with Phase 10)
- All external API stubs: flag-driven via `.env` (SOP rule 1)
