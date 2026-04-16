# n8n Workflows — NDT Automated Quote Pipeline

## Import Order

Import into n8n at: **Settings → Workflows → Import from file**

| File | WF | Purpose |
|------|----|---------|
| `WF-1-email-ut-quote.json` | WF-1 | Email → UT Quote → PDF → Reply |
| `WF-2-email-rt-quote.json` | WF-2 | Email → RT Quote → PDF → Reply |
| `WF-3-salesforce-ut-quote.json` | WF-3 | Salesforce → UT Quote → SF Writeback |
| `WF-4-unified-classifier.json` | WF-4 | Any input → Claude classifies → routes to WF-1/2/3 |

---

## Required n8n Credentials

Create these in **Settings → Credentials** before activating:

### 1. Anthropic (Claude) — `anthropicApi`
- API Key from console.anthropic.com

### 2. IMAP — `imap` (for WF-1 + WF-2)
- Host, port, username, password for the intake email account
- Suggest a dedicated mailbox: `quotes@yourdomain.com`

### 3. SMTP — `smtp` (for WF-1 + WF-2)
- Outbound email for quote replies
- Can use Mailgun SMTP, SendGrid SMTP, or direct

### 4. Salesforce OAuth2 — `oAuth2Api` (for WF-3)
- Grant Type: **Client Credentials**
- Client ID / Secret from the **External Client App** (not Connected App)
- Token URL: `https://ndt.my.salesforce.com/services/oauth2/token`
- ⚠ Must use `ndt.my.salesforce.com` — NOT `login.salesforce.com`
- Required Salesforce fields on Opportunity object:
  - `NDT_Quote_Number__c` (Text 50)
  - `NDT_Quote_Total__c` (Currency)
  - `NDT_Quote_Status__c` (Picklist: Calculated, Sent)
  - `NDT_Quote_Date__c` (DateTime)

---

## Required Environment Variables

Set in `docker-compose.yml` → `api` service before deploying:

```env
SF_WEBHOOK_SECRET=<random 32+ char secret — match in SF Flow>
N8N_WEBHOOK_SECRET=<random 32+ char secret — used in X-N8N-Token header>
EMAIL_FROM=quotes@yourdomain.com
EMAIL_API_KEY=<Mailgun or SendGrid key>
SF_INSTANCE_URL=https://yourorg.my.salesforce.com
SF_CLIENT_ID=<Connected App consumer key>
SF_CLIENT_SECRET=<Connected App consumer secret>
```

---

## Gotenberg (PDF Service)

Gotenberg is included in `docker-compose.yml` as the `gotenberg` service.
It runs on port 3000 internally and is accessible to both the API and n8n via Docker networking.

No configuration needed — it starts automatically with `docker compose up`.

---

## Architecture Notes

- **WF-1 + WF-2** poll the configured IMAP inbox. Only one workflow should be active per inbox,
  OR configure separate mailboxes (e.g., `ut-quotes@` and `rt-quotes@`).
  WF-4 is the recommended approach when a single inbox handles both.

- **WF-4** is the unified entry point. It detects payload type without LLM for structured inputs,
  and invokes Claude only for unstructured email text. Use WF-4 + single inbox for production.

- **PDF generation** uses Gotenberg (self-hosted Chromium). The HTML template is built in n8n
  Code nodes and does not require changes to the API container.

- **Salesforce writeback** is handled by WF-3 (n8n HTTP Request with OAuth2), keeping the
  API stateless. The `sfWriteback.ts` stub in the portal is not used.

---

## Testing

```bash
# 1. Direct n8n quote (bypasses email):
curl -X POST https://ndtv1.onnex.cox.playsap.us/api/integrations/n8n/quote \
  -H "X-N8N-Token: <N8N_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"customerName":"PREMCO","source":"api","items":[{"geometryType":"FLAT_BAR","thickness":3.625,"width":11.625,"length":15.75,"quantity":200}]}'

# 2. Salesforce simulation:
curl -X POST https://n8n.botonomy.xyz/webhook/salesforce-ut-quote \
  -H "Content-Type: application/json" \
  -d '{"opportunityId":"TEST-001","accountName":"PREMCO","lineItems":[{"geometryType":"FLAT_BAR","thickness":3.625,"width":11.625,"length":15.75,"quantity":200}]}'

# 3. Email test: send to the configured IMAP inbox:
#    Subject: Quote Request
#    Body: "We need UT on 200 flat bars, 3.625" thick, 11.625" wide, 15.75" long. Customer: PREMCO"
#    → Expect reply within ~30s with PDF attached, quote visible in portal at status "sent"
```
