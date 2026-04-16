# PI Lawyer OS — Referral Thank-You Workflow

**File:** `referral-thankyou.json`
**Trigger:** Webhook POST — `referral-thankyou`
**Purpose:** When a lead is marked signed and has a referring partner, send the partner a thank-you SMS and log the communication to PostgREST.

---

## Node Map

| # | Node Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | Webhook | `n8n-nodes-base.webhook` | Receives POST from PI Lawyer OS backend |
| 2 | Check Signed + Has Partner | `n8n-nodes-base.if` | Gates on `status == "signed"` AND `referred_by_partner_id` not empty |
| 3 | Fetch Partner | `n8n-nodes-base.httpRequest` | GET partner record from PostgREST |
| 4 | Check Partner Has Phone | `n8n-nodes-base.if` | Gates on partner having a non-empty `phone` field |
| 5 | Send Thank-You SMS | `n8n-nodes-base.twilio` | Sends SMS to partner via Twilio |
| 6 | Log Communication | `n8n-nodes-base.httpRequest` | POST communication log record to PostgREST |
| 7 | Skip — Not Signed or No Partner | `n8n-nodes-base.respondToWebhook` | Early-exit response for gate 1 false branch |
| 8 | Skip — No Partner Phone | `n8n-nodes-base.respondToWebhook` | Early-exit response for gate 2 false branch |

---

## Flow Logic

```
Webhook POST
  └── Check Signed + Has Partner
        ├── [FALSE] → Skip — Not Signed or No Partner (200, skipped)
        └── [TRUE]  → Fetch Partner (PostgREST GET)
                          └── Check Partner Has Phone
                                ├── [FALSE] → Skip — No Partner Phone (200, skipped)
                                └── [TRUE]  → Send Thank-You SMS (Twilio)
                                                  └── Log Communication (PostgREST POST)
```

---

## Required Credentials

### 1. PostgREST Bearer (`httpHeaderAuth`)

Create an n8n credential of type **Header Auth**.

| Field | Value |
|-------|-------|
| Name | `PostgREST Bearer` |
| Header Name | `Authorization` |
| Header Value | `Bearer <your-postgrest-service-key>` |

Both `Fetch Partner` and `Log Communication` share this credential (referenced by name `PostgREST Bearer`).

### 2. Twilio Account (`twilioApi`)

Create an n8n credential of type **Twilio**.

| Field | Value |
|-------|-------|
| Name | `Twilio Account` |
| Account SID | From Twilio Console |
| Auth Token | From Twilio Console |

---

## Environment Variables

Set these in your n8n instance under **Settings > Variables** (or via `N8N_VARS` in your Docker env):

| Variable | Description |
|----------|-------------|
| `POSTGREST_URL` | Base URL for PostgREST, e.g. `https://db.pilaweros.local` |
| `TWILIO_FROM_NUMBER` | Twilio sender number in E.164 format, e.g. `+15005550006` |

Note: `POSTGREST_SERVICE_KEY` is handled inside the `PostgREST Bearer` credential value directly — not as a separate env var — since n8n credentials are the secure store for secrets.

---

## Webhook Payload Contract

The backend must POST to `https://n8n.botonomy.xyz/webhook/referral-thankyou` with:

```json
{
  "id": "lead-uuid",
  "firm_id": "firm-uuid",
  "first_name": "Jane",
  "last_name": "Smith",
  "status": "signed",
  "referred_by_partner_id": "partner-uuid"
}
```

If `status` is not `"signed"` or `referred_by_partner_id` is null/empty, the workflow exits at gate 1 and returns:

```json
{ "status": "skipped", "reason": "lead not signed or no referring partner" }
```

---

## SMS Message Template

```
Hi {partner.name}, your referral {lead.first_name} {lead.last_name} has retained our firm.
Thank you for your trust and referral. — [Firm Name] Injury Law
```

Update `[Firm Name]` to the actual firm name. If multi-tenancy requires dynamic firm names, fetch firm name from PostgREST using `firm_id` and add a node before the SMS step.

---

## Communication Log Record

The `Log Communication` node POSTs this shape to `/communications`:

```json
{
  "lead_id": "<from webhook>",
  "firm_id": "<from webhook>",
  "channel": "sms",
  "direction": "outbound",
  "message": "Referral thank-you SMS sent to partner {partner.name}",
  "status": "sent"
}
```

Ensure the `communications` table exists with at minimum: `lead_id`, `firm_id`, `channel`, `direction`, `message`, `status`, and `created_at` (defaulting to `now()`).

---

## Setup Steps

1. Import `referral-thankyou.json` into n8n via **Workflows > Import from File**.
2. Create the `PostgREST Bearer` Header Auth credential.
3. Create the `Twilio Account` credential.
4. Set `POSTGREST_URL` and `TWILIO_FROM_NUMBER` in n8n instance variables.
5. Activate the workflow — the webhook URL will be:
   `https://n8n.botonomy.xyz/webhook/referral-thankyou`
6. Replace `[Firm Name]` in the Twilio node's message body with the actual firm name.

---

## Test Procedure

### Happy path — signed lead with referring partner

```bash
curl -X POST https://n8n.botonomy.xyz/webhook/referral-thankyou \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-lead-001",
    "firm_id": "test-firm-001",
    "first_name": "Jane",
    "last_name": "Smith",
    "status": "signed",
    "referred_by_partner_id": "<real-partner-uuid-with-phone>"
  }'
```

Expected: Partner receives SMS, communication record written to PostgREST.

### Skip path — lead not signed

```bash
curl -X POST https://n8n.botonomy.xyz/webhook/referral-thankyou \
  -H "Content-Type: application/json" \
  -d '{
    "id": "test-lead-002",
    "firm_id": "test-firm-001",
    "first_name": "Bob",
    "last_name": "Jones",
    "status": "intake",
    "referred_by_partner_id": "some-partner-uuid"
  }'
```

Expected: `{ "status": "skipped", "reason": "lead not signed or no referring partner" }`

### Skip path — no referring partner

Send with `"referred_by_partner_id": null` or omit the field entirely.

### Skip path — partner has no phone

Use a partner UUID whose record has a null/empty `phone` field in PostgREST.

Expected: `{ "status": "skipped", "reason": "partner has no phone number on record" }`

---

## Known Gotchas

- PostgREST returns an array for GET responses. n8n's `httpRequest` node splits array responses into individual items, so downstream nodes reference `$json.phone` directly (not `$json[0].phone`).
- The Twilio node references partner fields via `$json` (current item = partner record) and webhook fields via `$('Webhook').item.json`.
- `$env.POSTGREST_URL` must NOT have a trailing slash.
- If PostgREST returns an empty array (partner not found), n8n will produce zero items and the `Check Partner Has Phone` node will not execute — the workflow branch simply ends silently. Add a `No Operation` or error handler if explicit logging of missing partners is needed.
