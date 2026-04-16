# Goals

## Active Goals

### G1: Complete Phase 11 — Reports + Admin
- **Milestone:** Reports dashboard (KPI rollups, revenue charts, utilization) + Admin panel (user management, tenant settings, RBAC config) fully implemented with BFF routes and TDD coverage
- **Success criteria:** All Phase 11 routes GREEN, UI renders correct data, multi-tenant isolation verified
- **By:** Q2 2026

### G2: Complete v3.0 Production Hardening
- **Milestone:** All v3.0 items shipped — Traefik TLS, Authentik full E2E test, VALIDATION.md, Kanban DnD persistence, Invoice PDF + SMTP, performance profiling, bundle optimization
- **Success criteria:** Platform passes formal VALIDATION.md checklist, deployable to `agencyos-v1.on-nex.us`
- **By:** Q2 2026

### G3: Client Demo Environment
- **Milestone:** Automated demo environment provisioning — fresh tenant with seeded data spun up from a single script in under 5 minutes
- **Success criteria:** Demo runs cleanly for any new prospect, seed data covers all 8 modules
- **By:** Q3 2026

### G4: Promote to GitLab + /promote
- **Milestone:** Graduate this POC from `03_Lab/_active/` to a full GitLab repo with CI/CD pipeline
- **Success criteria:** `/promote` skill executed, pipeline passes, repo at `gitlab.botonomy.xyz/onnex/agency-ai-os`
- **By:** After G2 complete
