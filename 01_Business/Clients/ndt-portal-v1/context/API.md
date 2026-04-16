# NDT Portal — API Reference

> Last updated: 2026-04-04
> Base URL (public): `https://ndtv1.onnex.cox.playsap.us`
> Internal base: `http://api:3100` (within Docker network)
> Traefik strips `/api/ut` prefix before forwarding to `api:3100`
> Auth: none required — internal portal, network-gated

---

## Health

### `GET /api/ut/health`

Returns service status.

**Response:**
```json
{ "status": "ok", "service": "ndt-ut-api", "time": "2026-03-20T15:00:00.000Z" }
```

---

## Admin

### `GET /api/ut/admin/jobs`

Paginated background job run history.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `limit` | integer | 50 | Max rows (hard cap 200) |
| `offset` | integer | 0 | Pagination offset |
| `job` | string | — | Filter by exact `job_name` (e.g. `sf_sync`) |

**Response:**
```typescript
{
  total: number           // total matching rows
  runs: Array<{
    id: number
    job_name: string
    started_at: string    // ISO timestamp
    finished_at: string | null
    duration_ms: number | null
    status: 'running' | 'success' | 'error'
    records_upserted: Record<string, number> | null  // e.g. { accounts: 2266, jobs: 53 }
    summary: string | null
    error: string | null
  }>
}
```

---

### `GET /api/ut/admin/jobs/:id`

Single job run by ID.

**Response:** Same shape as a single `runs[]` element above.
**404** if not found.

---

### `GET /api/ut/admin/analytics`

Full SF + quote analytics. Runs two parallel batches of DB queries (8 KPI + 14 chart).

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `start` | string (YYYY-MM-DD) | 30 days ago | Range start for date-filtered queries |
| `end` | string (YYYY-MM-DD) | today | Range end |

> KPI period-filtering: `sfTotalRevenue`, `totalSfJobs`, `quoteWinRate`, `avgAcceptedQuote` use the date range. `activeAccounts`, `pipelineValue`, `lastSync`, `momGrowth` are always current-state/all-time.
> Queries A (yoyRevenue) and B (topAccounts) are all-time and ignore the date range.

**Response:**
```typescript
{
  period: { start: string; end: string }

  kpis: {
    sfTotalRevenue:   number   // period-filtered: SUM(invoice_amount) WHERE date_completed IN range
    activeAccounts:   number   // current-state: sf.accounts WHERE status = 'Active' (no date filter)
    totalSfJobs:      number   // period-filtered: COUNT of jobs WHERE date_completed IN range
    quoteWinRate:     number   // period-filtered: % sf.quotes WHERE status='approved' IN range
    avgAcceptedQuote: number   // period-filtered: AVG grand_total of approved SF quotes IN range
    pipelineValue:    number   // sum grand_total WHERE status IN (calculated, pending, sent)
    lastSync: {
      at: string              // started_at of most recent job_run
      status: string
      summary: string
    } | null
    momGrowth: number | null  // % change UT quote revenue prev month → current month
  }

  // ── Quote charts (date-filtered) ──────────────────────────────────────────
  quoteTrend: Array<{
    month: string             // YYYY-MM
    utCount: number
    rtCount: number
    utRevenue: number
    rtRevenue: number
  }>

  statusDist: Array<{
    status: string            // calculated | pending | sent | accepted | rejected
    count: number
    value: number             // sum grand_total
  }>

  sourceDist: Array<{
    source: string            // api | salesforce | email | portal
    count: number
  }>

  topCustomers: Array<{
    name: string
    quoteCount: number
    totalValue: number
  }>

  winRateTrend: Array<{
    month: string
    accepted: number
    total: number
    winRate: number           // 0–100
  }>

  // ── SF charts (date-filtered unless noted) ────────────────────────────────
  sfRevenueTrend: Array<{
    month: string
    revenue: number
    jobCount: number
  }>

  sfServiceMix: Array<{       // top 10 by count
    service: string
    count: number
    revenue: number
  }>

  sfMarkets: Array<{          // all markets, no date filter
    market: string
    count: number             // account count
    ytd: number               // sum ytd_total from sf.accounts
  }>

  // ── New deep analytics (added 2026-03-20) ────────────────────────────────
  yoyRevenue: Array<{         // ALL-TIME — last 2 calendar years
    year: number
    month: number             // 1–12
    revenue: number
    jobCount: number
  }>

  topAccounts: Array<{        // ALL-TIME — top 15 by lifetime revenue
    name: string
    jobCount: number
    lifetimeRevenue: number
    avgInvoice: number
  }>

  turnaroundTrend: Array<{    // date-filtered
    month: string
    avgDays: number           // avg(date_completed - date_received)
    jobCount: number
  }>

  serviceRevenueTrend: Array<{  // date-filtered — top 5 services, monthly
    month: string             // NOTE: revenue counted per service on multi-service jobs
    service: string           // cross-service sum > overall sum — intentional
    revenue: number
  }>

  avgInvoiceByService: Array<{  // date-filtered — top 10 by total_revenue
    service: string
    jobCount: number
    avgInvoice: number
    totalRevenue: number
  }>

  marketRevenueTrend: Array<{   // date-filtered — top 5 markets, monthly
    month: string
    market: string
    revenue: number
    jobCount: number
  }>
}
```

