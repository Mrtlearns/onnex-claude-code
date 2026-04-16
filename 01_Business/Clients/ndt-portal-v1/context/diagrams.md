# NDT Portal — Diagrams

> Last updated: 2026-04-04

---

## System Architecture

> How the browser, proxy, services, and database connect.

```mermaid
graph TD
    Browser["Browser\n(React SPA)"] -->|"HTTPS :8888"| Traefik

    Traefik -->|"/ priority 1"| nginx["nginx\nStatic files"]
    Traefik -->|"/api/ut/* priority 30"| api["api\nExpress :3100"]
    Traefik -->|"/api/rt/quote priority 30"| api
    Traefik -->|"/api/ut priority 20"| pgu["postgrest-ut\n:3000"]
    Traefik -->|"/api/rt priority 20"| pgr["postgrest-rt\n:3000"]
    Traefik -->|"/api/msg priority 30"| msg["msg-api\n:8000 (Python)"]
    Traefik -->|"/api/pipeline/comply priority 35"| comply["comply\n:8010"]
    Traefik -->|"/api/pipeline/sanitize priority 35"| sanitize["sanitize\n:8011"]
    Traefik -->|"/api/pipeline/gateway priority 35"| gateway["gateway\n:8012 (OpenClaw)"]
    Traefik -->|"/api/workshop priority 30"| api
    Traefik -->|"/n8n priority 10"| n8n["n8n\n:5678"]

    api --> postgres[("PostgreSQL\n:5432")]
    pgu --> postgres
    pgr --> postgres
    api -->|"OAuth2 + REST"| Salesforce["Salesforce\n(external)"]
    api -->|"API key"| Anthropic["Anthropic Claude\n(external)"]
    api -->|"HTML→PDF"| gotenberg["gotenberg\n:3000 (Chromium)"]
    gotenberg -->|"PDF buffer"| pdfstore[("pdf-store\n/pdf-store volume")]
```

---

## Database Schema (ERD)

> Key tables and their relationships. `sf.bom_parts` is a materialized view; `sf.part_last_used` is a regular view. Both are derived from `sf.jobs`.

```mermaid
erDiagram
    sf_accounts {
        text sf_id PK
        text name
        text type
        text market
        text status
        text region
        boolean credit_hold
        boolean faa_account
        text techniques_criterias
        text[] oem_approvals
        numeric ytd_total
        numeric ytd_lab_revenue
        numeric ytd_field_revenue
    }
    sf_contacts {
        text sf_id PK
        text account_sf_id FK
        text first_name
        text last_name
        text email
        text title
    }
    sf_contracts {
        text sf_id PK
        text account_sf_id FK
        text contract_number
        text status
        date start_date
        date end_date
    }
    sf_jobs {
        text sf_id PK
        text account_sf_id FK
        text part_number
        text[] services
        numeric invoice_amount
        date date_received
        date date_completed
        text lab_status
        text billing_status
        boolean faa_job
        boolean expedite
        date date_due
    }
    sf_quotes {
        text sf_id PK
        text job_sf_id FK
        text account_sf_id FK
        numeric grand_total
        text status
    }
    sf_quote_lines {
        text sf_id PK
        text quote_sf_id FK
        text product_code
        numeric unit_price
        numeric total_price
    }
    sf_products {
        text sf_id PK
        text product_code
        numeric std_price
        numeric union_price
        numeric faa_price
    }
    sf_pricebook_entries {
        text sf_id PK
        text product_sf_id FK
        text pricebook_name
        numeric unit_price
    }
    sf_orders {
        text sf_id PK
        text account_sf_id FK
        text order_number
        text status
    }
    sf_order_items {
        text sf_id PK
        text order_sf_id FK
        text product_sf_id FK
        numeric quantity
        numeric unit_price
    }
    sf_bom_items {
        text sf_id PK
        text account_sf_id FK
        text part_number
        text service
        text specification
        text technique
    }
    sf_bom_parts_matview {
        text account_sf_id
        text part_number
        text[] services
        text[] specifications
        int job_count
        numeric avg_invoice
        text last_specification
        text last_technique
    }
    sf_part_last_used_view {
        text account_sf_id
        text part_number
        text[] last_services
        text last_specification
        text last_technique
        date last_job_date
    }
    ut_incoming_quotes {
        uuid id PK
        text quote_number
        text customer_name
        text status
        numeric grand_total
        text pdf_path
        int pdf_version
    }
    rt_incoming_quotes {
        uuid id PK
        text quote_number
        text part_number
        text customer_name
        text status
        numeric grand_total
        text pdf_path
        int pdf_version
    }
    app_job_runs {
        serial id PK
        text job_name
        timestamptz started_at
        text status
        jsonb records_upserted
        text summary
    }

    sf_accounts ||--o{ sf_jobs : "has"
    sf_accounts ||--o{ sf_quotes : "has"
    sf_accounts ||--o{ sf_contacts : "has"
    sf_accounts ||--o{ sf_contracts : "has"
    sf_accounts ||--o{ sf_orders : "has"
    sf_accounts ||--o{ sf_bom_items : "has"
    sf_jobs ||--o{ sf_quotes : "has"
    sf_jobs ||--o{ sf_orders : "linked"
    sf_quotes ||--o{ sf_quote_lines : "has"
    sf_orders ||--o{ sf_order_items : "has"
    sf_products ||--o{ sf_pricebook_entries : "priced in"
    sf_products ||--o{ sf_order_items : "ordered as"
    sf_accounts ||--o{ sf_bom_parts_matview : "aggregated into"
    sf_jobs ||--o{ sf_bom_parts_matview : "aggregated into"
    sf_accounts ||--o{ sf_part_last_used_view : "derived from"
    sf_jobs ||--o{ sf_part_last_used_view : "derived from"
    ut_incoming_quotes ||--o{ app_job_runs : "tracked by"
    rt_incoming_quotes ||--o{ app_job_runs : "tracked by"
```

