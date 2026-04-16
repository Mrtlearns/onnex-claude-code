# PI Lawyer OS — SOL Alert Workflow

**File:** `projects/pi-lawyer-os/n8n/workflows/sol-alert.json`
**Date:** 2026-03-16
**Purpose:** Daily SMS alerts to assigned attorneys for cases with SOL dates 90, 60, or 30 days out.

---

## Workflow Overview

```
[Daily 8am Trigger]
      |
[Query SOL Cases]  (Postgres)
      |
[Any Cases Found?]  (IF: results > 0)
      |true                    |false
[Loop Over Cases]        [No Cases — Stop]
      |
[Has Attorney Phone?]  (IF: attorney_phone not empty)
      |true                    |false
[Send SOL SMS]          [Skip — No Phone]
      |                        |
[Log to Communications]  [Back to Loop (Skip path)]
      |                        |
[Back to Loop (SMS path)]       |
      |________________________|
      |
[Loop Over Cases] (continues until all items processed)
```

---

## Node-by-Node Reference

### 1. Daily 8am Trigger
- **Type:** `n8n-nodes-base.scheduleTrigger`
- **Schedule:** `0 8 * * *` (cron — every day at 08:00 server time)
- **Note:** Verify n8n server timezone matches your law firm's local timezone. Set `TZ` env var on the n8n container if needed.

### 2. Query SOL Cases
- **Type:** `n8n-nodes-base.postgres`
- **Operation:** `executeQuery`
- **Credential:** `PI Lawyer OS — PostgreSQL`
- Queries `cases`, `clients`, and `users` tables.
- Returns only cases where `sol_date - CURRENT_DATE` is exactly 90, 60, or 30 days.
- Excludes cases with status `closed` or `settlement`.
- Computes `urgency` label: `CRITICAL` (<=30d), `URGENT` (<=60d), `WARNING` (90d).

### 3. Any Cases Found?
- **Type:** `n8n-nodes-base.if`
- **Condition:** `$items().length > 0`
- **True path:** proceeds to loop
- **False path:** routes to No-Op stop node — workflow ends cleanly with no actions

### 4. No Cases — Stop
- **Type:** `n8n-nodes-base.noOp`
- Terminal node for zero-result days. Execution recorded, nothing sent.

### 5. Loop Over Cases
- **Type:** `n8n-nodes-base.splitInBatches`
- **Batch size:** 1 (processes one case per iteration)
- Output index 0 = loop body (items remaining)
- Output index 1 = loop done (all items processed — not explicitly wired, workflow ends naturally)
- The loop-back NoOp nodes re-enter this node after each iteration via connections

### 6. Has Attorney Phone?
- **Type:** `n8n-nodes-base.if`
- **Condition:** `$json.attorney_phone` is not empty string
- Guards against null/unassigned attorney records
- True path: send SMS + log
- False path: skip to loop-back

### 7. Send SOL SMS
- **Type:** `n8n-nodes-base.twilio`
- **Credential:** `PI Lawyer OS — Twilio`
- **To:** `{{ $json.attorney_phone }}`
- **From:** `{{ $vars.TWILIO_FROM_NUMBER }}` (n8n workflow variable)
- **Message format:**
  ```
  ⚠️ SOL ALERT [CRITICAL]: John Smith (PI-2024-0042) — SOL in 28 days (2026-04-13). Action required.
  ```

### 8. Log to Communications
- **Type:** `n8n-nodes-base.httpRequest`
- **Method:** POST
- **URL:** `http://postgrest:3000/communications`
- **Auth:** Bearer JWT via `$vars.POSTGREST_JWT` workflow variable
- **Headers:** `Content-Type: application/json`, `Prefer: return=minimal`
- **Body fields written:**
  - `case_id` — UUID of the case
  - `channel` — `"sms"`
  - `direction` — `"outbound"`
  - `status` — `"sent"`
  - `recipient` — attorney phone number
  - `body` — full SMS text
  - `metadata` — JSON object with `case_id`, `alert_type` (e.g. `sol_critical`), `days_until_sol`, `attorney_name`

