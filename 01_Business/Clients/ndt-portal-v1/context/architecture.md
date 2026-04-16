# NDT Portal — Architecture

> Last updated: 2026-04-04
> Covers changes through: Workshop Dashboard (migration 027, SSE real-time, multi-machine scheduling, SimulationContext, JobDetailModal)

## Overview

NDT Portal is a React + Express + PostgreSQL system for quoting and managing Non-Destructive Testing jobs. It supports UT (Ultrasonic Testing) and RT (Radiographic Testing) quote workflows, Salesforce historical data sync, an AI-powered analytics dashboard, a BOM (Bill of Materials) lookup tool, an automated inspection pipeline, PDF quote generation (via Gotenberg), and an admin panel with job run tracking, and a real-time Workshop Dashboard for scheduling and tracking daily inspection jobs across multiple NDT inspection types.

---

## Frontend (Vite + React 19)

Served by nginx. Reverse-proxied through Traefik on port 8888.

Dark/light theme toggle stored in `localStorage['theme']`. Analytics dashboard overrides this with a forced dark `bg-slate-950` base (glassmorphism design requires dark).

### Route Map

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `DashboardsApp` | Tabbed dashboard: Overview + Analysis |
| `/rt/*` | `RtApp` | RT costing workflow |
| `/ut/*` | `UtApp` | UT calculator |
| `/quotes` | `QuotesApp` | Quote history across UT/RT — with Edit, Download PDF, and View PDF (inline iframe) per row |
| `/sf-analysis` | `SfAnalysisApp` | Salesforce Analysis — 3 tabs: Customer Orders, Parts Catalog, AI Chat |
| `/settings` | `SettingsApp` | Integration settings (LLM, SF, Email, n8n, Dashboards) |
| `/tools/*` | `ToolsApp` | Embedded tools (n8n UI) |
| `/analysis/:intakeId` | `AnalysisPage` | Single-run pipeline analysis view |
| `/audit` | `PipelineHistory` | All pipeline runs history list |
| `/audit/:intakeId` | `ExecutionLogViewer` | Detailed per-step pipeline execution log |
| `/admin/*` | `AdminApp` | Admin panel — background job history + diagnostics |
| `/workshop` | `WorkshopDashboard` | Real-time inspection job scheduling — SSE-driven lanes, drag-drop, CompletedTray |
| `/workshop/settings` | `WorkshopSettingsPage` | Workshop configuration (business hours, inspection types, machine counts) |
| `/workshop/simulation` | `WorkshopSimulationPage` | Simulation panel — generate synthetic orders to populate dashboard |

### Dashboards (`/`)

`DashboardsApp` wraps two tabs:

- **Overview** — legacy `Dashboard` component (KPI cards, summary stats)
- **Analysis** — `AnalyticsDashboard` (deep SF analytics, glassmorphism)
  - Analysis tab visibility controlled by `localStorage['ndt_integration_settings'].dashboards.analysis.enabled` (default: enabled)

`AiAssistant` floating panel (bottom-right) is always mounted — receives analytics data as context when the Analysis tab has loaded.

#### AnalyticsDashboard

- Fetches `GET /api/ut/admin/analytics?start=&end=` on mount and on date range change
- Date range presets: 7d, 30d, 90d, YTD, Last Year, All Time, Custom
- Forced dark base: `bg-slate-950` + 3 blur orbs + ambient gradient overlay
- Glass cards: `backdrop-blur-xl bg-white/[0.03]` with per-section accent gradients
- Sections and charts (staggered `animate-in` entrance):
  - **Hero KPIs (4):** SF Total Revenue, Active Accounts, SF Jobs Completed, Quote Win Rate _(first 3 now period-filtered; Active Accounts always current-state)_
  - **Secondary KPIs (4):** Avg Accepted Quote, Pipeline Value, Last Sync, MoM Growth
  - **Salesforce Performance:** YoY Revenue (ComposedChart bar+line), Service Revenue Trend (stacked AreaChart top 5)
  - **Account Intelligence:** Top 15 Accounts by Lifetime Revenue (horizontal BarChart), Market Revenue Trend (stacked AreaChart top 5)
  - **Operational Metrics:** Job Turnaround Time (ComposedChart bar+line dual-Y), Avg Invoice by Service (horizontal BarChart)
  - **Quote Analytics:** Quote Revenue Trend (UT+RT AreaChart), Status Distribution (donut PieChart)
  - **Win Rate Trend** (full-width ComposedChart)
  - **Revenue Projection** (full-width, conditional — linear extrapolation 3 months forward)
