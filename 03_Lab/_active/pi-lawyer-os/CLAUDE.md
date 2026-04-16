# PI Growth OS

> **Type:** Lab → Active POC (03_Lab/_active)
> **Owner:** Mr. T — Onnex AI Agency
> **Vertical:** Personal Injury Law Firms
> **Phase:** 1 — Revenue Protection (in progress)
> **Started:** 2026-01-01

---

## What This Project Is

AI-powered operating system for PI law firms (3–15 attorney practices). Replaces manual lead follow-up and intake chaos with automated speed-to-lead, missed call recovery, and intake completion workflows.

**Business model:** $40K+ build per client, $4K+ MRR ongoing
**Target:** Las Vegas PI firms first, then national expansion

**Read `context/TELOS/` for full strategic context.**

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 App Router |
| API | FastAPI + Hasura GraphQL |
| Workflows | Temporal (lead lifecycle orchestration) |
| Messaging | Twilio (SMS/voice with TCPA compliance) |
| Automation | n8n (webhook intake, CRM sync) |
| Database | PostgreSQL + pgvector |
| Auth | Authentik / JWT |
| Infra | Docker Compose, Traefik |

---

## Phase 1 Scope (Revenue Protection)

| Workflow | Status |
|----------|--------|
| Speed-to-lead (< 60 sec response) | In progress |
| Missed call recovery | In progress |
| Intake completion follow-up | In progress |
| TCPA opt-in compliance layer | In progress |
| Response time dashboard | Planned |
| Demo environment | Planned |

---

## Key Constraints

- **TCPA compliance is non-negotiable** — every SMS/call must have documented opt-in
- **Speed is the core value prop** — anything that slows lead response time is a bug
- Never hardcode Twilio credentials — always env vars
- Temporal workflows must be idempotent — safe to retry on failure
- Python preferred for FastAPI services, TypeScript for Next.js frontend

---

## Post-Build Verification

1. File placement confirmed at correct paths
2. Docker Compose stack starts clean (`docker compose up -d`)
3. Temporal worker connects and workflows register
4. Twilio webhook receives test lead and triggers response in < 60 seconds
5. TCPA opt-in flow verified end-to-end
6. Playwright E2E covers lead intake → notification → response cycle

---

## Available Hooks

Global hooks fire automatically (session-start, pre-tool-safety, session-end, auto-commit).
Local hooks: cost-tracker (after every tool), pre-compact (before compaction).