---

### `POST /api/ut/admin/ai-query`

AI data analyst powered by Anthropic Claude. Reads API key + model from `ut.app_settings`.

**Request body:**
```typescript
{
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  context: AnalyticsResponse   // full analytics payload — passed as system context
}
```

**Response:**
```typescript
{
  reply: string                // markdown-formatted analysis text
  chartSpec: {
    type: 'bar' | 'line' | 'pie' | 'area'
    title: string
    data: Array<Record<string, string | number>>
    xKey: string
    yKeys: Array<{ key: string; label: string; color?: string }>
  } | null
}
```

**Errors:**
- `400` — no Anthropic API key in settings
- `500` — LLM call failed

---

## BOM (Bill of Materials)

All endpoints are read-only. Data sourced from `sf.*` tables via `sf_sync.py`.

### `GET /api/ut/bom/parts`

Search BOM parts across all accounts.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Part number search (ILIKE) |
| `account` | string | Account name filter (ILIKE) |
| `service` | string | Exact service match (`= ANY(services)`) — uppercase-normalized |
| `limit` | integer | Max rows (default 50, cap 200) |
| `offset` | integer | Pagination offset |

**Response:**
```typescript
{
  total: number
  limit: number
  offset: number
  items: Array<{
    account_sf_id: string
    account_name: string
    part_number: string
    revisions: string[]
    services: string[]
    specifications: string[]
    procedures: string[]
    acceptance_criteria: string[]
    job_count: number
    last_processed: string | null  // date of most recent job
    avg_invoice: number
    max_invoice: number
    // Last-used fields from rebuilt sf.bom_parts matview (migrations 025-026)
    last_specification: string | null
    last_technique: string | null
    last_acceptance_criteria: string | null
    last_services: string[] | null
  }>
}
```

---

### `GET /api/ut/bom/parts/:partNumber/history`

Full job history for a specific part number.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `account` | string | Filter by account name (ILIKE) |
| `limit` | integer | Max rows (default 100, cap 500) |

**Response:**
```typescript
{
  partNumber: string
  total: number
  jobs: Array<{
    sf_id: string
    work_order_number: string
    invoice_number: string
    invoice_amount: number
    part_number: string
    part_rev: string
    lot_serial: string
    services: string[]
    specification: string
    ndt_procedure: string
    acceptance_criteria: string
    scope: string
    po_number: string
    price_per_basis: string
    date_received: string    // YYYY-MM-DD
    date_completed: string   // YYYY-MM-DD
    record_type: string
    account_sf_id: string
    account_name: string
  }>
}
```

