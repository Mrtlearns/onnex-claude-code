---
name: poc-onboard
description: >
  Onboard a new proof-of-concept application. Provisions infrastructure (DB schema, storage bucket,
  Traefik route, Pi-hole DNS), copies a workspace template into the POC folder, writes CLAUDE.md
  and .env, then STOPS and hands off to a new Claude Code session in the POC directory.
  THIS COMMAND DOES NOT BUILD OR DEPLOY CODE. Building happens in the POC workspace.
  Two intake paths: (A) from zero; (B) import existing repo (Lovable/GitHub).
  Triggers on: "new poc", "onboard poc", "set up poc", "create poc", "add poc to supabase",
  "poc on supabase", "new app on poc-backend", "onboard <name>", "scaffold poc",
  "import poc", "bring in lovable project", "onboard lovable app".
  Does NOT trigger for: general Supabase admin, destroying a POC, building/deploying code.
---

# POC Onboard

## ⚠️ Session Boundary — Read This First

This command runs in **claude-workspace-pro**. Its job ends after infrastructure is provisioned
and the POC workspace is prepared. It does **NOT** write application code, run migrations,
build Docker images, or deploy anything.

```
claude-workspace-pro (this session)       POC workspace (new session)
─────────────────────────────────         ──────────────────────────
✅ Gather requirements                    ✅ Write application code
✅ Provision infra via API                ✅ Run DB migrations
✅ Copy template → POC folder             ✅ Build & deploy Docker
✅ Write CLAUDE.md + .env                 ✅ Seed data
✅ Tell user to open new session          ✅ E2E testing
🛑 STOP                                   ✅ Everything else
```

---

## Step 0: Intake Path

Ask: **"Is this a fresh build from scratch, or are you importing an existing repo (e.g. from Lovable)?"**

---

### Path A — From Zero

No existing code. Ask:
1. **POC name** — lowercase, hyphens ok (e.g. `personal-to-do`, `sales-demo`)
2. **One-line description** — what it does
3. Proceed to **Step 0B: Route Decision**.

---

### Path B — Import Existing Repo (Lovable / GitHub / etc.)

**B1.** Ask for the POC name.

**B2.** Create the project folder:
```bash
mkdir -p "D:/Code/Claude/03_POC/<name>"
```
Tell the user: _"Folder created. Clone or copy your repo into `D:\Code\Claude\03_POC\<name>` then confirm."_

**⏸ PAUSE — wait for user confirmation.**

**B3.** Analyze the imported codebase to determine:
- Tech stack (framework, language, runtime)
- Backend services expected (DB, storage, auth, queues)
- Env vars referenced (`.env.example`, `README`, configs)
- Existing `docker-compose.yml` or `Dockerfile`

Report findings, then proceed to **Step 0B** with answers already in hand.

---

### Step 0B: Route Decision — App vs VM

| Condition | Path |
|-----------|------|
| Only needs Postgres + pgvector + Redis + storage (± ClickHouse/Neo4j/Qdrant on poc-backend) | **App path** → `POST /api/v2/provision/app` |
| Needs custom DB version, new runtime, isolated networking, or unlisted services | **VM path** → `/provision-vm`, then return here for app provisioning if also needed |

---

## Provisioning API

| Network | Base URL |
|---------|----------|
| LAN (VLAN 30) | `http://10.10.30.40:5000` |
| Tailscale | `http://100.111.233.126:5000` |

Async — returns `job_id`. Stream via SSE: `GET /api/jobs/<job_id>/stream`

---

## Platform Reference

- **poc-backend**: `10.10.110.34` — Ubuntu Noble, Docker, 8c/24GB/120GB
- **Supabase API**: `https://poc-nursery.poc.playsap.us`
- **Supabase Studio**: `https://studio.poc.playsap.us`
- **Postgres direct** (from inside Docker on `supabase_default` network): `supabase-db:5432`
- **Postgres pooler** (Supavisor, external): `10.10.110.34:5432` — requires `user.tenant_id` format, avoid for app use
- **Wildcard cert**: `*.poc.playsap.us` on traefik-a (`10.10.30.35`) — no cert setup needed
- **POOLER_TENANT_ID**: `your-tenant-id` (default in self-hosted Supabase stack)

