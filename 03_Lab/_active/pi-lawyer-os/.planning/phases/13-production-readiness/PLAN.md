# Phase 13 — Production Readiness

**Milestone:** v5.0
**Status:** TODO
**Priority:** Required before multi-client SaaS operation

---

## Context

All 12 product phases are complete. The PI Lawyer OS is fully deployable to a single client firm. This phase closes the 5 remaining gaps identified in the post-v4.1 gap analysis — the items that block Onnex from operating this product at scale (multiple clients, automated billing, real TLS, real email delivery, and hands-free deploys).

**None of these are features end-users see day-to-day.** They are Onnex operator infrastructure. A single firm can be onboarded today without this phase complete. But any second client, any billing event, or any push-to-deploy workflow requires this phase.

---

## The 5 Items

1. **Traefik n8n webhook routing** — Twilio can't reach n8n webhooks externally (404). Blocks real SMS automation.
2. **Email delivery in n8n workflows** — SMTP config is stored but no workflow actually sends email. Leads only get SMS.
3. **Stripe billing service** — Schema columns exist on `firms` but there is no webhook handler, subscription lifecycle, or billing API. Onnex cannot bill clients programmatically.
4. **TLS + Let's Encrypt** — All deployments are HTTP-only. Required for any real client (browser security warnings, Twilio requires HTTPS for webhooks).
5. **CI/CD pipeline** — Deploys are manual SSH. Required for any dev→production workflow at scale.

---

## Item 1 — Traefik n8n Webhook Routing Fix

### Root Cause

Traefik routes `PathPrefix('/n8n')` → n8n:5678 **without stripping the prefix**. n8n receives the full path `/n8n/webhook/<webhookId>`, but n8n's internal router expects `/webhook/<webhookId>` (it doesn't know about the `/n8n` prefix). Result: 404 from n8n.

n8n's `WEBHOOK_URL` env var is already set to `http://${APP_DOMAIN}/n8n/` which tells n8n to advertise webhooks at `/n8n/webhook/...` externally — that part is correct. The problem is Traefik is not stripping the prefix before forwarding.

### Fix

**File: `traefik/dynamic/routes.yml`**

Add a `strip-n8n-prefix` middleware:

```yaml
http:
  middlewares:
    strip-n8n-prefix:
      stripPrefix:
        prefixes:
          - "/n8n"
```

**File: `docker-compose.yml`** — n8n service labels

Add the middleware to the n8n router:

```yaml
- "traefik.http.routers.n8n.middlewares=strip-n8n-prefix@file"
```

Existing label (keep):
```yaml
- "traefik.http.routers.n8n.rule=Host(`${APP_DOMAIN}`) && PathPrefix(`/n8n`)"
```

### Verification

After deploying:
```bash
# On server — trigger n8n test webhook
curl -i http://<APP_DOMAIN>/n8n/webhook-test/<workflow-webhook-id>
# Must return 200 (or workflow response), NOT 404

# Confirm n8n UI still accessible
curl -I http://<APP_DOMAIN>/n8n/
# Must return 200
```

Also update the n8n `WEBHOOK_URL` env — with strip-prefix active, n8n receives paths without `/n8n`, so its internal URLs must match:

```yaml
# docker-compose.yml — n8n service
WEBHOOK_URL: http://${APP_DOMAIN}/n8n/
```

> **Note:** Keep `WEBHOOK_URL` as-is (`/n8n/` prefix). n8n uses this to *advertise* webhook URLs to external systems (Twilio). With strip-prefix, Traefik strips `/n8n` before forwarding, but Twilio still POSTs to the advertised `/n8n/webhook/...` URL — which Traefik then strips and forwards correctly. The path Twilio POSTs to and the path n8n internally receives are now both correct.

### Impact

Unblocks: missed-call-recovery, after-hours-ivr, and any future Twilio voice/SMS webhook triggers.

---

## Item 2 — Email Delivery in n8n Workflows

### Scope