- Revenue attribution note: service/market trends use `CROSS JOIN LATERAL unnest(services)` — cross-service totals exceed job totals intentionally (per-service share analysis)

#### AiAssistant

- Floating Bot button (bottom-right, indigo)
- Slide-in panel from right (w-96, fixed, full height)
- Sends conversation history + full `AnalyticsResponse` context to `POST /api/ut/admin/ai-query`
- Renders inline Recharts charts when AI returns a `chartSpec`
- Sample prompt chips shown when conversation is empty

### Admin Panel (`/admin/*`)

`AdminApp` — tabbed panel currently with one tab:

- **Jobs** (`JobsTab`) — paginated table of `app.job_runs` rows. Columns: job name, started, duration, status, records upserted, summary, error. Filterable by job name. Pagination with configurable limit.

### Workshop Dashboard (`/workshop`, `/workshop/settings`, `/workshop/simulation`)

Real-time workshop scheduling board for managing daily NDT inspection jobs.

**Components:**
- `WorkshopDashboard` — main board: time ruler + inspection lanes + completed tray + job detail modal
- `InspectionLane` — one lane per active inspection type; shows scheduled jobs on a time ruler (drag-drop via `@dnd-kit`); unscheduled jobs in a top section; overlap columns for multi-machine types (e.g. RT with 2 machines shown side-by-side via `assignOverlapColumns()`)
- `JobCard` / `JobCardCollapsed` — full and chip representations of workshop jobs
- `JobDetailModal` — modal opened on card click; shows full job/order details, inspection sequence, schedule, notes, overdue warning; ESC + backdrop-click to close
- `CompletedTray` — collapsible bottom tray listing completed jobs as chips
- `TimeRuler` — left-side time axis derived from business hours
- `DragDropProvider` — wraps `@dnd-kit` DnDContext + DragOverlay; floor manager role only
- `LaneHeader` — per-lane header with status indicator and collapse toggle
- `RoleSwitcher` — role selector (floor manager / per-type inspector); persists in `localStorage`
- `SimulationPanel` — uses `SimulationContext` (App-level); controls sim params, shows auto-scrolling event log terminal

**State management:**
- `useWorkshopOrders` — SSE hook (`GET /api/workshop/sse`); reconnects automatically on disconnect
- `useWorkshopSettings` — fetches `GET /api/workshop/settings` on mount
- `useScheduleJob` — wraps `POST /api/workshop/jobs/:id/schedule`
- `SimulationContext` — React Context mounted above `<Routes>` in `App.tsx` so simulation timers survive navigation; holds running state, stats, logs, config

**Theme:** `workshop-theme.css` — CSS custom properties for dark/light; `.dark` Tailwind class toggle

### Pipeline Audit (`/audit`, `/audit/:intakeId`)

- `PipelineHistory` — list of all pipeline intake runs, sorted by date
- `ExecutionLogViewer` — per-step log for a single intake: shows input, output, duration, status per pipeline step. Rich audit trail for WF-5 inspection pipeline.

---

## Backend (Express + TypeScript)

Single `api` service on port 3100. Routes mounted in `src/index.ts`. Middleware: helmet, cors, morgan, JSON body parser (1MB limit).

### Route Structure

| Prefix | File | Description |
|--------|------|-------------|
| `/health` | `index.ts` | Health check — returns `{status, service, time}` |
| `/quote` | `routes/quote.ts` | UT quote CRUD + calculation |
| `/rt/quote` | `routes/rt-quote.ts` | RT quote CRUD + calculation |
| `/integrations` | `routes/integrations.ts` | SF, email, n8n webhook handlers + WF-5 pipeline |
| `/inspection-types` | `routes/inspection-types.ts` | Inspection type + step config |
| `/settings` | `routes/settings.ts` | LLM provider settings |
| `/bom` | `routes/bom.ts` | Salesforce BOM + account lookup + `/parts/:partNumber/last-used` |
| `/sf-analysis` | `routes/sf-analysis.ts` | SF Analysis: customer search, activity, parts catalog, AI chatbot |
| `/admin` | `routes/admin.ts` | Job run tracking, analytics, AI query |
| `/workshop` | `routes/workshop.ts` | Workshop orders, jobs, SSE, settings, simulation clear |

### Admin Endpoints (`/admin`)

#### `GET /admin/jobs`

Paginated job run history from `app.job_runs`.

Query params: `limit` (max 200, default 50), `offset` (default 0), `job` (filter by job_name).

