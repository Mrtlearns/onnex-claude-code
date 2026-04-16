# Phase 7 — Automated Quote Pipeline: Context

## Domain

**In scope:**
- n8n workflow files (WF-1 through WF-4) built in the embedded n8n instance
- Activating HMAC + token security stubs in `api/src/routes/integrations.ts`
- Adding integration env vars to `docker-compose.yml`
- Email trigger configuration (IMAP or Mailgun inbound webhook)
- Salesforce Flow callout webhook handling

**Out of scope:**
- Frontend changes (portal is feature-complete for v1.0)
- New API routes (all integration endpoints already exist)
- Database schema changes
- New Docker services

## Decisions Already Made

| Decision | Choice |
|----------|--------|
| Orchestration | n8n (self-hosted at /n8n/ on ndtv1 server) |
| LLM for extraction | Claude API via n8n LangChain node |
| PDF generation | n8n HTML template → PDF node (Gotenberg available as fallback) |
| SF writeback | n8n HTTP Request → Salesforce REST API |
| Email trigger | IMAP or Mailgun inbound webhook (decide per WF-1 planning) |
| Prerequisite validation | n8n IF / Switch nodes (deterministic, no LLM) |

## Specifics

- n8n is accessible at `https://ndtv1.onnex.cox.playsap.us/n8n/` and embedded in `/tools` page
- Portal API base: `https://ndtv1.onnex.cox.playsap.us`
- UT quote endpoint: `POST /api/ut/quote` → returns `{ quoteId, quoteNumber, grandTotal, ... }`
- RT quote endpoint: `POST /api/rt/quote` → same response shape
- Status PATCH: `PATCH /api/ut/quote/:id/status` with `{ status: "pending" | "sent" | ... }`
- n8n LangChain node needs ANTHROPIC_API_KEY set in n8n credentials
- X-N8N-Token header: must match N8N_WEBHOOK_SECRET env var (add to docker-compose.yml)

## Code Context

Integration routes are in `api/src/routes/integrations.ts`:
- Line ~82: HMAC verification block (commented out — uncomment for production)
- Line ~244: X-N8N-Token validation block (commented out — uncomment for production)
- Salesforce writeback stub: `api/src/lib/sfWriteback.ts` (or defer to n8n)

## Deferred to Future Phases

- Client self-service quote request form (v2.0)
- Multi-method classifier beyond UT/RT (v2.0)
- Quote approval/rejection email workflow (v2.0)