---

### `GET /api/ut/bom/accounts`

Search Salesforce accounts with job count.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Account name search (ILIKE) |
| `limit` | integer | Max rows (default 50, cap 200) |

**Response:**
```typescript
{
  total: number
  accounts: Array<{
    sf_id: string
    name: string
    type: string
    market: string
    status: string
    oem_approvals: string[]
    rate_sheet_ver: string
    payment_terms: string
    ytd_total: number
    job_count: number
  }>
}
```

---

### `GET /api/ut/bom/accounts/:sfId/parts`

All BOM entries for a specific account.

**Path param:** `sfId` — Salesforce account ID

**Query params:** `limit` (default 100, cap 500), `offset` (default 0)

**Response:**
```typescript
{
  account: {
    sf_id: string
    name: string
    type: string
    market: string
    status: string
    oem_approvals: string[]
  }
  total: number
  limit: number
  offset: number
  parts: Array<{
    part_number: string
    revisions: string[]
    services: string[]
    specifications: string[]
    procedures: string[]
    acceptance_criteria: string[]
    job_count: number
    last_processed: string | null
    avg_invoice: number
    max_invoice: number
  }>
}
```

**404** if account `sfId` not found.

---

### `GET /api/ut/bom/parts/:partNumber/last-used`

Returns the most recent job details per account for a given part number. Answers: *"what spec/technique/service did we last use for this part at each customer?"*

Sourced from `sf.part_last_used` VIEW (always current — no refresh needed).

**Path param:** `partNumber` — URL-encoded part number

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `account` | string | Filter by account name (ILIKE) |

**Response:**
```typescript
{
  partNumber: string
  total: number
  results: Array<{
    account_sf_id: string
    account_name: string
    part_number: string
    last_rev: string | null
    last_services: string[] | null
    last_specification: string | null    // null if Specification__c not used in org
    last_technique: string | null        // null if NDT_Procedure__c not used in org
    last_acceptance_criteria: string | null
    last_scope: string | null
    last_work_order: string | null
    last_invoice_number: string | null
    last_invoice_amount: number | null
    last_stage: string | null
    last_job_was_won: boolean | null
    last_job_date: string | null         // YYYY-MM-DD
    last_completed_date: string | null
    last_received_date: string | null
    last_record_type: string | null
    last_job_sf_id: string | null
  }>
}
```

**404** if no job history found for the part number.

> **Data note:** `last_specification` and `last_technique` are null for all historical records in this org — `Specification__c` and `NDT_Procedure__c` on Opportunity have never been populated. `last_services` (RT/UT/MT/etc.) is reliably populated.

---

### `POST /api/ut/bom/sync`

Trigger Salesforce data sync in background. Fire-and-forget — returns immediately.

**Request body:**
```typescript
{ since?: string }   // ISO date — if provided, runs incremental mode
```

**Response:**
```typescript
{
  ok: true
  mode: 'incremental' | 'full'
  since: string | null
  message: 'Sync started in background'
}
```

Sync writes progress to `app.job_runs`. Poll `GET /admin/jobs?job=sf_sync` to monitor.

---

## SF Analysis

All endpoints are read-only. Mounted at `/api/ut/sf-analysis`. Powered by `sf-analysis.ts`.

### `GET /api/ut/sf-analysis/customers`

Search customer accounts with job count aggregation.

**Query params:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | — | Account name search (ILIKE) |
| `limit` | integer | 20 | Max rows (cap 100) |

**Response:**
```typescript
{
  accounts: Array<{
    sf_id: string
    name: string
    market: string | null
    status: string | null
    type: string | null
    ytd_total: number | null
    payment_terms: string | null
    region: string | null            // delivery region (migration 026)
    credit_hold: boolean | null      // true = on credit hold
    faa_account: boolean | null      // true = FAA-regulated account
    top_10_account: boolean | null
    job_count: number
  }>
  total: number     // total accounts in db (unfiltered)
  noSyncYet: boolean
}
```