Response: `{ total: number, runs: JobRun[] }`

#### `GET /admin/jobs/:id`

Single job run detail. 404 if not found.

#### `GET /admin/analytics`

Deep SF + quote analytics. Query params: `start` (YYYY-MM-DD), `end` (YYYY-MM-DD). Defaults to last 30 days.

Two `Promise.all` batches — KPI queries first, then 14 chart queries in parallel.

KPI period-filtering (as of 2026-03-21):
- Period-filtered (uses `start`/`end`): SF Total Revenue, SF Jobs Completed, Quote Win Rate, Avg Accepted Quote
- Always current-state: Active Accounts (status snapshot), Pipeline Value (pending quotes), Last Sync, MoM Growth

See `API.md` for full response shape.

#### `POST /admin/ai-query`

AI data analyst. Body: `{ messages: [{role, content}], context: AnalyticsResponse }`.

Reads Anthropic API key + model from `ut.app_settings`. Returns `{ reply: string, chartSpec: ChartSpec | null }`. 400 if no API key configured.

### BOM Endpoints (`/bom`)

Read-only queries against `sf.*` tables populated by `sf_sync.py`. No auth required (internal portal).

See `API.md` for full endpoint specs.

---

## Traefik Routing

`traefik-dynamic.yml` — all API routes at priority 30+ forward to `api:3100` after stripping prefix. PostgREST catches remainder at priority 20.

| Router | Rule | Priority | Service | Notes |
|--------|------|----------|---------|-------|
| `ut-api` | `/api/ut/quote` | 30 | api:3100 | UT quote API |
| `ut-integrations` | `/api/ut/integrations` | 30 | api:3100 | Webhooks + pipeline |
| `ut-inspection-types` | `/api/ut/inspection-types` | 30 | api:3100 | Step config |
| `ut-settings` | `/api/ut/settings` | 30 | api:3100 | LLM settings |
| `ut-admin` | `/api/ut/admin` | 30 | api:3100 | Admin + analytics |
| `ut-bom` | `/api/ut/bom` | 30 | api:3100 | BOM endpoints |
| `ut-sf-analysis` | `/api/ut/sf-analysis` | 30 | api:3100 | SF Analysis + AI chatbot |
| `rt-api` | `/api/rt/quote` | 30 | api:3100 | RT quote API |
| `workshop-api` | `/api/workshop` | 30 | api:3100 | Workshop SSE + orders + jobs |
| `comply-api` | `/api/pipeline/comply` | 35 | comply:8010 | Pipeline compliance step |
| `sanitize-api` | `/api/pipeline/sanitize` | 35 | sanitize:8011 | Pipeline sanitize step |
| `gateway-api` | `/api/pipeline/gateway` | 35 | gateway:8012 | OpenClaw AI gateway |
| `msg-api` | `/api/msg` | 30 | msg-api:8000 | MSG file parser |
| `postgrest-rt` | `/api/rt` | 20 | postgrest-rt:3000 | PostgREST fallback |
| `postgrest-ut` | `/api/ut` | 20 | postgrest-ut:3000 | PostgREST fallback |
| `n8n` | `/n8n` | 10 | n8n:5678 | n8n UI |
| `nginx` | `/` | 1 | nginx:80 | SPA fallback |

---

## Database

PostgreSQL 16 with four schemas:

| Schema | Purpose |
|--------|---------|
| `ut` | UT quotes (`incoming_quotes`), inspection types + steps, app settings (`app_settings`) |
| `rt` | RT quotes (`incoming_quotes`) |
| `sf` | Salesforce synced data — full master + transaction + analytical layer |
| `app` | Internal — `job_runs` background job tracking, `quote_audit_log` PDF/edit history |
| `workshop` | Workshop orders, inspection jobs, settings (Migration 027) |

### `workshop` Schema (Migration 027)

| Table | Key Columns | Description |
|-------|------------|-------------|
| `workshop.orders` | id (uuid PK), order_number, customer_id FK→ut.customers, part_number, quantity, priority (high/medium/low), due_date, status, is_simulated, notes | Inspection work orders |
| `workshop.jobs` | id (uuid PK), order_id FK, inspection_type (RT/UT/MT/etc.), sequence_index, status (unscheduled/scheduled/in_progress/completed), scheduled_start, scheduled_end, actual_start, actual_end, duration_minutes, inspector_name, scheduling_mode (auto/manual), is_simulated | Individual inspection jobs within an order |
| `workshop.settings` | key (text PK), value (JSONB) | Configuration store: business_hours, inspection_types, inspection_durations_default, machine_counts |

