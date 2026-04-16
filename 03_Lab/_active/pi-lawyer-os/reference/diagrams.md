# PI Lawyer OS — Diagrams

> Last updated: 2026-03-20
> Covers changes through: 0323e1a (Phase 12 — Platform Scale, v4.1 complete)

---

## System Architecture

> Overview of Docker Compose services and request routing.

```mermaid
graph TD
    Browser["Browser / Client"]
    Traefik["Traefik v3\n(port 80/443)"]
    Frontend["frontend\nnginx + React SPA"]
    Auth["auth\nFastAPI :8000"]
    PostgREST["postgrest\n:3000"]
    AI["ai\nFastAPI :8002"]
    Files["files\nFastAPI :8001"]
    N8N["n8n\n:5678 (9 workflows)"]
    OpenClaw["openclaw\nWyatt :47823"]
    MCP["tools/postgrest-mcp.js\n(child process, MCP)"]
    Postgres["postgres\npgvector :5432"]
    OpenRouter["OpenRouter API\n(external)"]
    Twilio["Twilio\n(external)"]
    Claude["Anthropic API\n(external)"]

    Browser --> Traefik
    Traefik -->|"* (SPA routes)"| Frontend
    Traefik -->|"/api"| PostgREST
    Traefik -->|"/auth"| Auth
    Traefik -->|"/ai/"| AI
    Traefik -->|"/files"| Files
    Traefik -->|"/n8n"| N8N
    Traefik -->|"/openclaw"| OpenClaw

    Auth --> Postgres
    PostgREST --> Postgres
    AI --> Postgres
    Files --> Postgres
    Files -->|"fire-and-forget embed"| AI
    N8N --> Postgres
    OpenClaw --> OpenRouter
    OpenClaw -->|"stdin/stdout JSON-RPC"| MCP
    MCP -->|"Bearer JWT"| PostgREST
    AI --> Claude
    AI --> OpenRouter
    N8N --> Twilio
```

---

## Database Schema (ERD)

> Core tables and foreign key relationships. All tables have `firm_id` FK to `firms`. Phases 07–12 additions shown.

```mermaid
erDiagram
    firms {
        uuid id PK
        text name
        text slug
        text phone
        text logo_url
        text primary_color
        text sms_signature
        text smtp_host
        int smtp_port
        text smtp_user
        text smtp_password
        text stripe_customer_id
        text stripe_subscription_id
        text subscription_status
    }
    users {
        uuid id PK
        uuid firm_id FK
        text email
        text role
        boolean active
    }
    leads {
        uuid id PK
        uuid firm_id FK
        text first_name
        text last_name
        text status
        text source
        text injury_type
        timestamptz last_contact_at
        uuid referred_by_partner_id FK
        int lead_score
        text lead_score_reason
        boolean is_duplicate
        uuid duplicate_of_lead_id FK
        date date_of_loss
        text fault
        boolean has_medical
        text preferred_language
    }
    communications {
        uuid id PK
        uuid lead_id FK
        text channel
        text direction
        text message
    }
    cases {
        uuid id PK
        uuid firm_id FK
        uuid lead_id FK
        uuid client_id FK
        text case_number
        text status
        date sol_date
        numeric attorney_fee_pct
    }
    clients {
        uuid id PK
        uuid firm_id FK
        text first_name
        text last_name
        text insurance_carrier
        text preferred_language
    }
    documents {
        uuid id PK
        uuid case_id FK
        text doc_type
        boolean shared_with_client
    }
    document_chunks {
        uuid id PK
        uuid document_id FK
        uuid firm_id FK
        int chunk_index
        text content
        vector embedding
    }
    medical_providers {
        uuid id PK
        uuid case_id FK
        text name
        text provider_type
        numeric lien_amount
        text request_status
    }
    settlement_offers {
        uuid id PK
        uuid case_id FK
        text offer_by
        numeric amount
        boolean accepted
    }
    case_settlements {
        uuid id PK
        uuid case_id FK
        numeric gross_settlement
        numeric attorney_fee_pct
        numeric net_to_client
    }
    case_costs {
        uuid id PK
        uuid case_id FK
        text cost_type
        numeric amount
        boolean paid
    }
    partners {
        uuid id PK
        uuid firm_id FK
        text name
        text partner_type
    }
    partner_referrals {
        uuid id PK
        uuid partner_id FK
        uuid lead_id FK
        uuid case_id FK
        numeric commission_pct
        boolean commission_paid
    }
    client_users {
        uuid id PK
        uuid firm_id FK
        uuid client_id FK
        text email
        boolean active
    }
    firm_settings {
        uuid id PK
        uuid firm_id FK
        text llm_provider
        text llm_model
    }
    audit_log {
        uuid id PK
        uuid firm_id FK
        text entity_type
        uuid entity_id
        text action
        uuid actor_id
        jsonb old_values
        jsonb new_values
        timestamptz created_at
    }
    objection_library {
        uuid id PK
        uuid firm_id FK
        text category
        text objection
        text response
        boolean active
    }
    document_templates {
        uuid id PK
        uuid firm_id FK
        text template_type
        text name
        text content
        boolean active
    }

    firms ||--o{ users : "staff"
    firms ||--o{ leads : ""
    firms ||--o{ cases : ""
    firms ||--o{ partners : ""
    firms ||--|| firm_settings : "1:1"
    firms ||--o{ objection_library : ""
    firms ||--o{ document_templates : ""
    firms ||--o{ audit_log : ""
    leads ||--o{ communications : "timeline"
    leads ||--o{ partner_referrals : ""
    partners ||--o{ partner_referrals : ""
    cases ||--o{ documents : ""
    documents ||--o{ document_chunks : "RAG"
    cases ||--o{ medical_providers : ""
    cases ||--o{ settlement_offers : ""
    cases ||--|| case_settlements : "1:1"
    cases ||--o{ case_costs : ""
    clients ||--o{ cases : ""
    clients ||--o{ client_users : "portal"
```