---

## WF-5 Inspection Pipeline Flow

> How an MSG file becomes a structured inspection result.

```mermaid
flowchart TD
    A["User uploads .msg/.eml\n(MsgUploader component)"] --> B["POST /api/msg/parse\nmsg-api :8000"]
    B --> C["Structured email data\n(subject, body, attachments)"]
    C --> D["POST /api/ut/integrations/pipeline/run\napi :3100 — creates intake record"]
    D --> E["Step: sanitize\nPOST /api/pipeline/sanitize"]
    E --> F["Step: comply\nPOST /api/pipeline/comply"]
    F --> G["Step: gateway\nPOST /api/pipeline/gateway\n(OpenClaw AI)"]
    G -->|"has attachment?"| H["Step: attachment processing\n(per inspection-type config)"]
    G -->|"no attachment"| I["Pipeline complete"]
    H --> I
    I --> J["app.pipeline_logs written\nper step: input, output, duration, status"]
    J --> K["ExecutionLogViewer\n/audit/:intakeId"]
```

---

## Salesforce Sync Flow

> How SF historical data lands in PostgreSQL. Read-only from SF — no writes back.

```mermaid
flowchart LR
    A["Trigger\n(cron 3am daily\n/ POST /bom/sync\n/ manual --mode full)"] --> B["sf_sync.py\n(Python script)"]
    B -->|"client_credentials OAuth"| C["Salesforce REST API\nndt.my.salesforce.com"]
    C -->|"Accounts, Jobs, Quotes,\nProducts, PricebookEntries,\nContacts, Contracts,\nOrders, OrderItems"| B
    B -->|"UPSERT ON CONFLICT"| D[("sf.accounts · sf.contacts\nsf.contracts · sf.products\nsf.pricebook_entries\nsf.jobs · sf.quotes\nsf.quote_lines\nsf.orders · sf.order_items\nsf.bom_items (if env set)")]
    D --> E["REFRESH MATERIALIZED VIEW\nsf.bom_parts\n(adds last_spec, last_technique)"]
    E --> F["sf.part_last_used VIEW\n(auto-current — no refresh)"]
    B --> G["INSERT app.job_runs\n{started_at, finished_at,\nstatus, records_upserted, summary}"]
    G --> H["Admin → Jobs dashboard\nGET /admin/jobs?job=sf_sync"]
```

---

## API Call Map (Frontend → Backend)

> Which components hit which endpoints.

