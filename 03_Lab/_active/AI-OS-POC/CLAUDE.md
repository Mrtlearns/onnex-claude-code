# AI-OS-POC — Claude Code Project Instructions

## What Is This

**AI-OS-POC** is a full-stack, multi-tenant, AI-native operating system proof of concept for agencies. It combines CRM, project management, financial, document management, AI assistant, and workflow automation into a single platform.

**Current Status:** v2.0 complete, v3.0 (production hardening) in planning.

---

## Monorepo Structure

```
AI-OS-POC/
├── apps/
│   ├── web/          # Next.js 14.2.25 App Router frontend
│   └── api/          # Fastify 4.x REST API backend
├── context/          # Technical design documents (architecture, domain model, API)
├── docs/             # Operational documentation
├── outputs/          # Docker Compose stack, env template, observability configs
├── scripts/          # Python/shell deployment & seeding utilities
├── .planning/        # Project governance (STATE.md, MILESTONES.md, ROADMAP.md)
└── files/            # Supporting assets (images, seed SQL)
```

---

## Core Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14.2.25 (App Router) | **Pinned** — CVE-2025-29927 fix |
| Auth | next-auth v5.0.0-beta.30 | Pinned beta; OIDC via Authentik |
| UI | shadcn/ui + Tailwind CSS v3 | **Tailwind v3 only** — v4 breaks Next.js 14 |
| State | Zustand (UI) + TanStack Query (server) | No Redux |
| Forms | React Hook Form + Zod v3 | Zod v3 pinned |
| Backend | Fastify 4.x (TypeScript, ESM) | No ORM — raw SQL |
| Database | PostgreSQL 16 + pgvector | HNSW index, cosine distance |
| Auth Provider | Authentik 2024.10.x | OIDC/OAuth2, JWKS validation |
| Cache/Queue | Redis | BullMQ, pub/sub |
| Workflows | Temporal (self-hosted) | Durable execution |
| Automation | n8n | Visual pipelines, RAG hooks |
| Agents | OpenClaw | Claude API orchestration |
| Storage | MinIO | S3-compatible |
| Docs | Paperless-ngx + Paperless-AI 2.7.8 | Downgraded for stability |
| Collaboration | Nextcloud | WebDAV, file portal |
| Reverse Proxy | Traefik v3.2/v3.3 | Subdomain routing, TLS |
| Observability | Prometheus + Grafana + Loki | Full metrics/logs |
| Testing (Unit) | Vitest | jsdom |
| Testing (E2E) | Playwright | 17 test suites, 6 auth states |

---

## Critical Version Pins — Do Not Upgrade Without Research

| Package | Pinned Version | Reason |
|---|---|---|
| `next` | 14.2.25 | CVE-2025-29927 (CVSS 9.1 middleware bypass) |
| `next-auth` | 5.0.0-beta.30 | wellKnown OIDC discovery bug in other betas |
| `tailwindcss` | ^3.4.x | v4 incompatible with Next.js 14 webpack CSS loader |
| `zod` | ^3.x | hookform/resolvers v4 has type regressions |
| `paperless-ai` | 2.7.8 | Latest has RAGZ regression |
| `fastify-metrics` | v11 | v12+ requires Fastify 5 |

---

## Architecture Rules

### Multi-Tenancy (Non-Negotiable)
- **Every database record carries `tenant_id`** — this is never optional
- All Fastify routes use `requireTenant` middleware before any query
- RBAC enforced at two levels: Next.js route guards (UX) + Fastify `requireRole` preHandler (security)
- 7 roles: `owner`, `ops_manager`, `account_manager`, `sales_rep`, `specialist`, `recruiter`, `client_external`, `read_only`

### Network Isolation (Docker Compose)
- `edge_net` — Traefik + Authentik only (public-facing)
- `app_net` — Application services (Next.js, Fastify, Temporal, n8n, OpenClaw, Nextcloud)
- `data_net` (internal: true) — PostgreSQL, Redis, MinIO, Paperless (no external access)

### Frontend Patterns
- Use **Server Components** by default; only add `"use client"` when needed
- `src/lib/api-client.ts` is **server-only** — never import in Client Components
- Data fetching via TanStack Query with `HydrationBoundary` for SSR
- Zustand is for UI-only state (sidebar, modals); server state belongs in React Query

### Database
- No ORM — all schema managed via SQL migrations in `apps/api/src/db/migrations/`
- pgvector: register types on `pool.on('connect')`, not after pool creation
- Memory retrieval: `embedding <=> $1 ASC` (not DESC) to engage HNSW index
- Temporal DB uses driver `postgres12` not `postgresql`

### Storage Ownership
- Services do not share writable volumes — Nextcloud, Paperless, MinIO each own their PVs
- Cross-service communication via API only (no shared file paths)

---

## Deployment Context

