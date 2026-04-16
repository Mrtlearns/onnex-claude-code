# Twilio Setup — PI Lawyer OS

## Overview

All 6 n8n automation workflows use Twilio for outbound SMS. The system runs in **test mode** by default — SMS bodies are logged to the `communications` table instead of sending real messages. Swapping to real sends requires only `.env` changes.

---

## Required `.env` Variables

Add these to `/opt/pi-lawyer-os/.env` on the server:

```env
# Twilio credentials (required for real sends)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_FROM_NUMBER=+1xxxxxxxxxx   # Twilio-verified number for this client

# Test mode (default: true — no real SMS sent)
TWILIO_TEST_MODE=true
TWILIO_TEST_TO_NUMBER=+1xxxxxxxxxx  # Verified test number (optional)

# PostgREST service role key (for n8n to write to DB)
PGRST_SERVICE_KEY=<your_service_role_jwt>
```

---

## Test Mode Behavior

| `TWILIO_TEST_MODE` | Behavior |
|---|---|
| `true` (default) | SMS body logged to `communications` table, `status = 'stub'`. No real SMS sent. |
| `false` | Real Twilio SMS sent. Communication logged with `status = 'sent'`. |

The IF node in each workflow checks `$env.TWILIO_TEST_MODE == "true"` before routing to the stub log or real Twilio node.

---

## Workflows Using Twilio

| Workflow | Trigger | SMS Target |
|----------|---------|------------|
| `speed-to-lead` | New lead created (webhook) | Lead's phone |
| `missed-call-recovery` | Twilio missed call webhook | Caller's phone (immediate + 2h follow-up) |
| `intake-reminder` | Hourly cron (leads in intake 24h+) | Lead's phone |
| `retainer-followup` | Daily 9am (contacted leads 2/5/10 days) | Lead's phone |
| `lost-lead-resurrection` | Daily 9am (inactive 30+ days) | Lead's phone |
| `referral-thankyou` | Lead signed + partner linked (webhook) | Partner's phone |

---

## n8n Credential Configuration

The Twilio credential in n8n must be created with type `twilioApi`:

```bash
# Via n8n API (run on server after stack is up)
curl -s -u "${N8N_USER}:${N8N_PASSWORD}" \
  -X POST http://localhost:5678/api/v1/credentials \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Twilio Account",
    "type": "twilioApi",
    "data": {
      "accountSid": "'"${TWILIO_ACCOUNT_SID}"'",
      "authToken": "'"${TWILIO_AUTH_TOKEN}"'"
    }
  }'
```

The credential ID `"twilio-account-cred"` is referenced in all 6 workflow JSONs.

---

## Missed Call Webhook (Twilio Console)

Configure in Twilio console for each client's phone number:

- **Voice → A call comes in → Webhook**
- URL: `http://<client-domain-or-ip>/n8n/webhook/twilio-missed-call`
- Method: `HTTP POST`

---

## Client Onboarding Checklist

1. [ ] Add Twilio credentials to client `.env` (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`)
2. [ ] Set `TWILIO_TEST_MODE=false` when ready for live SMS
3. [ ] Create Twilio credential in n8n via API (command above)
4. [ ] Configure missed call webhook URL in Twilio console
5. [ ] Activate all 6 workflows in n8n (they are imported inactive)
6. [ ] Test: create a lead → verify SMS appears in `communications` table

---

## Real Creds Swap (Zero Code Changes)

To go live for a client:

```bash
# On server: /opt/pi-lawyer-os/.env
TWILIO_TEST_MODE=false
TWILIO_ACCOUNT_SID=ACxxxxx    # client's real SID
TWILIO_AUTH_TOKEN=xxxxx        # client's real token
TWILIO_FROM_NUMBER=+1xxxxx     # client's Twilio number

# Restart n8n to pick up env changes
docker compose restart n8n
```

No workflow changes needed — the IF node reads the env var at runtime.
