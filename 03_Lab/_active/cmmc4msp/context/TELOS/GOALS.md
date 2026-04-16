# Goals

## Active Goals

### G1: MVP Platform Deployment
- **Milestone:** Full stack running with all 8 n8n workflows active and E2E pipeline verified
- **Success criteria:** MSP admin can onboard a client org, seed 110 controls, upload an artifact, receive Claude assessment, and view live SPRS score
- **By:** 2026-04-18 (3-day sprint)
- **Status:** 100% complete — all 8 workflows active, SSP/POA&M PDF generation E2E verified (2026-04-16).

### G2: First Client Onboarding (Canopy Aerospace)
- **Milestone:** Canopy Aerospace and Defense fully onboarded with Phase 1 controls in progress
- **Success criteria:** Org + program created, team invited, Phase 1 (17 controls) unlocked, at least 3 artifacts assessed by Claude
- **By:** 2026-04-18
- **Status:** Partial — org/program created (org: a602b4a5, prog: ba8d74d0), 110 controls seeded, SPRS = -203. Remaining: invite client_admin user in Authentik, upload Phase 1 artifacts.

### G3: SSP & POA&M Generation
- **Milestone:** Automated document generation producing audit-ready PDFs
- **Success criteria:** Generated SSP matches C3PAO expectations; POA&M auto-populates from non-passing controls
- **By:** 2026-04-18
- **Status:** Complete (2026-04-16) — Workflow 08 active; FastAPI generates ReportLab PDFs, uploads to MinIO cmmc-reports; presigned download URL returned. E2E verified for Canopy program.