**Scheduler:** `scheduleNextAvailable(jobId)` in `workshop.ts` uses `pg_advisory_xact_lock` (per-inspection-type hash key) inside a `BEGIN/COMMIT` transaction to serialize scheduling and prevent double-booking. Supports multi-machine types — sweeps forward until `overlapping.length < machineCount`.

**SSE broadcast:** All mutating endpoints call `broadcastUpdate()` which re-fetches `fetchTodayOrders()` and writes `event: update` to all connected `EventSource` clients. Heartbeat every 30s prevents proxy timeouts.

### `sf` Schema (Migrations 008, 022–026)

Populated by `sf_sync.py` via Salesforce REST API. All tables use `TEXT PRIMARY KEY` with the Salesforce `sf_id`. Sync runs daily at 3am (incremental) plus on-demand via manual poll queue.

#### Master Data

| Table | Key Fields | Description |
|-------|-----------|-------------|
| `sf.accounts` | name, type, market, status, region, credit_hold, faa_account, ytd_total, techniques_criterias, wo_notes, oem_approvals | Customer master — 30+ fields including custom NDT fields added in migration 026 |
| `sf.contacts` | account_sf_id FK, first_name, last_name, email, title, department | Account contacts — who submits jobs, quote recipients |
| `sf.products` | product_code, std_price, union_price, faa_price | Service catalog |
| `sf.pricebook_entries` | product_sf_id FK, pricebook_name, unit_price | Price tiers (standard, union, FAA) |
| `sf.contracts` | account_sf_id FK, status, start_date, end_date | Customer contracts |

#### Transaction Data

| Table | Key Fields | Description |
|-------|-----------|-------------|
| `sf.jobs` | account_sf_id FK, part_number, services[], invoice_amount, lab_status, billing_status, faa_job, expedite, date_due | Work orders — 44+ fields including operational flags from migration 026 |
| `sf.quotes` | job_sf_id FK, grand_total, status, services_included | Formal SF quotes |
| `sf.quote_lines` | quote_sf_id FK, product_code, unit_price | Quote line items |
| `sf.orders` | account_sf_id FK, order_number, status | Customer orders (empty if SF uses Opportunities as order proxy) |
| `sf.order_items` | order_sf_id FK, product_sf_id FK, quantity, unit_price | Order line items |
| `sf.bom_items` | account_sf_id FK, part_number, service, specification, technique | Authoritative master BOM (populated via `SF_BOM_OBJECT` env var if a custom BOM object exists in SF) |

#### Analytical Views

| View | Type | Description |
|------|------|-------------|
| `sf.bom_parts` | Materialized view | Unique part×account combos aggregated from jobs — services[], specifications[], job_count, avg_invoice, last_specification, last_technique, last_services |
| `sf.part_last_used` | Regular view | Most recent job per part×account — answers "what spec/technique/service did we last use for this part?" Always current, no REFRESH needed |

> **Data gap note:** `specification` and `ndt_procedure` on `sf.jobs` are 0% populated in this org — `Specification__c` and `NDT_Procedure__c` on SF Opportunity have never been used. `services[]` (RT/UT/MT/etc.) is 100% populated.

Key indexes: `sf_jobs_account_idx`, `sf_jobs_part_idx`, `sf_jobs_invoice_idx`, `sf_jobs_lab_status_idx`, `sf_jobs_faa_idx`, `sf_jobs_expedite_idx`, `bom_parts_account_idx`, `bom_parts_part_idx`, `sf_accounts_region_idx`, `sf_accounts_faa_idx`, `sf_accounts_credit_idx`.

### `app` Schema (Migrations 009, 017)

| Table | Description |
|-------|-------------|
| `app.job_runs` | Background job log — job_name, started_at, finished_at, duration_ms, status (running/success/error), records_upserted (JSONB), summary, error |
| `app.quote_audit_log` | Quote change history — quote_id (UUID), quote_type (ut/rt), change_type (edit/pdf_generated), diff (JSONB), pdf_version, changed_by |

All background jobs MUST write to `app.job_runs` at start and end. `sf_sync.py` uses the latest successful run timestamp for auto-since detection.

### Quote PDF Schema (Migration 017)

Both `ut.incoming_quotes` and `rt.incoming_quotes` gained two columns:
- `pdf_path TEXT` — filesystem path to the most recent PDF in the `pdf-store` volume
- `pdf_version INT NOT NULL DEFAULT 0` — increments on each PDF regeneration