Add an SMTP `Send Email` node after the Twilio SMS node in all 6 automation workflows. Email is only sent when `lead.email` is present. Use SMTP credentials from the `firms` table (already stored via Phase 12).

### Approach

n8n can call the auth service to fetch SMTP config, or SMTP creds can be stored as an n8n credential. The cleanest approach for multi-tenant use: expose a new auth endpoint `GET /auth/firm-smtp` that returns the SMTP config for the JWT's firm, and call it from each workflow before the email node.

However, n8n does not have the staff JWT — it calls PostgREST via a service-role key. The simplest reliable approach: **store SMTP as n8n environment variables in docker-compose** (per-client deployment, so one set of creds per instance).

```yaml
# docker-compose.yml — n8n service
SMTP_HOST: ${SMTP_HOST:-}
SMTP_PORT: ${SMTP_PORT:-587}
SMTP_USER: ${SMTP_USER:-}
SMTP_PASSWORD: ${SMTP_PASSWORD:-}
SMTP_FROM: ${SMTP_FROM:-noreply@pilaweros.local}
```

n8n has a built-in `n8n-nodes-base.emailSend` node that uses these or a stored credential.

### Workflow Changes (all 6 automation workflows)

For each of the 6 SMS workflows, after the existing Twilio SMS node, add:

1. **IF node** — `lead.email` is not empty (skip email entirely if no email on file)
2. **Send Email node** — SMTP; To: `{{lead.email}}`; Subject: `[Firm Name] — Your Case Update`; Body: same message as SMS + firm signature
3. **Postgres INSERT node** — log to `communications` table with `channel='email'`, `direction='outbound'`

Stub behavior: if `SMTP_HOST` is empty, route to the existing stub log node instead (same `communications` INSERT, `channel='email_stub'`).

### Files to Update

```
n8n/workflows/speed-to-lead.json
n8n/workflows/missed-call-recovery.json
n8n/workflows/intake-reminder.json
n8n/workflows/retainer-followup.json
n8n/lost-lead-resurrection.json
n8n/referral-thankyou.json
docker-compose.yml           (add SMTP env vars to n8n service)
.env.example                 (add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM)
docs/SMTP-SETUP.md           (new — client onboarding doc)
```

### Verification

```bash
# Set SMTP env to stub (empty SMTP_HOST), create test lead
# Query communications for both sms and email_stub rows
docker compose exec -T postgres psql -U postgres pilaweros \
  -c "SELECT channel, direction, message FROM communications WHERE lead_id='<test_id>' ORDER BY created_at;"
# Must show: channel=sms AND channel=email_stub (or email if real SMTP configured)
```

---

## Item 3 — Stripe Billing Service

### Scope

A minimal FastAPI `billing` service that handles Stripe subscription lifecycle for Onnex billing law firm clients. This is Onnex infrastructure — law firm users never see it.

### Architecture

```
billing/
  main.py          FastAPI — Stripe webhook handler + billing API
  Dockerfile
```

New Traefik route: `/billing` → billing:8003 (internal only — or exposed with auth).

### Stripe Webhook Events to Handle

| Event | Action |
|-------|--------|
| `customer.subscription.created` | Set `firms.subscription_status='active'`, store `stripe_subscription_id` |
| `customer.subscription.updated` | Update `subscription_status` (active/past_due/paused) |
| `customer.subscription.deleted` | Set `subscription_status='cancelled'`; optionally disable firm login |
| `invoice.payment_failed` | Set `subscription_status='past_due'`; log to `billing_events` table |
| `invoice.payment_succeeded` | Set `subscription_status='active'` |

### New Migration (`014_billing.sql`)

