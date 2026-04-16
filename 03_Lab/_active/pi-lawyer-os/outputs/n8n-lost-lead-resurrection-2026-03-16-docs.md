# n8n Workflow: PI Lawyer OS — Lost Lead Resurrection

**Date:** 2026-03-16
**Workflow file:** `projects/pi-lawyer-os/n8n/lost-lead-resurrection.json`

---

## Purpose

Daily automation that identifies PI law firm leads who have gone cold (no contact for 30+ days) and sends a re-engagement SMS via Twilio. After sending, it logs the outbound communication and stamps the lead with `resurrection_sent_at` to prevent duplicate sends.

---

## Node-by-Node Breakdown

### 1. Daily 9AM Trigger — `n8n-nodes-base.scheduleTrigger`

Fires every day at 09:00 AM server time using cron expression `0 9 * * *`. No credentials required.

### 2. Fetch Inactive Leads — `n8n-nodes-base.httpRequest`

GET request to PostgREST at `$env.POSTGREST_URL/leads` with two query parameters:

- `status=in.(new,contacted,intake-in-progress)` — only open leads, not won/lost/archived
- `select=id,first_name,last_name,phone,firm_id,last_contact_at,created_at,resurrection_sent_at` — exact columns needed downstream

Returns a JSON array. Bearer token pulled from `$env.POSTGREST_SERVICE_KEY`.

### 3. Filter Leads — 30 Days Inactive — `n8n-nodes-base.code`

JavaScript Code node that:

1. Computes `thirtyDaysAgo` as `now - 30 days`
2. Receives the full PostgREST array from `$input.first().json`
3. Applies the compound filter:
   - Inactive condition: `last_contact_at` is null AND `created_at` < 30 days ago, OR `last_contact_at` < 30 days ago
   - Resurrection guard: `resurrection_sent_at` is null OR `resurrection_sent_at` < 30 days ago
4. Returns filtered leads as individual items using `return filtered.map(lead => ({ json: lead }))`

Each downstream node receives one lead per execution item, so n8n fans out the remaining nodes per lead automatically.

### 4. Send Resurrection SMS — `n8n-nodes-base.twilio`

Sends SMS to `$json.phone` using the Twilio node's built-in `send` operation. From number sourced from `$env.TWILIO_FROM_NUMBER`. Message template uses `$json.first_name` for personalization.

**Note:** Replace `[Firm Name]` in the message body with the actual firm name, or make it dynamic by adding `firm_name` to the PostgREST select query once that column is available.

### 5. Log Communication — `n8n-nodes-base.httpRequest`

POST to `$env.POSTGREST_URL/communications` with:

```json
{
  "lead_id": "<from lead>",
  "firm_id": "<from lead>",
  "channel": "sms",
  "direction": "outbound",
  "message": "Lost lead resurrection SMS sent",
  "status": "sent"
}
```

Uses `Prefer: return=minimal` to avoid unnecessary response payload. References the original lead data via `$('Filter Leads — 30 Days Inactive').item.json` to survive the Twilio node's output context.

### 6. Update resurrection_sent_at — `n8n-nodes-base.httpRequest`

PATCH to `/leads?id=eq.<lead_id>` with body `{ "resurrection_sent_at": "<ISO timestamp>" }`. Uses PostgREST's equality filter in the URL to target the exact row. Also uses `Prefer: return=minimal`.

---

## Required Credentials

| Credential | n8n Type | Where Used |
|---|---|---|
| Twilio Account | `twilioApi` | Send Resurrection SMS node |
| PostgREST Bearer token | Environment variable `POSTGREST_SERVICE_KEY` | All httpRequest nodes (inline via `$env`) |

The PostgREST calls use inline `$env` references rather than an n8n credential object. This is intentional — the service key is a long-lived static bearer token, and keeping it in a single env var makes rotation easier without touching the workflow.

---

## Environment Variables Required

| Variable | Description |
|---|---|
| `POSTGREST_URL` | Base URL of the PostgREST API, e.g. `https://api.pilawyeros.internal` |
| `POSTGREST_SERVICE_KEY` | Service-role JWT for PostgREST |
| `TWILIO_FROM_NUMBER` | Twilio sender number in E.164 format, e.g. `+15551234567` |

Set these in n8n under **Settings > Environment Variables** (self-hosted) or in the `.env` file of your n8n Docker container.

---

## Database Prerequisites

The workflow assumes the following columns exist on the `leads` table:

| Column | Type | Notes |
|---|---|---|
| `last_contact_at` | `timestamptz` | Nullable. Updated whenever staff contacts the lead. |
| `resurrection_sent_at` | `timestamptz` | Nullable. Stamped by this workflow after SMS send. |

The `communications` table must exist with at minimum: `lead_id`, `firm_id`, `channel`, `direction`, `message`, `status`.

---

## Setup Steps

1. Import `projects/pi-lawyer-os/n8n/lost-lead-resurrection.json` into n8n via **Workflows > Import from file**.
2. Set the three environment variables on the n8n instance.
3. Open the **Send Resurrection SMS** node and attach your Twilio credential (rename the placeholder credential ID `twilio-cred-id` to match the actual credential created in n8n).
4. Replace `[Firm Name]` in the SMS message body with the actual firm name or parameterize it.
5. Verify PostgREST RLS policies allow the service key to:
   - SELECT from `leads` with the status filter
   - INSERT into `communications`
   - PATCH `leads` by `id`
6. Activate the workflow.

---

## Test Procedure

### Safe test (no SMS sent)

1. Temporarily disable the **Send Resurrection SMS** node (right-click > Disable).
2. Click **Test Workflow** (manual trigger).
3. Inspect the output of **Filter Leads — 30 Days Inactive** — confirm expected leads appear and the date math is correct.
4. Inspect **Log Communication** and **Update resurrection_sent_at** outputs — confirm PostgREST returns 200/204.

### Full end-to-end test

1. Re-enable the Twilio node.
2. Insert a test lead row with `status = 'new'`, `created_at` = 35 days ago, `last_contact_at` = NULL, `resurrection_sent_at` = NULL, and a phone number you control.
3. Run manually. Confirm:
   - SMS arrives on your phone
   - A row appears in `communications` for that lead
   - `resurrection_sent_at` is set on the lead row
4. Run again immediately — confirm the test lead is filtered out (resurrection guard blocks re-send).

---

## Operational Notes

- If a lead has no phone number, the Twilio node will error on that item. Consider adding an IF node after the filter to route leads with null/empty phone to a separate error branch.
- The `[Firm Name]` placeholder in the SMS should be made dynamic per `firm_id` if this workflow serves multiple firms. Add a lookup step or join firm name via PostgREST before the SMS node.
- Set `errorWorkflow` in the workflow settings to a dedicated error-handling workflow that alerts via Slack or email when the daily run fails.
