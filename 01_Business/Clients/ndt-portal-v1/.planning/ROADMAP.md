# NDT Portal v1 — Roadmap

## v1.0 — Portal Foundation (COMPLETE)

### Phase 1 — Foundation: Docker Stack
**Goal:** Traefik + nginx + postgres + postgrest (ut, rt schemas) + API skeleton running and accessible.
**Success criteria:**
- `https://ndtv1.onnex.cox.playsap.us` serves the React SPA
- `/api/ut` and `/api/rt` return PostgREST responses
- All containers healthy via `docker compose ps`

### Phase 2 — RT Calculator
**Goal:** Radiographic Testing quote calculator with views, shot types, film sizes, and pricing.
**Success criteria:**
- RT quote form accepts partNumber, customerName, views (shotType, qtyPartsPerFilm, filmSizeId, times)
- Quote total calculated correctly per view
- Quote saved to `rt` schema, retrievable from quote history

### Phase 3 — UT Calculator
**Goal:** Ultrasonic Testing quote calculator with all geometry types and pricing.
**Success criteria:**
- UT quote form handles: FLAT_BAR, ROUND_BAR, RING, TUBING, CSCAN_FLAT, CSCAN_ROUND, THIN_SHEET
- Correct fields shown per geometry type (conditional rendering)
- Quote total calculated correctly per line item

### Phase 4 — Quote Management
**Goal:** Quote history list, status lifecycle, and PDF print output.
**Success criteria:**
- `/quotes` shows all saved quotes with status badges
- Status transitions: draft → pending → sent → approved → rejected
- PDF print renders complete quote layout

### Phase 5 — Dashboard + Settings + Integration Stubs
**Goal:** Dashboard KPIs, dark mode, and settings page with integration credential forms.
**Success criteria:**
- Dashboard shows recent quotes and summary metrics
- Dark/light mode toggle persists via localStorage
- Settings page has Salesforce, Email, n8n tabs with save/load from localStorage

### Phase 6 — Tools / n8n Embedded + CI/CD Pipeline
**Goal:** Embed n8n under /n8n/ sub-path; Tools page with iframe; GitLab CI/CD auto-deploy.
**Success criteria:**
- `/tools` shows n8n iframe with toolbar (refresh, open in new tab)
- `/n8n/` routes to live n8n instance (not nginx SPA fallback)
- Push to main auto-deploys via `ndtv1` shell runner

---

## v1.1 — Automated Quote Pipeline (Planned)

### Phase 7 — Automated Quote Pipeline (n8n Workflows)
**Goal:** End-to-end automated quoting: email/Salesforce intake → Claude extraction → validation → API → PDF → reply.
**Success criteria:**
- WF-1: Send UT email → receive PDF quote reply within 60s
- WF-2: Send RT email → receive PDF quote reply within 60s
- WF-3: Salesforce Flow callout → UT quote created → SF writeback (NDT_Quote_Number__c et al.)
- Integration security stubs activated (HMAC + X-N8N-Token)
- Quote status progresses: draft → pending → sent automatically

**Sub-phases:**
1. Activate security stubs + env vars (~1h portal code)
2. WF-1: Email → UT Quote (~2-3h n8n)
3. WF-2: Email → RT Quote (~1h n8n)
4. WF-3: Salesforce → UT Quote (~1h n8n)
5. WF-4: Unified classifier (optional, ~1h n8n)

See: `.planning/phases/07-automated-quote-pipeline/07-CONTEXT.md`

---

## v2.0 — Multi-Vertical Expansion (Planned)

Phases TBD — to be defined when v1.1 is complete.
Candidates: client self-service form, approval workflow, analytics, additional inspection methods (MT, PT, VT), multi-user auth.