`rt.incoming_quotes` also gained `notes TEXT` (Migration 018) to match the UT schema.

PDF files are stored at `/pdf-store/{ut|rt}/{quote_id}/v{version}.pdf` inside the container.

### PDF Generation

Handled by `lib/pdfGenerator.ts`:
- `generatePdf(html)` — POSTs HTML to Gotenberg `/forms/chromium/convert/html` → returns PDF `Buffer`
- `storePdf(type, id, version, buf)` — writes to `pdf-store` volume, returns file path
- `buildHtmlDocument(title, body)` — wraps body in standard HTML/CSS template
- Gotenberg URL: `GOTENBERG_URL` env var (default `http://gotenberg:3000`)

**Gotenberg cold-start:** First PDF request after container restart takes ~20s while Chromium initialises. Subsequent requests are fast.

---

## Services (Docker Compose)

| Service | Port | Description |
|---------|------|-------------|
| `api` | 3100 | Express backend |
| `nginx` | 80 | Frontend static files |
| `postgres` | 5432 | Database |
| `postgrest-ut` | 3000 | Auto-REST for `ut` schema |
| `postgrest-rt` | 3000 | Auto-REST for `rt` schema |
| `n8n` | 5678 | Automation workflows |
| `traefik` | 8888 / 8080 | Reverse proxy + dashboard |
| `msg-api` | 8000 | MSG (.eml/.msg) file parser |
| `comply` | 8010 | Pipeline: compliance check step |
| `sanitize` | 8011 | Pipeline: data sanitize step |
| `gateway` | 8012 | Pipeline: OpenClaw AI gateway |
| `gotenberg` | 3000 (internal) | PDF generation via Chromium (Gotenberg v8) |

---

## Key Data Flows

### 1. SF Sync (sf_sync.py)

`sf_sync.py` authenticates to Salesforce via `client_credentials` OAuth, pulls all synced objects, upserts into `sf.*` tables, refreshes `sf.bom_parts` materialized view, and writes a `job_runs` record. Read-only from SF — no writes back to Salesforce in this sync.

**Synced objects:**
| Function | SF Object | Target Table |
|----------|-----------|-------------|
| `sync_accounts()` | Account | `sf.accounts` |
| `sync_jobs()` | Opportunity | `sf.jobs` |
| `sync_quotes()` | Quote | `sf.quotes` |
| `sync_quote_lines()` | QuoteLineItem | `sf.quote_lines` |
| `sync_products()` | Product2 | `sf.products` |
| `sync_pricebook_entries()` | PricebookEntry | `sf.pricebook_entries` |
| `sync_contacts()` | Contact | `sf.contacts` |
| `sync_contracts()` | Contract | `sf.contracts` |
| `sync_orders()` | Order | `sf.orders` |
| `sync_order_items()` | OrderItem | `sf.order_items` |
| `sync_bom_items()` | Custom (env: `SF_BOM_OBJECT`) | `sf.bom_items` (skipped if env not set) |

**Schedule (cron on host):**
- `0 3 * * *` — daily 3am incremental sync (reads last successful run timestamp for auto-since)
- `* * * * *` — every minute: checks `app.job_runs` queue for manually triggered syncs

**Trigger sources:**
- Cron schedule (above)
- `POST /api/ut/bom/sync` → inserts `sf_sync_manual` row into `app.job_runs` queue
- Manual: `python3 /opt/ndt-portal/sf_sync.py --mode full`

**Auto-since:** reads last successful `sf_sync` run from `app.job_runs` to calculate incremental SOQL filter. Full sync (~150s for 53K jobs); incremental ~5–8s.

### 2. WF-5 Inspection Pipeline

1. MSG file uploaded → `msg-api` parses → structured data extracted
2. `POST /api/ut/integrations/pipeline/run` starts pipeline intake
3. Steps execute sequentially: sanitize → comply → gateway (OpenClaw AI) → optional attachment steps
4. Each step writes structured I/O log to `app.pipeline_logs` (or similar)
5. `ExecutionLogViewer` at `/audit/:intakeId` shows per-step results

### 3. Quote Creation

1. User fills UT/RT form → `POST /api/ut/quote` or `POST /api/ut/rt/quote`
2. Server calculates pricing from inspection type step config
3. Quote stored in `ut.incoming_quotes` or `rt.incoming_quotes`
4. Optional SF writeback via `POST /api/ut/integrations/sf/quote-writeback`
