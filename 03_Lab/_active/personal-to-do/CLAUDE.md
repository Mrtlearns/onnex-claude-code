# Knowledge Universe — Personal To-Do POC

> **Template:** pro | **Started:** 2026-03-30
> **Owner:** Mr. T — Onnex AI Agency
> **Status:** MVP deployed and running

---

## What This POC Is

A glassmorphic knowledge management application with two visualization modes:
- **Universe View** — knowledge nodes rendered as CSS 3D glowing spheres floating in a dark space canvas, connected by animated SVG lines
- **Mindmap View** — the same nodes in a React Flow graph

Nodes age over time using a color state machine (fresh → aging → urgent → catchall), making neglected knowledge visually prominent. An AI assistant (OpenRouter) can query the graph. Supports iframe embedding with a postMessage bridge.

---

## Your Role

You are a senior technical collaborator continuing development on this POC. The MVP is already built and deployed. Read `context/current-state.md` first to understand what's done and what's pending.

Do not re-explain the stack or re-derive what's already built. Pick up from where it left off.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14.2.25 (App Router, `output: standalone`) |
| Language | TypeScript 5.4.5 |
| Styling | Tailwind CSS 3.4.17 + custom glassmorphism |
| DB ORM | Drizzle ORM + `postgres` driver (postgres-js) |
| State | Zustand 4.5.2 |
| Graph | React Flow 11.11.4 (mindmap view) |
| Auth | jose 5.6.3 — cookie-based JWT (`ku_session`, 7-day) |
| AI | OpenRouter → `anthropic/claude-haiku` |
| Logging | pino 9.3.2 + pino-pretty |
| Storage | Supabase Storage (`@supabase/supabase-js` 2.44.4) |
| ID gen | nanoid |
| Validation | zod 3.23.8 |

**No Three.js. Sphere universe is pure CSS 3D transforms.**

---

## Infrastructure

| Resource | Value |
|----------|-------|
| Schema | `poc_personal_to_do` |
| Storage bucket | `poc-personal-to-do-uploads` |
| Public URL | `https://personal-to-do.poc.playsap.us` (Pi-hole internal DNS) |
| Direct IP | `http://10.10.110.34:3100` |
| poc-backend | `10.10.110.34` |
| Deploy path | `/opt/pocs/personal-to-do/` |
| Container | `personal-to-do-app-1` |

---

## DB Connection — Critical

The app connects to Postgres **directly** via the `supabase_default` Docker network.

```
DATABASE_URL=postgresql://supabase_admin:<pw>@supabase-db:5432/postgres
```

**Never use `10.10.110.34:5432`** — that is Supavisor (the pooler) and will reject with
`"Tenant or user not found"`.

The container must be on both Docker networks:
```yaml
networks:
  - poc-net          # Traefik routing
  - supabase_default # Direct Postgres access
```

For seeds/migrations that run outside the container, use a temporary Docker container:
```bash
docker run --rm --network supabase_default \
  -v /opt/pocs/personal-to-do:/app -w /app \
  -e DATABASE_URL="postgresql://supabase_admin:<pw>@supabase-db:5432/postgres" \
  node:20-alpine sh -c "npx tsx scripts/seed.ts"
```

---

## Credentials

| Service | Value |
|---------|-------|
| App login | `admin` / `Poll0000` |
| SSH to poc-backend | `mrt@10.10.110.34` password `Poll0000` (use paramiko from Windows) |
| Supabase Studio | `https://studio.poc.playsap.us` |
| Postgres password | In `.env` as `DATABASE_URL` |

---

## Project Structure

```
app/
  (app)/           Authenticated shell (layout + universe + mindmap)
  api/             REST endpoints (nodes, edges, attachments, ai, auth)
  embed/           iframe-embeddable view with postMessage bridge
  login/           Public login page
components/
  universe/        CSS 3D sphere canvas (UniverseCanvas, SphereNode, ConnectionLine)
  mindmap/         React Flow graph (MindmapView)
  node/            NodePanel (detail slide-in), NodeForm, AttachmentList
  ui/              GlassCard, GlassButton, StatusBadge
  layout/          Sidebar, ViewToggle
db/
  schema.ts        Drizzle schema — nodes, edges, node_attachments, action_logs
  index.ts         postgres-js Drizzle client
  migrations/      Raw SQL DDL
lib/
  auth.ts          JWT cookie auth (jose)
  aging.ts         Status state machine
  logger.ts        pino logger
  supabase.ts      Storage client
  nanoid.ts        ID generator
store/
  universe.ts      Zustand store (nodes, edges, selection, rotation, viewMode)
scripts/
  seed.ts          6 example nodes + 5 edges
middleware.ts      JWT guard — redirects UI to /login, returns 401 JSON for /api/*
```

---

## Aging State Machine

| Status | Threshold | Glow Color |
|--------|-----------|-----------|
| `fresh` | < 7 days since `last_accessed_at` | `#4ade80` green |
| `aging` | 7–30 days | `#facc15` yellow |
| `urgent` | 30–90 days | `#f97316` orange |
| `catchall` | > 90 days | `#94a3b8` grey |

Status is lazily recalculated on node fetch (not a cron job). `last_accessed_at` updates on GET `/api/nodes/[id]`.

---

## postMessage Bridge (embed view)

Inbound commands from parent frame:
- `{ type: 'KU_SELECT_NODE', nodeId }` — selects a node
- `{ type: 'KU_CREATE_NODE', data }` — creates a node
- `{ type: 'KU_GET_NODES' }` — returns all nodes

Outbound events to parent:
- `{ type: 'KU_NODE_SELECTED', node }`
- `{ type: 'KU_NODE_CREATED', node }`

---

## Deploy Pattern

```bash
# From Windows via paramiko:
# 1. SFTP files to /opt/pocs/personal-to-do/
# 2. SSH: docker compose up -d --build
# 3. Verify: curl -s http://localhost:3100/ → 307 (redirect to login)
```

See `context/lessons-learned.md` for all the gotchas encountered during initial build.

---

## Post-Build Verification Protocol

After any change:
1. Files at correct paths on server
2. `npm run build` clean locally before pushing
3. `docker compose up -d --build` succeeds
4. `curl localhost:3100` → 2xx/3xx
5. Login works, nodes load, universe renders