| Item | Value |
|---|---|
| VM | Proxmox Agency-POC — `10.10.110.31` |
| Jump Host | `claude-controller` — `100.111.233.126` (Tailscale) |
| Compose file on VM | `/opt/agency-ai-os/infra/docker-compose.yml` |
| Secrets on VM | `/opt/agency-ai-os/infra/env/.env` (never committed) |
| Frontend | `http://10.10.110.31:3002` (direct) or `:8888` (via Traefik) |
| API | `http://10.10.110.31:3001` |
| External domain | `https://agencyos-v1.on-nex.us` (Phase 3.5+) |

## Docker Compose — Always Use Make

**Never run `docker compose up/down/restart` directly on this VM.** The secrets file is at `env/.env`, not the compose-default `.env`, so raw `docker compose` commands start containers with all `AUTH_*` env vars empty — breaking Authentik SSO (next-auth returns `error=Configuration` and redirects to `0.0.0.0`).

Always use the Makefile:

```bash
cd /opt/agency-ai-os/infra

make up                        # start all services
make up SERVICE=aios-web       # start one service
make restart SERVICE=aios-api  # restart one service
make down                      # stop all
make logs SERVICE=aios-web     # tail logs
```

The Makefile expands to `docker compose -f docker-compose.yml --env-file env/.env …` — that `--env-file` flag is the critical piece.

---

## SSH Access — Correct Pattern

ProxyJump (`-J`) does **not** work here because the private key isn't forwarded to the jumpbox for the second hop. Use this two-step pattern instead:

```bash
# Step 1: key auth to jumpbox (Tailscale IP — NOT 10.10.30.40)
# Step 2: sshpass from jumpbox to target VM
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 -o StrictHostKeyChecking=no mrt@100.111.233.126 \
  "sshpass -p 'Poll0000' ssh -o StrictHostKeyChecking=no -o PreferredAuthentications=password root@10.10.110.31 'YOUR COMMAND'"
```

| Hop | Host | User | Auth |
|---|---|---|---|
| 1 — Jumpbox | `100.111.233.126` (Tailscale) | `mrt` | `~/.ssh/MrT_Personal_Key_ed25519` |
| 2 — Target VM | `10.10.110.31` | `root` | password `Poll0000` |

---

## Google Drive & NAS Architecture

### "1 Onnex Main" Team Drive

The entire document library (Google Drive shared drive) is synced via a three-layer architecture (as of 2026-04-05):

**Drive Details:**
- **ID:** `0ADlSo-YFtIREUk9PVA`
- **Size:** ~27 GB, 9,950 files across 22 folders
- **Currently synced:** "04 Clients" subfolder only (~1.87 GiB, 414 files)

**Three-Layer Model:**

1. **Google Drive** (source of truth) — 22 folders (01 Archive through Z Misc)
2. **NAS-Full-Onnex** (MinIO bucket `onnex-main`) — one-time archive of full drive, ~27 GB
3. **Active Sync** (MinIO bucket `gdrive-sync`) — switches between:
   - `SYNC_MODE=gdrive` (production) — live sync from "04 Clients" folder
   - `SYNC_MODE=nas` (development) — intra-NAS copy from `onnex-main`, near-instant

**Why three layers?**
- GDrive pulls take 1-2 hours; NAS pulls take ~1 min
- Enables rapid iteration on folder expansion without repeated 27 GB re-downloads
- Once NAS archive is populated, all subsequent testing/dev uses local NAS as source

**Setup:** Done 2026-04-05. See `context/NAS-FULL-ONNEX-ARCHITECTURE.md` for full design, folder list, and procedures.

---

## Key File Locations

| Purpose | Path |
|---|---|
| Project state & decisions | `.planning/STATE.md` |
| Full architecture + port map | `docs/ARCHITECTURE.md` |
| **NAS-Full-Onnex design** | `context/NAS-FULL-ONNEX-ARCHITECTURE.md` ⭐ |
| DB schema (50+ tables) | `context/domain-model.md` |
| API surface | `context/API.md` or `context/api-surface.md` |
| GDrive sync runbook | `infra/docs/gdrive-sync-runbook.md` |
| Operations runbook | `infra/docs/ops-runbook.md` |
| Docker Compose stack | `outputs/01-03-compose.yml` |
| Env template | `outputs/01-03-env` |
| rclone config + scripts | `infra/rclone/` (sync.sh, gdrive-archive-pull.sh) |
| DB migrations | `apps/api/src/db/migrations/` |
| E2E tests | `apps/web/e2e/tests/` (17 suites) |
| Seeding scripts | `scripts/seed_demo_data.py`, `files/seed_demo.sql` |

---

## What's In v3.0 (Not Started)

- Traefik TLS for all services
- Authentik full browser E2E test
- VALIDATION.md + formal test coverage
- Kanban DnD persistence
- Invoice PDF + SMTP delivery
- Performance profiling + bundle optimization
- Client demo environment automation
