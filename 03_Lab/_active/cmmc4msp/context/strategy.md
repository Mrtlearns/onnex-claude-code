# Strategy

> Current strategic priorities for CMMC Compliance OS.
> **Onnex-wide strategy lives in [TELOS/STRATEGIES.md](TELOS/STRATEGIES.md).**

## Project

CMMC Compliance OS — multi-tenant SaaS for MSPs to manage CMMC Level 2 compliance across defense contractor clients.

## Current Focus Period

MVP build and first client onboarding (Q2 2026)

## Strategic Priorities

1. **Deploy full stack on single VM** — All services containerized, Docker Compose, Traefik ingress. Prove the architecture works end-to-end before scaling.

2. **Claude-powered artifact assessment as differentiator** — The AI assessment loop (upload → extract → assess → score) is the core value prop. Get this right first.

3. **MSP-native multi-tenancy** — Single MSP (Onnex) managing multiple client orgs from one dashboard. Row-level isolation via Hasura + Authentik JWT claims.

## What Success Looks Like

- MSP admin can onboard a new defense contractor in under 30 minutes
- Contributors upload evidence and get AI assessment results within 2 minutes
- SPRS score auto-calculates correctly (validated against manual spreadsheet)
- SSP and POA&M PDFs pass C3PAO review

## Key Open Questions

- Pricing model: per-org flat fee vs. per-user vs. tiered by control count?
- Will we need to support CMMC Level 3 (NIST 800-172) in future?
- Integration with existing MSP PSA/RMM tools (ConnectWise, Datto)?

## Links to TELOS

| This project serves... | TELOS reference |
|------------------------|----------------|
| Onnex vertical AI-OS delivery mission | M1 |
| MVP Platform Deployment | G1 |
| Claude Assessment Accuracy | C1 |

_Update as priorities shift._