---

## Key Data Flow — Wyatt AI Agent Session

> How a staff user connects to the Wyatt AI agent via the iframe.

```mermaid
sequenceDiagram
    participant Browser
    participant ReactSPA
    participant AuthService
    participant OpenClaw
    participant MCP as postgrest-mcp.js
    participant PostgREST

    Browser->>ReactSPA: Navigate to /ai-agent
    ReactSPA->>AuthService: GET /auth/openclaw-token (Bearer staff JWT)
    AuthService-->>ReactSPA: { token: "OPENCLAW_GATEWAY_TOKEN" }
    ReactSPA->>ReactSPA: Build iframe src<br/>/openclaw/#gatewayUrl=ws://host/openclaw&token=TOKEN
    ReactSPA->>OpenClaw: Load iframe (GET /openclaw/)
    OpenClaw-->>ReactSPA: Control UI HTML
    ReactSPA->>OpenClaw: WebSocket connect + token auth
    OpenClaw-->>ReactSPA: Session ready — Wyatt loaded
    Browser->>OpenClaw: Chat message (e.g. "How many open leads?")
    OpenClaw->>OpenClaw: Inject SOUL.md + IDENTITY.md + USER.md
    OpenClaw->>MCP: JSON-RPC tools/call: get_leads (stdin)
    MCP->>MCP: Generate HS256 JWT (JWT_SECRET)
    MCP->>PostgREST: GET /api/leads (Bearer JWT)
    PostgREST-->>MCP: leads array (firm-scoped)
    MCP-->>OpenClaw: Tool result (stdout)
    OpenClaw-->>Browser: Wyatt response with real data
```

---

## Document RAG Flow

> How uploaded documents become searchable by meaning.

```mermaid
sequenceDiagram
    participant Staff
    participant FilesSvc as files service
    participant AISvc as ai service
    participant OpenRouter
    participant DB as document_chunks (DB)

    Staff->>FilesSvc: POST /files/upload (multipart)
    FilesSvc->>DB: INSERT documents row
    FilesSvc->>FilesSvc: Commit transaction
    FilesSvc-->>Staff: 200 OK { id, name, ... }
    FilesSvc->>AISvc: POST /ai/embed-document?document_id=X<br/>(background thread, fire-and-forget)
    AISvc->>AISvc: Read file from disk
    AISvc->>AISvc: Chunk text (~500 words, 50-word overlap)
    AISvc->>OpenRouter: POST /embeddings (text-embedding-3-small)
    OpenRouter-->>AISvc: float[] 1536 dimensions
    AISvc->>DB: INSERT document_chunks (chunk_index, content, embedding)

    note over Staff,DB: Later — semantic search
    Staff->>AISvc: POST /ai/search-documents { query, case_id }
    AISvc->>OpenRouter: Embed query text
    OpenRouter-->>AISvc: query vector
    AISvc->>DB: SELECT ... ORDER BY embedding <=> query_vector LIMIT 5
    DB-->>AISvc: Top 5 chunks with similarity score
    AISvc-->>Staff: { query, results: [{content, similarity, file_name}] }
```

---

## Frontend → Backend API Call Map

