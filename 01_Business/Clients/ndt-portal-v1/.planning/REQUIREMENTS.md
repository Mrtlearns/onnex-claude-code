# NDT Portal v1 — Requirements

## v1.0 Requirements (COMPLETE)

### Portal Foundation
- ✓ RT quote form: partNumber, customerName, views (shotType, qty, filmSize, times)
- ✓ UT quote form: all 7 geometry types with conditional field rendering
- ✓ Quote history list with status badges
- ✓ Status lifecycle: draft → pending → sent → approved → rejected
- ✓ PATCH /api/ut/quote/:id/status endpoint
- ✓ PDF print layout for RT and UT quotes
- ✓ Dashboard: recent quotes, summary KPIs
- ✓ Dark/light mode toggle (localStorage)
- ✓ Settings: Salesforce, Email, n8n credential forms (localStorage)
- ✓ Sidebar: collapsible, pinnable, Tools nav item
- ✓ Tools page: n8n iframe with refresh + open-in-new-tab controls
- ✓ n8n embedded at /n8n/ sub-path (same-origin iframe)
- ✓ Gotenberg for PDF generation
- ✓ GitLab CI/CD auto-deploy (ndtv1 shell runner)
- ✓ E2E Playwright tests (01-navigation through 08-tools specs)

---

## v1.1 Requirements — Automated Quote Pipeline

### Security Activation
- [ ] Add SF_INSTANCE_URL, SF_CLIENT_ID, SF_CLIENT_SECRET, SF_USERNAME, SF_PASSWORD, SF_WEBHOOK_SECRET to docker-compose.yml
- [ ] Add EMAIL_API_KEY, EMAIL_FROM, EMAIL_WEBHOOK_SECRET to docker-compose.yml
- [ ] Add N8N_WEBHOOK_SECRET to docker-compose.yml
- [ ] Uncomment HMAC signature verification in integrations.ts (line ~82)
- [ ] Uncomment X-N8N-Token validation in integrations.ts (line ~244)

### n8n Workflows
- [ ] WF-1: IMAP/Mailgun trigger → Claude extraction (UT fields) → prerequisite validation → POST /api/ut/quote → PATCH status pending → HTML→PDF → email reply → PATCH status sent
- [ ] WF-2: Same as WF-1 for RT (RT fields, POST /api/rt/quote)
- [ ] WF-3: Salesforce Flow HTTP callout webhook → UT quote → PATCH status → SF REST PATCH (NDT_Quote_Number__c, NDT_Quote_Total__c, NDT_Quote_Status__c, NDT_Quote_Date__c)
- [ ] WF-4: Unified classifier (optional) — Claude LangChain node routes to WF-1/2/3

### UT Prerequisite Matrix (WF-1 validation nodes)
- geometryType, quantity, customerName — always required
- thickness, width — required for FLAT_BAR, CSCAN_FLAT, THIN_SHEET
- length — required for FLAT_BAR, ROUND_BAR, RING, TUBING, CSCAN_FLAT, CSCAN_ROUND, THIN_SHEET
- diameter — required for ROUND_BAR, CSCAN_ROUND, TUBING
- outerDiameter, innerDiameter — required for RING

### RT Prerequisite Matrix (WF-2 validation nodes)
- partNumber, customerName — always required
- Per view: viewNumber, shotType (0-3), qtyPartsPerFilm, filmSizeId/filmSizeLabel
- Per view: unpackLoadTime, darkroomSortTime, shotTime, readTime