---

### `GET /api/ut/sf-analysis/customers/:sfId/activity`

Full account details with merged jobs + quotes timeline, sorted by date DESC.

**Response:**
```typescript
{
  account: {
    sf_id: string
    name: string
    market: string | null
    status: string | null
    oem_approvals: string[] | null
    ytd_total: number | null
    techniques_criterias: string | null  // per-account BOM/standard techniques text
    wo_notes: string | null
    region: string | null
    credit_hold: boolean | null
    faa_account: boolean | null
    top_10_account: boolean | null
    billing_state: string | null
    billing_city: string | null
    phone: string | null
    owner_name: string | null
    payment_terms: string | null
    ytd_lab_revenue: number | null
    ytd_field_revenue: number | null
  }
  activity: Array<JobActivity | QuoteActivity>
  jobCount: number
  quoteCount: number
}

interface JobActivity {
  sf_id: string; row_type: 'job'
  work_order_number: string | null
  part_number: string | null
  services: string[] | null
  specification: string | null
  ndt_procedure: string | null
  acceptance_criteria: string | null
  invoice_amount: number | null
  date_received: string | null
  date_completed: string | null
  lab_status: string | null        // operational lab pipeline status
  billing_status: string | null    // billing pipeline status
  faa_job: boolean | null
  expedite: boolean | null         // true = rush job
  expedite_type: string | null
  date_due: string | null          // lab due date
  lab_notes: string | null
}

interface QuoteActivity {
  sf_id: string; row_type: 'quote'
  quote_number: string | null
  part_numbers: string | null
  services_included: string[] | null
  grand_total: number | null
  status: string | null
  created_date: string | null
  expiration_date: string | null
}
```

---

### `GET /api/ut/sf-analysis/parts`

BOM parts catalog from `sf.bom_parts` materialized view.

**Query params:**
| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Part number search (ILIKE) |
| `service` | string | Service filter — RT/UT/MT/PT/ET/VT |
| `accountId` | string | Exact account sf_id filter |
| `limit` | integer | Max rows (default 50, cap 200) |
| `offset` | integer | Pagination offset |

**Response:** Same shape as `GET /bom/parts` plus `last_specification`, `last_technique`, `last_acceptance_criteria`, `last_services` from the rebuilt matview.

---

### `POST /api/ut/sf-analysis/chat`

AI-powered text-to-SQL chatbot. Converts natural language questions into SQL, executes against the full `sf.*` schema, returns results + natural language explanation.

Uses `claude-haiku-4-5-20251001` via internal gateway service. Includes one automatic SQL retry on error.

**Request body:**
```typescript
{ messages: Array<{ role: 'user' | 'assistant'; content: string }> }
```

**Response:**
```typescript
{
  sql: string               // generated SQL (may be error-corrected version)
  columns: string[]
  results: Record<string, unknown>[]
  explanation: string | null  // 2–4 sentence summary of what the data shows
  error: string | null        // if SQL failed after retry
}
```

**Schema coverage:** All sf.* tables including accounts (30+ custom fields), jobs (16+ custom fields), contacts, contracts, pricebook_entries, orders, order_items, bom_items, part_last_used view, bom_parts view. See `SF_SCHEMA_DDL` in `api/src/routes/sf-analysis.ts` for the full inline schema reference.

**Safety:** SELECT-only enforced. Blocked keywords: INSERT, UPDATE, DELETE, DROP, CREATE, TRUNCATE, ALTER, GRANT, EXECUTE, `--`. LIMIT 200 auto-appended if missing.

---

## Quote PDF (UT)

> Routes at `/api/ut/quote/:id/pdf` — Traefik strips `/api/ut`, reaches Express at `/quote/:id/pdf`

### `POST /api/ut/quote/:id/pdf`