```mermaid
graph LR
    subgraph Frontend
        DA["AnalyticsDashboard"]
        AI["AiAssistant"]
        Admin["AdminApp / JobsTab"]
        SFA["SfAnalysisApp\n(CustomerOrders · PartsCatalog · Chat)"]
        MsgUp["MsgUploader"]
        Settings["SettingsApp"]
        Quotes["QuotesApp"]
        WS["WorkshopDashboard\n(InspectionLane · CompletedTray\nJobDetailModal · SimulationPanel)"]
    end

    subgraph API ["api :3100 (via Traefik /api/ut/...)"]
        AnalyticsEP["GET /admin/analytics"]
        AIQ["POST /admin/ai-query"]
        Jobs["GET /admin/jobs\nGET /admin/jobs/:id"]
        BOMParts["GET /bom/parts\nGET /bom/parts/:p/history\nGET /bom/parts/:p/last-used\nGET /bom/accounts\nGET /bom/accounts/:id/parts"]
        Sync["POST /bom/sync"]
        SFAnalysis["GET /sf-analysis/customers\nGET /sf-analysis/customers/:id/activity\nGET /sf-analysis/parts\nPOST /sf-analysis/chat"]
        Pipeline["POST /integrations/pipeline/run\nGET /integrations/pipeline/status/:id"]
        SettingsEP["GET/PUT /settings/providers"]
        QuoteEP["POST /quote\nGET /quote/:id\nPUT /quote/:id\nPOST /quote/:id/pdf\nGET /quote/:id/pdf"]
        RtQuoteEP["POST /rt/quote/:id/pdf\nGET /rt/quote/:id/pdf"]
        WorkshopEP["GET /workshop/sse\nGET /workshop/settings\nPOST /workshop/orders\nPOST /workshop/jobs/:id/schedule\nPOST /workshop/webhook/scan\nDELETE /workshop/simulation/clear"]
    end

    DA -->|"on mount + date change"| AnalyticsEP
    AI -->|"on send"| AIQ
    Admin --> Jobs
    SFA -->|"CustomerOrdersTab"| SFAnalysis
    SFA -->|"PartsCatalogTab"| SFAnalysis
    SFA -->|"SfChatTab"| SFAnalysis
    SFA -->|"account dropdown"| BOMParts
    MsgUp --> Pipeline
    Settings --> SettingsEP
    Settings --> Sync
    Quotes --> QuoteEP
    Quotes --> RtQuoteEP
    WS -->|"SSE + mutations"| WorkshopEP
```

---

## Analytics Dashboard — Section Map

> Visual layout of the rebuilt AnalyticsDashboard (dark glassmorphism).

```mermaid
graph TD
    Root["bg-slate-950\n3 blur orbs + ambient gradient"]
    Root --> H["Header\nTitle + DateRangeFilter + Refresh"]
    Root --> HeroKPI["Hero KPIs (4-col grid)\nSF Total Revenue · Active Accounts\nSF Jobs Completed · Quote Win Rate\n(gradient bg tiles)"]
    Root --> SecKPI["Secondary KPIs (4-col grid)\nAvg Accepted Quote · Pipeline Value\nLast Sync · MoM Growth\n(glass cards)"]
    Root --> SF["── SALESFORCE PERFORMANCE ──\nYoY Revenue (ComposedChart)\nService Revenue Trend stacked (AreaChart)"]
    Root --> Acct["── ACCOUNT INTELLIGENCE ──\nTop 15 Accounts (horizontal BarChart)\nMarket Revenue Trend stacked (AreaChart)"]
    Root --> Ops["── OPERATIONAL METRICS ──\nTurnaround Time (ComposedChart dual-Y)\nAvg Invoice by Service (horizontal BarChart)"]
    Root --> Quote["── QUOTE ANALYTICS ──\nQuote Revenue Trend (AreaChart UT+RT)\nStatus Distribution (donut PieChart)"]
    Root --> WR["Win Rate Trend (full-width ComposedChart)"]
    Root --> Proj["── PROJECTION ── (conditional)\nRevenue Projection 3-month (ComposedChart dashed)"]
```

---

## Workshop Dashboard Data Flow

> How real-time updates flow from QR scan / order creation to the dashboard.

```mermaid
flowchart TD
    A["QR Scanner / SimulationPanel"] -->|"POST /api/workshop/webhook/scan\n POST /api/workshop/orders"| B["Express workshop.ts\n(api :3100)"]
    B -->|"INSERT/UPDATE"| C[("workshop.orders\nworkshop.jobs\n(PostgreSQL)")]
    B -->|"broadcastUpdate()\nfetchTodayOrders()"| D["SSE sseClients Set\n(in-memory)"]
    D -->|"event: update\ndata: WorkshopOrder[]"| E["useWorkshopOrders\n(SSE hook — React)"]
    E -->|"setState(orders)"| F["WorkshopDashboard\n→ InspectionLane\n→ JobCard / JobDetailModal\n→ CompletedTray"]

    G["DragDropProvider\n(@dnd-kit)"] -->|"onDrop callback"| H["useScheduleJob\nPOST /jobs/:id/schedule"]
    H --> B

    I["SimulationContext\n(App-level, above Router)"] -->|"setInterval tick\n→ createOrder + scan"| B
```
