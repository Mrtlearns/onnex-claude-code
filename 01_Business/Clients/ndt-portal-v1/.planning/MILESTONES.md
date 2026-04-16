# NDT Portal — Milestones

## v1.0 — Portal Foundation (COMPLETE — 2026-03-15)

**Delivered:**
- RT Calculator: views, shot types, film sizes, pricing
- UT Calculator: geometry types (flat bar, round bar, ring, tubing, C-scan, thin sheet)
- Quote history with status lifecycle (draft → pending → sent → approved → rejected)
- Dashboard with recent quotes and summary KPIs
- Settings page: Salesforce, Email, n8n integration stubs (browser localStorage)
- Tools page: embedded n8n iframe with toolbar (refresh, full-screen)
- Left sidebar nav with expand/collapse/pin, dark mode toggle
- Docker stack: traefik + nginx + postgres + postgrest×2 + api + n8n + gotenberg
- CI/CD: GitLab runner (shell, tag: ndtv1) auto-deploys on push to main
- PDF print support for UT and RT quote output

---

## v1.1 — Automated Quote Pipeline (In Progress — started 2026-03-15)

**Goal:** Fully automated email-to-quote-to-reply pipeline via n8n.

**Deliverables:**
- WF-1: Email (IMAP/Mailgun) → Claude extraction → UT quote → PDF reply
- WF-2: Email → Claude extraction → RT quote → PDF reply
- WF-3: Salesforce Flow webhook → UT quote → SF writeback
- WF-4: Unified entry classifier (optional)
- Activate HMAC + token security stubs in integrations.ts
- Integration env vars in docker-compose.yml

**Target:** TBD

---

## v2.0 — Multi-Vertical Expansion (Planned)

**Goal:** Extend portal to support additional inspection methods, client self-service portal, and analytics dashboard.

**Candidate deliverables:**
- Client-facing quote request form (public URL)
- Quote approval/rejection workflow (email link)
- Analytics: revenue by customer, volume by geometry type
- Additional inspection methods (MT, PT, VT)
- Multi-user auth (Authentik OIDC or similar)

**Target:** TBD