> Which pages and components call which backend services.

```mermaid
graph LR
    Login -->|"POST /auth/login"| AuthSvc["Auth Service"]
    IntakeForm -->|"POST /auth/intake"| AuthSvc
    Dashboard -->|"GET /api/leads"| PGR["PostgREST"]
    Dashboard -->|"GET /api/lead_funnel_stats"| PGR
    Dashboard -->|"GET /api/partner_performance"| PGR
    Leads -->|"GET /api/leads"| PGR
    LeadDetail -->|"GET /api/leads/:id"| PGR
    LeadDetail -->|"GET /api/communications"| PGR
    LeadDetail -->|"GET /api/audit_log"| PGR
    Cases -->|"GET /api/cases"| PGR
    CaseDetail -->|"GET /api/cases/:id"| PGR
    CaseDetail -->|"GET /api/documents"| PGR
    CaseDetail -->|"GET /api/medical_providers"| PGR
    CaseDetail -->|"GET /api/settlement_offers"| PGR
    CaseDetail -->|"GET /api/case_settlements"| PGR
    CaseDetail -->|"GET /api/audit_log"| PGR
    CaseDetail -->|"POST /ai/generate-demand/:id"| AISvc["AI Service"]
    CaseDetail -->|"POST /ai/analyze-document"| AISvc
    CaseDetail -->|"GET /ai/similar-cases/:id"| AISvc
    CaseDetail -->|"POST /ai/search-documents"| AISvc
    CaseDetail -->|"POST /files/upload"| FilesSvc["Files Service"]
    Partners -->|"GET /api/partners"| PGR
    PartnerDetail -->|"GET /api/partner_referrals"| PGR
    Analytics -->|"GET /api/lead_funnel_stats"| PGR
    Analytics -->|"GET /api/case_stage_stats"| PGR
    Analytics -->|"GET /api/partner_performance"| PGR
    Analytics -->|"GET /api/source_attribution_stats"| PGR
    Analytics -->|"GET /api/attorney_performance"| PGR
    AIAgent -->|"GET /auth/openclaw-token"| AuthSvc
    AIAgent -->|"GET /auth/llm-settings"| AuthSvc
    Settings -->|"GET /auth/llm-settings"| AuthSvc
    Settings -->|"PUT /auth/llm-settings"| AuthSvc
    Settings -->|"GET /api/firms"| PGR
    Settings -->|"PATCH /api/firms"| PGR
    Settings -->|"GET /api/objection_library"| PGR
    Settings -->|"PATCH /api/objection_library"| PGR
    Settings -->|"GET /api/document_templates"| PGR
    Settings -->|"PATCH /api/document_templates"| PGR
    Settings -->|"GET /auth/list-users"| AuthSvc
    Settings -->|"POST /auth/create-user"| AuthSvc
    Settings -->|"PATCH /auth/update-user/:id"| AuthSvc
    PortalLogin -->|"POST /auth/portal-login"| AuthSvc
    ClientPortal -->|"GET /api/cases/:id"| PGR
    ClientPortal -->|"GET /api/documents (shared)"| PGR
```

---

## LLM Settings Flow

> How changing the LLM in Settings propagates to OpenClaw.

```mermaid
sequenceDiagram
    participant Settings
    participant AuthService
    participant DB as firm_settings (DB)
    participant Config as openclaw.json (bind mount)
    participant OpenClaw

    Settings->>AuthService: PUT /auth/llm-settings {provider, model}
    AuthService->>DB: UPSERT firm_settings
    AuthService->>Config: Rewrite openclaw.json with new model string
    AuthService-->>Settings: {config_written: true, restart_required: true}
    note over OpenClaw: Container restart required to pick up new config
```

---

## White-Label Branding Flow

> How per-firm branding flows from DB to every user session.

```mermaid
sequenceDiagram
    participant Browser
    participant AuthService
    participant DB as firms (DB)
    participant LocalStorage

    Browser->>AuthService: POST /auth/login {email, password}
    AuthService->>DB: SELECT f.logo_url, f.primary_color, f.sms_signature FROM firms f
    DB-->>AuthService: branding fields
    AuthService-->>Browser: { token, user, firm: { logo_url, primary_color, sms_signature } }
    Browser->>LocalStorage: setItem('firm', JSON.stringify(firm))
    note over Browser: Every component render
    Browser->>LocalStorage: getItem('firm') via useFirmBranding()
    Browser->>Browser: Sidebar: show firm logo / primary_color icon bg
    Browser->>Browser: Settings: pre-fill Firm Branding card
```