### 9 & 10. Loop-Back NoOp Nodes
These exist solely to route both the SMS-sent path and the skip-no-phone path back into the `Loop Over Cases` node, completing the iteration cycle. This is the standard n8n pattern for SplitInBatches loops.

---

## Required Credentials

| Credential Name | Type | Fields |
|-----------------|------|--------|
| `PI Lawyer OS — PostgreSQL` | `postgres` | host=`postgres`, port=`5432`, database=`pilaweros`, user=`postgres`, password=(from env) |
| `PI Lawyer OS — Twilio` | `twilioApi` | Account SID (`TWILIO_ACCOUNT_SID`), Auth Token (`TWILIO_AUTH_TOKEN`) |

---

## Required Workflow Variables (n8n Variables store)

| Variable | Value | Notes |
|----------|-------|-------|
| `TWILIO_FROM_NUMBER` | e.g. `+15005550006` | Your Twilio provisioned number |
| `POSTGREST_JWT` | service role JWT | Used in `Authorization: Bearer` header for PostgREST |

Set these in n8n under Settings > Variables, not hardcoded in the workflow.

---

## Setup Steps

1. **Import the workflow**
   - In n8n, go to Workflows > Import from File
   - Select `projects/pi-lawyer-os/n8n/workflows/sol-alert.json`

2. **Create the PostgreSQL credential**
   - Credentials > New > Postgres
   - Name: `PI Lawyer OS — PostgreSQL`
   - Host: `postgres` (Docker internal), Port: `5432`
   - Database: `pilaweros`, User: `postgres`
   - Password: pull from your secrets manager / `.env`

3. **Create the Twilio credential**
   - Credentials > New > Twilio API
   - Name: `PI Lawyer OS — Twilio`
   - Account SID: value of `TWILIO_ACCOUNT_SID` env var
   - Auth Token: value of `TWILIO_AUTH_TOKEN` env var

4. **Set workflow variables**
   - n8n Settings > Variables
   - Add `TWILIO_FROM_NUMBER` and `POSTGREST_JWT`

5. **Verify timezone**
   - Confirm n8n container has correct `TZ` env var (e.g. `America/Chicago`)
   - The cron `0 8 * * *` fires at 8am server time

6. **Activate the workflow**
   - Toggle the workflow to Active

---

## Test Procedure

### Manual test run
1. Temporarily modify the SQL `WHERE` clause to use a test case with a known SOL date, or insert a test record.
2. Open the workflow, click "Execute Workflow" to trigger manually.
3. Inspect each node's output in the execution panel:
   - Query SOL Cases: confirm rows returned
   - Any Cases Found?: confirm true branch taken
   - Loop Over Cases: confirm batch of 1
   - Has Attorney Phone?: confirm branch logic
   - Send SOL SMS: confirm Twilio response `200 OK`
   - Log to Communications: confirm PostgREST returns `204 No Content`

### Verify SMS delivery
- Check the attorney phone for the SMS message
- Verify the message text matches the expected format

### Verify communication log
```sql
SELECT * FROM communications
WHERE channel = 'sms'
  AND direction = 'outbound'
ORDER BY created_at DESC
LIMIT 10;
```

### Zero-result test
- Run on a day/against data where no cases match the 90/60/30 day window
- Confirm the "No Cases — Stop" node is reached and no SMS is sent

---

## Operational Notes

- The SQL query uses `IN (90, 60, 30)` for exact day matches, so alerts fire precisely on those milestones, not repeatedly.
- If an attorney has no phone number in `users.phone`, the case is silently skipped. Consider adding a separate email fallback branch or alerting the firm admin.
- PostgREST `Prefer: return=minimal` returns 204 and suppresses the inserted row — this keeps the HTTP response lightweight. Change to `return=representation` if you need the inserted `id` downstream.
- The `metadata` JSONB column on `communications` should be typed as `jsonb` in the schema for query-ability.
