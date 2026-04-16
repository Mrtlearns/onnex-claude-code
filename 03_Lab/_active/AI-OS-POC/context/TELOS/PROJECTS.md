# Projects

## Active

### AI-OS-POC — Agency AI-OS Platform
- **Status:** v2.0 complete (phases 01–10), v3.0 in planning
- **Stack:** Next.js 14.2.25, Fastify 4.x, PostgreSQL 16 + pgvector, Redis, Temporal, n8n, Authentik, Traefik, MinIO, Paperless-ngx, Nextcloud
- **Modules built:** Dashboard, Clients, Contacts, Projects, Tasks (kanban), Deals pipeline, Invoices, Time tracking, Documents, AI assistant, Portal, Notifications, Settings, Admin (stub)
- **VM:** Proxmox Agency-POC `10.10.110.31`, accessible via claude-controller jumpbox `100.111.233.126`
- **Next Actions:**
  - [ ] Write Phase 11 plan (reports + admin)
  - [ ] Execute Phase 11 with TDD
  - [ ] Begin v3.0 hardening checklist

## Planned

### Phase 11 — Reports + Admin
- **Status:** Directory created, no plan written yet
- **Scope:** KPI rollup reports, revenue/utilization charts, admin user management panel, tenant settings, RBAC config UI
- **Depends on:** Phases 09 (financial data) + 10 (types layer)

### v3.0 — Production Hardening
- **Status:** Not started
- **Scope:**
  - Traefik TLS for all services
  - Authentik full browser E2E test
  - VALIDATION.md + formal test coverage matrix
  - Kanban DnD persistence (currently UI-only)
  - Invoice PDF generation + SMTP delivery
  - Performance profiling + bundle optimization
  - Client demo environment automation

## Completed

### Phases 01–06: Infrastructure
Docker Compose stack, Traefik, Temporal, Paperless-ngx, observability (Prometheus + Grafana + Loki), backup/restore scripts, ops runbook.

### Phases 07–10: Application Core
Auth (next-auth v5 OIDC + Authentik), app shell, RBAC, all 8 UI modules, Fastify CRUD routes, TDD test suites, types/schemas/api-client layer.