---

## Naming Conventions (MANDATORY)

| Resource | Pattern | Example |
|----------|---------|---------|
| Postgres schema | `poc_<name>` (underscores) | `poc_personal_to_do` |
| Storage bucket | `poc-<name>-<purpose>` | `poc-personal-to-do-uploads` |
| Redis key prefix | `<name>:` | `personal-to-do:jobs:` |
| Public hostname | `<name>.poc.playsap.us` | `personal-to-do.poc.playsap.us` |

Rules: no cross-POC foreign keys, no tables in `public` schema, no shared bucket names.

---

## Step 1: Gather Remaining Info

Before provisioning, collect:
- **Storage bucket?** — yes/no + purpose suffix (e.g. `uploads`, `docs`)
- **Public hostname?** — yes/no → `internal` (Pi-hole only) or `external` (public Route53)
- **App port** — if hostname wanted (pick a free port; avoid 3000/Supabase Studio)
- **Template** — which workspace template to copy: `base`, `pro`, or `pai`
  - `base` — lightweight, Liam + Cole personas
  - `pro` — full stack, Simon + GSD commands + agents + hooks ← default for most POCs
  - `pai` — PAI template (specialized)

---

## Step 2: Provision Infrastructure via API

```bash
BASE=http://10.10.30.40:5000

RESP=$(curl -s -X POST $BASE/api/v2/provision/app \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "<name>",
    "description": "<description>",
    "needs_db": true,
    "bucket": "<purpose-suffix>",
    "route": {
      "enabled": true,
      "visibility": "<internal|external>",
      "port": <port>
    }
  }')

echo $RESP
JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
curl -N "$BASE/api/jobs/$JOB/stream"
```

Wait for `{"done": true, "status": "success"}`.

**Capture from response:**
- `schema` → `poc_<name>` (note: hyphens become underscores)
- `bucket` → `poc-<name>-<purpose>`
- `route_url` → `https://<name>.poc.playsap.us`

---

## Step 3: Fetch Supabase Keys

```python
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.34', username='mrt', password='Poll0000')
_, stdout, _ = client.exec_command("grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' /opt/stacks/supabase/.env")
print(stdout.read().decode())
client.close()
```

---

## Step 4: Create POC Workspace Folder

```bash
POC_DIR="D:/Code/Claude/03_POC/<name>"
TEMPLATE="D:/Code/Claude/00_Frameworks/claude-workspace-<base|pro|pai>"

# Create POC folder
mkdir -p "$POC_DIR"

# Copy template (excluding git history and node_modules)
robocopy "$TEMPLATE" "$POC_DIR" /E /XD .git node_modules .next __pycache__ /XF .env
```

For Path B (imported repo): the code is already there — copy only the `.claude/` directory and
framework files from the template on top, without overwriting existing project files.

---

## Step 5: Write POC CLAUDE.md

Create `D:/Code/Claude/03_POC/<name>/CLAUDE.md` with:

```markdown
# <Name> POC

> **Template:** <base|pro|pai> | **Started:** <date>
> **Owner:** Mr. T — Onnex AI Agency

## What This POC Is

<One paragraph description of the POC — purpose, target user, core problem it solves.>

## Tech Stack

<List the framework, language, DB, key libraries from the design spec.>

## Infrastructure

| Resource | Value |
|----------|-------|
| Schema | `poc_<name>` |
| Storage bucket | `poc-<name>-<purpose>` |
| Public URL | `https://<name>.poc.playsap.us` |
| App port | `<port>` |
| poc-backend | `10.10.110.34` |

## DB Connection

App containers must join the `supabase_default` Docker network to reach Postgres directly:
- `DATABASE_URL=postgresql://supabase_admin:<pw>@supabase-db:5432/postgres`
- Add `supabase_default` as an external network in `docker-compose.yml`

## Your Role