Generate (or regenerate) a PDF for a UT quote. Renders an HTML summary via Gotenberg Chromium, stores on disk, increments `pdf_version` in DB, writes to `app.quote_audit_log`.

**Path param:** `id` — UUID of the UT quote

**Response:**
```typescript
{ pdf_version: number; pdf_path: string }  // pdf_path is server-side file path
```

**Errors:** `400` bad UUID · `404` quote not found · `500` Gotenberg/generation error

> First call after Gotenberg restart may take ~20 seconds (Chromium cold start).

---

### `GET /api/ut/quote/:id/pdf`

Retrieve the stored PDF binary for a UT quote.

**Path param:** `id` — UUID of the UT quote

**Response:** `application/pdf` binary stream. `Content-Disposition: attachment; filename="<quote_number>.pdf"`

**Errors:** `400` bad UUID · `404` quote not found or no PDF generated yet · `500` file read error

---

## Quote PDF (RT)

> Routes at `/api/rt/quote/:id/pdf` — Traefik strips `/api`, reaches Express at `/rt/quote/:id/pdf`

### `POST /api/rt/quote/:id/pdf`

Generate (or regenerate) a PDF for an RT quote. Same flow as UT — HTML → Gotenberg → `pdf-store` volume.

**Path param:** `id` — UUID of the RT quote

**Response:**
```typescript
{ pdf_version: number; pdf_path: string }
```

**Errors:** `400` bad UUID · `404` quote not found · `500` generation error

---

### `GET /api/rt/quote/:id/pdf`

Retrieve stored PDF for an RT quote.

**Path param:** `id` — UUID of the RT quote

**Response:** `application/pdf` binary stream.

**Errors:** `400` bad UUID · `404` quote not found or no PDF · `500` file read error

---

## Workshop

> Routes at `/api/workshop/*` — Traefik strips `/api`, Express receives `/workshop/*`
> Mounted in `api/src/routes/workshop.ts`

### `GET /api/workshop/sse`

SSE (Server-Sent Events) stream — real-time push of today's workshop orders and jobs.