```sql
-- Billing event log
CREATE TABLE billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id UUID REFERENCES firms(id),
  event_type TEXT NOT NULL,
  stripe_event_id TEXT UNIQUE,
  amount_cents INTEGER,
  status TEXT,
  raw JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Billing API Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `POST /billing/webhook` | Stripe-Signature header | Stripe webhook receiver |
| `GET /billing/status/{firm_id}` | Internal key | Returns subscription_status for a firm |
| `POST /billing/create-customer` | Internal key | Creates Stripe customer for new firm + stores stripe_customer_id |

### Onnex Admin Console (minimal)

A simple read-only page at `/onnex-admin` in the React frontend:

- Auth: requires `user_role='onnex_admin'` (new role constant — add to JWT claims)
- Shows table of all firms: name, subscription_status, created_at, user count, case count
- Data from: `GET /api/firms?select=id,name,slug,subscription_status,created_at` (service JWT)

### docker-compose.yml Additions

```yaml
billing:
  build: ./billing
  container_name: pilaweros-billing
  environment:
    DATABASE_URL: postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/pilaweros
    STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-sk_test_stub}
    STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-whsec_stub}
    INTERNAL_API_KEY: ${INTERNAL_API_KEY:-pilaweros_internal_key_changeme}
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.billing.rule=Host(`${APP_DOMAIN}`) && PathPrefix(`/billing`)"
    - "traefik.http.routers.billing.entrypoints=web"
    - "traefik.http.services.billing.loadbalancer.server.port=8003"
    - "traefik.http.middlewares.strip-billing.stripprefix.prefixes=/billing"
    - "traefik.http.routers.billing.middlewares=strip-billing"
  networks:
    - pilaweros
  depends_on:
    - postgres
```

### .env Additions

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stub Behavior

If `STRIPE_SECRET_KEY` starts with `sk_test_stub`, all Stripe API calls are skipped — webhook endpoint still accepts and processes event JSON but uses Stripe's test mode signatures. Zero code changes to go live.

### Verification

```bash
# Stripe CLI: forward test events to local billing service
stripe listen --forward-to http://<APP_DOMAIN>/billing/webhook

# Send test subscription event
stripe trigger customer.subscription.created

# Check DB
docker compose exec -T postgres psql -U postgres pilaweros \
  -c "SELECT name, subscription_status FROM firms LIMIT 5;"
# Should show status updated
```

---

## Item 4 — TLS + Let's Encrypt (Per-Client)

### Scope

Enable HTTPS with valid Let's Encrypt certificate via Traefik ACME. This is a per-client config step (each client needs a real domain). The config supports it; it just needs to be switched on.

### Prerequisite

- Client must have a domain pointing to the VM's public IP (A record)
- Port 80 must be open for ACME HTTP-01 challenge
- Port 443 must be open for HTTPS traffic

### Changes

**File: `traefik/traefik.yml`**

Add certificatesResolvers section:

```yaml
certificatesResolvers:
  letsencrypt:
    acme:
      email: ${ACME_EMAIL:-ops@onnex.ai}
      storage: /letsencrypt/acme.json
      httpChallenge:
        entryPoint: web
```

Add HTTPS redirect and volume:

```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"
```

**File: `docker-compose.yml`** — traefik service

Add volume mount and expose port 443:

```yaml
traefik:
  ports:
    - "80:80"
    - "443:443"   # add this
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - ./traefik/traefik.yml:/etc/traefik/traefik.yml:ro
    - ./traefik/dynamic:/etc/traefik/dynamic:ro
    - letsencrypt:/letsencrypt   # add this
```

Add to volumes section:
```yaml
volumes:
  letsencrypt:    # add this
```

Add TLS to all router labels:

```yaml
# For each service router label in docker-compose.yml:
- "traefik.http.routers.<service>.entrypoints=websecure"
- "traefik.http.routers.<service>.tls.certresolver=letsencrypt"
```

**File: `.env`**

```
ACME_EMAIL=ops@onnex.ai
```

### Deployment Steps (per client)

```bash
# 1. Set APP_DOMAIN to client's real domain in .env
# 2. Point client's DNS A record to VM public IP
# 3. Confirm DNS propagated: dig +short A <client-domain>
# 4. Deploy with TLS config:
docker compose up -d traefik
# 5. Watch cert acquisition:
docker compose logs -f traefik | grep -i acme
# 6. Verify HTTPS:
curl -I https://<client-domain>/auth/health
```

### IP-Only Deployments (demo/dev)

For IP-based deployments (10.10.110.33), TLS is not possible with ACME. Keep a `TLS_ENABLED=false` guard:

```yaml
# In .env for IP-only deployments:
TLS_ENABLED=false
```

Use `docker-compose.override.yml` pattern to disable TLS labels for IP deployments.

### Twilio Webhook Impact

Once TLS is enabled, update all Twilio webhook URLs from `http://` to `https://`. Update `WEBHOOK_URL` in n8n service:

```yaml
WEBHOOK_URL: https://${APP_DOMAIN}/n8n/
```

### Verification

```bash
# Certificate issued
curl -I https://<client-domain>/auth/health
# Must return 200 with valid TLS cert (not self-signed)

# HTTP redirects to HTTPS
curl -I http://<client-domain>/auth/health
# Must return 301 → https://
```

---

## Item 5 — CI/CD Pipeline (GitLab CI)

### Scope

Auto-deploy to the production server on push to `main`. GitLab CI (self-hosted runner already on ndtv1 or server). Pipeline: lint → build → test → deploy.

### Pipeline Design

**File: `.gitlab-ci.yml`** (project root of pi-lawyer-os)

```yaml
stages:
  - lint
  - build
  - test
  - deploy

variables:
  DEPLOY_HOST: "10.10.110.33"
  DEPLOY_DIR: "/opt/pi-lawyer-os"
  DEPLOY_USER: "root"

# ─── Lint ────────────────────────────────────────────────────────────
frontend-lint:
  stage: lint
  image: node:20-alpine
  script:
    - cd frontend
    - npm ci
    - npx tsc --noEmit
  rules:
    - changes: ["frontend/**/*"]

# ─── Build ───────────────────────────────────────────────────────────
docker-build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  script:
    - docker build -t pi-lawyer-os/frontend:${CI_COMMIT_SHORT_SHA} ./frontend
    - docker build -t pi-lawyer-os/auth:${CI_COMMIT_SHORT_SHA} ./auth
    - docker build -t pi-lawyer-os/ai:${CI_COMMIT_SHORT_SHA} ./ai
    - docker build -t pi-lawyer-os/files:${CI_COMMIT_SHORT_SHA} ./files
  rules:
    - if: $CI_COMMIT_BRANCH == "main"

# ─── Test (Playwright) ───────────────────────────────────────────────
playwright:
  stage: test
  image: mcr.microsoft.com/playwright:v1.50.0-jammy
  script:
    - cd playwright-tests
    - npm ci
    - npx playwright test --reporter=junit
  artifacts:
    reports:
      junit: playwright-tests/test-results/junit.xml
    paths:
      - playwright-tests/test-results/
    expire_in: 7 days
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  allow_failure: false

# ─── Deploy ──────────────────────────────────────────────────────────
deploy-production:
  stage: deploy
  image: alpine:3.18
  before_script:
    - apk add --no-cache openssh-client rsync
    - eval $(ssh-agent -s)
    - echo "$DEPLOY_SSH_KEY" | tr -d '\r' | ssh-add -
    - mkdir -p ~/.ssh && chmod 700 ~/.ssh
    - ssh-keyscan -H $DEPLOY_HOST >> ~/.ssh/known_hosts
  script:
    # Sync changed files (excluding node_modules, .git, local .env)
    - >
      rsync -az --delete
      --exclude='.git'
      --exclude='node_modules'
      --exclude='.env'
      --exclude='playwright-tests/test-results'
      ./ ${DEPLOY_USER}@${DEPLOY_HOST}:${DEPLOY_DIR}/
    # Pull new images and redeploy (zero-downtime for stateless services)
    - >
      ssh ${DEPLOY_USER}@${DEPLOY_HOST}
      "cd ${DEPLOY_DIR} &&
       docker compose build frontend auth ai files &&
       docker compose up -d --remove-orphans &&
       docker compose restart postgrest"
  environment:
    name: production
    url: http://$DEPLOY_HOST
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
  when: on_success
```