You are a senior technical collaborator building this POC. Read the design spec in `context/`
before starting. Follow the post-build verification protocol before declaring any work done.
```

---

## Step 6: Write .env

Create `D:/Code/Claude/03_POC/<name>/.env`:

```env
# POC: <name>
# Schema: poc_<name> | Bucket: poc-<name>-<purpose>
# URL: https://<name>.poc.playsap.us

# Postgres — connect via supabase_default Docker network (not via Supavisor)
# From app container: supabase-db:5432
# From host/local: NOT directly accessible (Supavisor on 5432 requires tenant format)
DATABASE_URL=postgresql://supabase_admin:<POSTGRES_PASSWORD>@supabase-db:5432/postgres
DB_SCHEMA=poc_<schema_name>

# Supabase Storage
SUPABASE_URL=https://poc-nursery.poc.playsap.us
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
STORAGE_BUCKET=poc-<name>-<purpose>

# Redis (always available on poc-net)
REDIS_URL=redis://10.10.110.34:6379

# App
NEXT_PUBLIC_APP_URL=https://<name>.poc.playsap.us
PORT=<port>
NODE_ENV=production
```

> **Note on Postgres connectivity:**
> - App containers must be on `supabase_default` network to use `supabase-db:5432` (direct Postgres, bypasses Supavisor)
> - For running seeds/migrations **locally** against the remote DB, use a temporary Docker container on `supabase_default`:
>   `docker run --rm --network supabase_default -v /opt/pocs/<name>:/app -w /app -e DATABASE_URL=... node:20-alpine npx tsx scripts/seed.ts`
> - Do NOT use `10.10.110.34:5432` — that is Supavisor and will reject with "Tenant or user not found"

---

## Step 7: Copy Design Spec into Context

If the user provided a design spec (e.g. from Claude Chat), save it as:
```
D:/Code/Claude/03_POC/<name>/context/design-spec.md
```

This gives the new POC session immediate access to the full spec without needing to re-paste it.

---

## Step 8: Verify Provisioning

```python
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.34', username='mrt', password='Poll0000')

# Schema exists
_, stdout, _ = client.exec_command(
    "docker exec supabase-db psql -U supabase_admin -d postgres "
    "-c \"SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'poc_<name>';\"")
print(stdout.read().decode())
client.close()
```

---

## 🛑 Step 9: STOP — Hand Off to POC Workspace

**This is the end of the workspace-pro session's job.**

Tell the user:

```
Infrastructure is ready. POC workspace is set up at:
  D:\Code\Claude\03_POC\<name>\

To continue:
1. Open a new Claude Code session pointed at that directory:
   cd D:\Code\Claude\03_POC\<name>
   claude

2. The new session will load the POC's own CLAUDE.md, skills, and commands.

3. Start with /prime or /gsd:progress to orient the new session.

The new session handles: schema migrations, app development, Docker build, deployment, seeding, testing.
```

**Do NOT:**
- Write any application code in this session
- Run DB migrations
- Build or push Docker images
- Deploy to the server
- Seed the database

---

## Troubleshooting

### Provisioning API job failed
```bash
curl http://10.10.30.40:5000/api/jobs/<job_id> | python3 -m json.tool
```

### "Tenant or user not found" on Postgres connection
The app is connecting through Supavisor instead of direct Postgres.
Fix: join the `supabase_default` Docker network and use `supabase-db:5432` as the host.

### Port already allocated on docker compose up
Check what's on that port: `docker ps --format "{{.Names}} {{.Ports}}" | grep <port>`
Supabase Studio owns 3000. Pick a free port (3100+) and re-run `POST /api/v2/provision/app`
with the new port to update the Traefik route.

### Robocopy not available (non-Windows)
```bash
rsync -av --exclude='.git' --exclude='node_modules' --exclude='.next' \
  "$TEMPLATE/" "$POC_DIR/"
```

---

## Rules

- ALWAYS use `poc_<name>` schema naming — never tables in `public`
- Provisioning API handles schema/bucket/route/DNS — no manual SSH for those steps
- This command STOPS after Step 8 — development belongs in the POC workspace session
- The .env and CLAUDE.md written here are the complete handoff package for the new session
