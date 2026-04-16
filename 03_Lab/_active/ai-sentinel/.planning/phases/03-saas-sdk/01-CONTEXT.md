# Phase 3 — SDK + SaaS + Multi-tenant: Context

**Status:** Not started — depends on Phase 2 complete
**Milestone:** v3.0

---

## What This Phase Builds

Packages AI-Sentinel as an independently deployable product: Python SDK for embedding in third-party apps, multi-tenant SaaS deployment, white-label support, billing integration, and public API docs.

---

## Scope

### Python SDK
- pip-installable package: `pip install ai-sentinel-sdk`
- Wraps POST /check into a Python client with sync and async variants
- Guard tier shortcuts: `sentinel.check_input(prompt)`, `sentinel.check_output(response)`
- Session management helpers
- Policy config builder

### Multi-tenant SaaS
- Tenant isolation for policy rules, audit logs, and telemetry
- Per-tenant API key management
- Tenant-scoped rate limits and cost caps
- Tenant admin API

### White-label
- Configurable branding for Onnex client deployments
- Per-client policy profile presets (PI-law, NDT, MSP, generic)
- Custom domain support

### Billing
- Usage metering: requests/month, tokens/month, cost/month per tenant
- Billing integration (Stripe or equivalent)
- Usage reports

### Public Docs
- Full API reference (all endpoints, request/response schemas)
- Policy config schema documentation
- Integration guides (n8n, Python, Claude Code, Temporal)
- Deployment playbooks

---

## Key Decisions Required Before Planning

- [ ] SDK language scope: Python only or also TypeScript?
- [ ] Multi-tenancy model: separate DB per tenant or row-level isolation?
- [ ] Billing: Stripe or internal metering only?
- [ ] Public docs: Docusaurus, MkDocs, or auto-generated from OpenAPI?

---

## Run This Next (after Phase 2 complete)

```
/gsd:discuss-phase 3
```
