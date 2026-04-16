# Phase 12 — Platform Scale

**Milestone:** v4.1

## Scope

White-label productization and Onnex revenue infrastructure. Makes the product sellable at scale: per-firm branding, Onnex billing of clients, email integration, document templates, TLS, and a multi-firm admin console.

---

## Wave 1: White-Label Branding

**Goal:** Each deployed firm instance shows firm logo, firm name, and primary color in UI and SMS.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Migration 013: add `logo_url TEXT`, `primary_color TEXT DEFAULT '#0ea5e9'`, `sms_signature TEXT` to `firms` table | `postgres/migrations/013_platform_scale.sql` | No |
| 1.2 | Auth service: include `firm.logo_url`, `firm.primary_color`, `firm.sms_signature` in login response | `auth/main.py` | No |
| 1.3 | Frontend: read firm branding from auth context; apply `primary_color` as CSS custom property; show `logo_url` in sidebar header | `frontend/src/components/Sidebar.tsx` | No |
| 1.4 | Update all n8n SMS templates to append `firm.sms_signature` (e.g. "— Johnson Injury Law") | n8n workflows | No |
| 1.5 | Settings page: "Firm Branding" tab — logo upload, color picker, SMS signature editor | `frontend/src/pages/Settings.tsx` | No |

---

## Wave 2: Email Integration

**Goal:** SMTP configured per firm; all automation workflows send email in addition to SMS; outbox log.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Migration 013: add `smtp_host`, `smtp_port`, `smtp_user`, `smtp_password` (encrypted) to `firm_settings` | `postgres/migrations/013_platform_scale.sql` | No |
| 2.2 | Settings page: SMTP configuration section with test-send button | `frontend/src/pages/Settings.tsx` | No |
| 2.3 | Update n8n workflows: add email node after each SMS node (send email to lead.email if present, using firm SMTP). Stub: if `SMTP_HOST` unset, log email body to `communications` table (channel: 'email'). | all n8n workflows | No |
| 2.4 | Migration 013: add `email` to `channel` enum in `communications` table | `postgres/migrations/013_platform_scale.sql` | No |

---

## Wave 3: Document Templates

**Goal:** Staff can manage firm-branded templates for retainer agreement, engagement letter, LOI.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Migration 013: `document_templates` table (firm_id, template_type, name, content TEXT — HTML with {{variable}} placeholders) | `postgres/migrations/013_platform_scale.sql` | No |
| 3.2 | Seed default templates: retainer agreement, engagement letter, letter of intent to lien | `postgres/migrations/013_platform_scale.sql` | No |
| 3.3 | Frontend: "Templates" tab in Settings — list + rich-text editor per template with variable hints | `frontend/src/pages/Settings.tsx` | No |
| 3.4 | Add `POST /ai/generate-document/{template_type}/{case_id}` — merge case/client data into template → return filled document | `ai/main.py` | No |
| 3.5 | CaseDetail: "Generate from Template" button on Documents tab → select template → download filled PDF | `frontend/src/components/DocumentPanel.tsx` | No |

---

## Wave 4: TLS + Authentik SSO

**Goal:** Per-client HTTPS with valid cert; optional OIDC login for enterprises.

**Note:** Never touch Traefik config without explicit instruction — confirm with Mr. T before executing Wave 4.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Traefik Let's Encrypt config — add `certificatesResolvers.letsencrypt` to `traefik.yml`; configure ACME email | `traefik/traefik.yml` | No |
| 4.2 | Dynamic route update: add `tls.certresolver: letsencrypt` to frontend + API routes in `routes.yml` | `traefik/dynamic/routes.yml` | No |
| 4.3 | Authentik: deploy `pilaweros-authentik` service in docker-compose (behind feature flag `ENABLE_SSO`) | `docker-compose.yml` | No |
| 4.4 | Auth service: add OIDC token validation path (validate JWT from Authentik if `ENABLE_SSO=true`) | `auth/main.py` | No |

---

## Wave 5: Multi-Firm Admin Console + Stripe

**Goal:** Onnex can see all deployed instances; Stripe subscription billing for law firm clients.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | Migration 013: add `stripe_customer_id`, `stripe_subscription_id`, `subscription_status` to `firms` table | `postgres/migrations/013_platform_scale.sql` | No |
| 5.2 | New FastAPI service `billing` (port 8003): Stripe webhook handler, subscription lifecycle (create/cancel/pause), usage reporting. Stub: if `STRIPE_SECRET_KEY` unset, return `{"status": "active"}` for all webhook events. | `billing/main.py` | No |
| 5.3 | Onnex admin console page `/onnex-admin` (auth: special `onnex_admin` role) — table of all firms with subscription status, last active, user count, case count | `frontend/src/pages/OnnexAdmin.tsx` | No |
| 5.4 | Traefik route for billing service; docker-compose addition | `docker-compose.yml` | No |

---

## Success Criteria

- [ ] Firm logo and color visible in sidebar; SMS messages include firm signature
- [ ] SMTP config saves and test-send succeeds; emails sent alongside SMS in at least one workflow
- [ ] Retainer agreement template generates a filled document for a demo case
- [ ] HTTPS works with valid cert (staging cert acceptable for testing; requires domain per client)
- [ ] `/onnex-admin` page renders and shows at least the demo firm with basic stats
- [ ] Stripe webhook endpoint responds 200 to test event

---

## Technical Notes

- Stripe billing model: flat monthly per firm — $800–$1,500/mo depending on size
- Subscription lifecycle: active / paused / cancelled (simple)
- Stripe stub: use `sk_test_...` keys from env; if unset, mock all webhook responses
- TLS: requires a domain name per client — staging Let's Encrypt cert OK for testing
- Authentik SSO: feature-flagged (`ENABLE_SSO=true`) — optional enterprise add-on
- Wave 4 (Traefik): requires explicit Mr. T confirmation before executing