**Events:**
| Event name | When | Data |
|------------|------|------|
| `init` | On connect | Full `WorkshopOrder[]` array (today's snapshot) |
| `update` | After any mutation (order create, scan, schedule, clear) | Full `WorkshopOrder[]` array |
| `: heartbeat` | Every 30s | (comment line — no data, prevents proxy timeout) |

**`WorkshopOrder` shape:**
```typescript
{
  id: string               // UUID
  orderNumber: string      // e.g. "SIM-1ABC2D"
  customerId: string | null
  customer: { name: string } | null
  partNumber: string
  quantity: number
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null   // ISO timestamp
  status: 'incoming' | 'in_progress' | 'completed'
  isSimulated: boolean
  notes: string | null
  workshopJobs: WorkshopJob[]
}

interface WorkshopJob {
  id: string               // UUID
  orderId: string
  inspectionType: string   // 'RT' | 'UT' | 'ET' | 'MT' | 'PT' | 'VT'
  sequenceIndex: number    // position within order's inspection sequence
  status: 'unscheduled' | 'scheduled' | 'in_progress' | 'completed'
  scheduledStart: string | null
  scheduledEnd: string | null
  actualStart: string | null
  actualEnd: string | null
  durationMinutes: number
  inspectorName: string | null
  schedulingMode: 'auto' | 'manual'
  isSimulated: boolean
  notes: string | null
}
```

---

### `GET /api/workshop/today`

One-time snapshot of today's orders (same data as `init` SSE event). Use for initial page load when SSE connection is not yet established.

**Response:** `WorkshopOrder[]`

---

### `GET /api/workshop/settings`

Returns current workshop configuration.

**Response:**
```typescript
{
  businessHours: { start: string; end: string; timezone: string }  // e.g. "08:00", "17:00", "America/Los_Angeles"
  inspectionTypes: string[]                                         // active types, e.g. ['RT','UT','MT']
  inspectionDurationsDefault: Record<string, number>               // minutes per type, e.g. {RT:60, UT:60}
  machineCounts: Record<string, number>                            // parallel machines per type, e.g. {RT:2, UT:1}
}
```

---

### `PATCH /api/workshop/settings/:key`

Update a single settings key.

**Path param:** `key` — one of: `business_hours`, `inspection_types`, `inspection_durations_default`, `machine_counts`

**Request body:**
```typescript
{ value: unknown }  // JSONB — must match the expected shape for the key
```

**Response:** `{ ok: true }`

Triggers SSE broadcast after update.

---

### `POST /api/workshop/orders`

Create a new workshop order with associated inspection jobs. Jobs are auto-scheduled immediately using `scheduleNextAvailable()`.

**Request body:**
```typescript
{
  orderNumber: string        // unique identifier, e.g. "WO-2026-001" or "SIM-XXXXX"
  customerId: string | null  // UUID FK → ut.customers
  partNumber: string
  quantity: number
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null     // ISO timestamp
  inspectionTypes: string[]  // ordered list, e.g. ['RT', 'UT']
  notes: string | null
  isSimulated: boolean        // true = created by simulation engine
}
```

**Response:** `201 WorkshopOrder` — full order with jobs attached and scheduled times populated

Triggers SSE broadcast.

**Scheduling behavior:** For each inspection type, calls `scheduleNextAvailable()` which:
- Acquires a `pg_advisory_xact_lock` keyed by inspection type (prevents double-booking under concurrency)
- Reads `machine_counts` setting to allow parallel slots (e.g. RT=2 allows 2 simultaneous jobs)
- Sweeps forward from `max(now, businessStart)` on a 15-minute grid until a slot is free
- Falls back to next business day if no room today

---

### `POST /api/workshop/jobs/:id/schedule`

Manually place a job at a specific time. Sets `scheduling_mode = 'manual'`.

**Path param:** `id` — job UUID

**Request body:**
```typescript
{
  scheduledStart: string      // ISO timestamp
  scheduledEnd: string        // ISO timestamp
  inspectorName: string | null
}
```

**Response:** Updated `WorkshopJob` row. Triggers SSE broadcast.

---

### `POST /api/workshop/jobs/:id/duration`

Update a job's estimated duration and re-schedule it (and all auto-mode sibling jobs).

**Path param:** `id` — job UUID

**Request body:**
```typescript
{ durationMinutes: number }
```

**Response:** `{ ok: true }`. Triggers SSE broadcast.

---

### `POST /api/workshop/webhook/scan`

QR scan event — marks a job as started or completed.

**Request body:**
```typescript
{
  jobId: string
  scanType: 'start' | 'end'
  scannerId: string       // e.g. "SIM-SCANNER" or physical scanner ID
  scannedAt: string       // ISO timestamp
}
```

**Behavior:**
- `start` scan → sets `actual_start`, status → `in_progress`
- `end` scan → sets `actual_end`, status → `completed`; then auto-schedules any remaining unscheduled sibling jobs on the same order
- Parent order status auto-derived from job statuses: `completed` if all jobs done, `in_progress` if any running, else `incoming`

**Response:** Updated `WorkshopJob` row. Triggers SSE broadcast.

---

### `DELETE /api/workshop/simulation/clear`

Delete all simulated orders and jobs (where `is_simulated = true`). Used by the Simulation panel "Clear" button.

**Response:** `{ ok: true }`. Triggers SSE broadcast.

**Errors:** `500` on database error

---

## TypeScript Types (exported from AnalyticsDashboard.tsx)

Imported by `AiAssistant.tsx`:

```typescript
export interface AnalyticsResponse { /* see GET /admin/analytics response above */ }

export interface ChartSpec {
  type: 'bar' | 'line' | 'pie' | 'area'
  title: string
  data: Array<Record<string, string | number>>
  xKey: string
  yKeys: Array<{ key: string; label: string; color?: string }>
}
```