### GitLab CI Variables to Configure

Set these in GitLab → Settings → CI/CD → Variables (masked):

| Variable | Value | Notes |
|----------|-------|-------|
| `DEPLOY_SSH_KEY` | Private key for root@10.10.110.33 | Generate dedicated deploy key |
| `APP_DOMAIN` | Client domain or IP | Per-environment |

### Runner Requirements

- Use the existing self-hosted GitLab runner (ndtv1, confirmed available)
- Runner must have Docker-in-Docker enabled for `docker-build` stage
- Or: skip docker-build stage and let deploy stage do the `docker compose build` on the server directly (simpler, slightly slower)

### Simplified Alternative (SSH-only, no Docker-in-Docker)

If DinD is not available on the runner, collapse build + deploy into one SSH step:

```yaml
deploy-production:
  stage: deploy
  script:
    - ssh ${DEPLOY_USER}@${DEPLOY_HOST} "
        cd ${DEPLOY_DIR} &&
        git pull origin main &&
        docker compose build frontend auth ai files &&
        docker compose up -d --remove-orphans &&
        docker compose restart postgrest
      "
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
```

This is simpler and avoids DinD complexity. The server pulls from GitLab directly.

### Verification

```bash
# After pipeline runs, check server state
ssh root@10.10.110.33 "cd /opt/pi-lawyer-os && docker compose ps"
# All services must show "Up"

# Check frontend build timestamp matches deploy
ssh root@10.10.110.33 "docker inspect pilaweros-frontend | grep Created"
```

---

## Execution Order

| Order | Item | Effort | Dependency |
|-------|------|--------|------------|
| 1 | Traefik n8n webhook fix | Low (30 min) | None — fix now |
| 2 | TLS + Let's Encrypt | Low (1 hr) | Requires real domain per client |
| 3 | CI/CD pipeline | Medium (2 hr) | Requires GitLab runner config |
| 4 | Email in workflows | Medium (3 hr) | None — can run on HTTP |
| 5 | Stripe billing service | High (1–2 days) | Requires Stripe account + test keys |

Item 1 (webhook fix) should be done immediately — it's 3 lines of config and unblocks real Twilio automation. Items 2–4 can be done in any order. Item 5 (Stripe) is the largest and should be scheduled as its own work block.

---

## Success Criteria

- [ ] `curl -i http://<domain>/n8n/webhook/<id>` returns 200 (not 404) — Twilio webhooks reachable
- [ ] Test lead created → `communications` table shows both `channel='sms'` and `channel='email'` rows
- [ ] `stripe trigger customer.subscription.created` → `firms.subscription_status` updated in DB
- [ ] `curl -I https://<client-domain>/auth/health` returns 200 with valid TLS cert
- [ ] `curl -I http://<client-domain>/` returns 301 → https
- [ ] Push to `main` → GitLab pipeline runs → server updated automatically → `docker compose ps` all Up

---

## Files To Create / Modify

```
.gitlab-ci.yml                                 NEW
billing/main.py                                NEW
billing/Dockerfile                             NEW
postgres/migrations/014_billing.sql            NEW
docs/SMTP-SETUP.md                             NEW
docs/TLS-SETUP.md                              NEW
frontend/src/pages/OnnexAdmin.tsx              NEW
traefik/traefik.yml                            MODIFY (add certificatesResolvers)
traefik/dynamic/routes.yml                     MODIFY (add strip-n8n-prefix middleware)
docker-compose.yml                             MODIFY (n8n middleware, billing service, TLS labels, SMTP env, letsencrypt volume)
n8n/workflows/speed-to-lead.json              MODIFY (add email node + log)
n8n/workflows/missed-call-recovery.json       MODIFY
n8n/workflows/intake-reminder.json            MODIFY
n8n/workflows/retainer-followup.json          MODIFY
n8n/lost-lead-resurrection.json               MODIFY
n8n/referral-thankyou.json                    MODIFY
.env.example                                   MODIFY (add SMTP_*, STRIPE_*, ACME_EMAIL)
```
