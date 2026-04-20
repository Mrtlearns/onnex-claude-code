# To-Do: Chatwoot Unified Messaging Integration

> Status: Pending — start after v3.0 hardening
> Priority: Phase 13 prep

---

## Architecture

```
Channels  ──►  Chatwoot (chat.agencyos-v1.on-nex.us)  ──►  n8n webhooks  ──►  AIOS API
• Website widget (portal + marketing)        Rails + Vue                Route by tenant     Tasks / Notifications
• Email (IMAP/SMTP per tenant inbox)         PG + Redis                 + event type        Contacts / Messages tab
• WhatsApp (360dialog / WATI BSP)            Multi-account                                  Agent-bot API → auto-reply
• SMS (Twilio)                               (one per tenant)
• Messenger / IG DM (optional)
```

**Deployment:** Separate service on `chat.agencyos-v1.on-nex.us` via Traefik — NOT inside the AIOS monorepo. Single Chatwoot instance, one account per tenant.

---

## Tier 1 — Standalone Deploy + Embedded Widget

- [ ] Add Chatwoot service block to `outputs/01-03-compose.yml`
  - Image: `chatwoot/chatwoot:v3.x` (pin exact tag)
  - Init: `bundle exec rails db:chatwoot_prepare`
  - Workers: `rails_web`, `sidekiq`
  - Volumes: storage, public
  - Env: `FRONTEND_URL`, `SECRET_KEY_BASE`, `REDIS_URL`, `POSTGRES_*`, `MAILER_SENDER_EMAIL`, SMTP vars
- [ ] Traefik labels: `Host(\`chat.agencyos-v1.on-nex.us\`)`, TLS via existing resolver
- [ ] DNS: `chat.agencyos-v1.on-nex.us` A record → VM public IP
- [ ] Bootstrap super-admin, create first tenant account
- [ ] Configure website inbox, capture widget token
- [ ] Embed widget in `apps/web/src/app/(portal)/layout.tsx` (HMAC identity verification)
- [ ] Verify: portal test message → appears in Chatwoot inbox

## Tier 2 — Webhook → n8n → AIOS

- [ ] Chatwoot: add webhook integration → n8n endpoint
- [ ] n8n workflow `chatwoot-message-received`:
  - Filter: `message_created`, `conversation_created`, `conversation_resolved`
  - Resolve tenant from account_id → AIOS tenant_id
  - Branch: notification / Task creation / ActivityEvent log
- [ ] Migration `024_inbound_messages.sql`:
  `id`, `tenant_id`, `contact_id`, `chatwoot_account_id`, `chatwoot_conversation_id`, `chatwoot_message_id`, `direction`, `body`, `channel`, `created_at`
- [ ] AIOS route `POST /api/v1/inbound-messages`
- [ ] UI: "Messages" tab on Contact detail page with Chatwoot deep link
- [ ] Verify: inbound email → AIOS notification for account manager

## Tier 3 — Bidirectional Sync (Phase 13, deferred)

- [ ] AIOS Contact create/update → upsert Chatwoot contact
- [ ] "Send message" UI on Contact → Chatwoot API
- [ ] Agent-bot API → AI assistant auto-acknowledgements
- [ ] AIOS task `Done` → Chatwoot conversation `resolved`

---

## Files

| File | Change |
|------|--------|
| `outputs/01-03-compose.yml` | Add `chatwoot`, `chatwoot-sidekiq` + Traefik labels |
| `outputs/01-03-env` | Chatwoot env vars |
| `infra/docs/chatwoot-runbook.md` | New runbook |
| `apps/api/src/db/migrations/024_inbound_messages.sql` | New |
| `apps/api/src/routes/inbound-messages.ts` | New |
| `apps/web/src/app/(portal)/layout.tsx` | Embed widget |
| `apps/web/src/app/(protected)/clients/[id]/components/client-messages-tab.tsx` | New |
| `context/CHATWOOT-ARCHITECTURE.md` | New design doc |
| n8n: `chatwoot-message-received.json` | New workflow |

---

## Watch Items

- Rails + Sidekiq ~1–1.5 GB RAM — monitor after deploy
- Chatwoot owns its DB schema — integrate via webhooks + refs only, never cross-query
- WhatsApp BSP cost ~$0.005–0.08/conversation — budget before enabling
- HMAC identity verification required on widget to prevent spoofing

---

## Effort

| Tier | Estimate |
|------|----------|
| Tier 1 | 1–2 days |
| Tier 2 | 2–3 days |
| Tier 3 | ~1 week (Phase 13) |
