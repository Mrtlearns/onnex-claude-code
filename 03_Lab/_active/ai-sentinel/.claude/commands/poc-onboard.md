---
name: poc-onboard
description: >
  Onboard a new proof-of-concept application onto poc-backend. Provisions infrastructure
  (DB schema, storage bucket, Traefik route, Pi-hole DNS) via the provisioning API.
  THIS COMMAND DOES NOT BUILD OR DEPLOY CODE. Building happens in the POC workspace.
  Triggers on: "new poc", "onboard poc", "set up poc", "create poc", "scaffold poc".
---

# POC Onboard

## ⚠️ Session Boundary

This command provisions infrastructure and prepares the POC workspace. It does NOT write
application code, run migrations, build Docker images, or deploy anything.

---

## Provisioning API

| Network | Base URL |
|---------|----------|
| LAN (VLAN 30) | `http://10.10.30.40:5000` |
| Tailscale | `http://100.111.233.126:5000` |

---

## Platform Reference

- **poc-backend**: `10.10.110.34` — Ubuntu Noble, Docker, 8c/24GB/120GB
- **Supabase API**: `https://poc-nursery.poc.playsap.us`
- **Wildcard cert**: `*.poc.playsap.us` on traefik-a (`10.10.30.35`)

## Naming Conventions

| Resource | Pattern | Example |
|----------|---------|---------|
| Postgres schema | `poc_<n>` (underscores) | `poc_ndt_demo` |
| Storage bucket | `poc-<n>-<purpose>` | `poc-ndt-demo-uploads` |
| Public hostname | `<n>.poc.playsap.us` | `ndt-demo.poc.playsap.us` |

---

## Step 1: Gather Info

- **POC name** — lowercase, hyphens ok
- **One-line description**
- **Storage bucket?** — yes/no + purpose suffix
- **Public hostname?** — yes/no → internal or external
- **App port** — if hostname wanted

---

## Step 2: Provision via API

```bash
BASE=http://10.10.30.40:5000

RESP=$(curl -s -X POST $BASE/api/v2/provision/app \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "<n>",
    "description": "<description>",
    "needs_db": true,
    "bucket": "<purpose-suffix>",
    "route": {
      "enabled": true,
      "visibility": "<internal|external>",
      "port": <port>
    }
  }')

JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
curl -N "$BASE/api/jobs/$JOB/stream"
```

Wait for `{"done": true, "status": "success"}`.

---

## Step 3: Create POC Workspace Folder

```bash
POC_DIR="D:/Code/Claude/03_POC/<n>"
TEMPLATE="D:/Code/Claude/00_Frameworks/claude-workspace-pro"
mkdir -p "$POC_DIR"
robocopy "$TEMPLATE" "$POC_DIR" /E /XD .git node_modules .next /XF .env
```

---

## Step 4: Write CLAUDE.md and .env

Write `D:/Code/Claude/03_POC/<n>/CLAUDE.md` with infrastructure details, stack, and DB connection info.

Write `D:/Code/Claude/03_POC/<n>/.env` with DATABASE_URL, SUPABASE keys, REDIS_URL, and app config.

**DB Connection note:** App containers must join `supabase_default` Docker network and use `supabase-db:5432` directly. Never use `10.10.110.34:5432` (Supavisor).

---

## 🛑 Step 5: STOP — Hand Off

Tell the user:
```
Infrastructure is ready. POC workspace at: D:\Code\Claude\03_POC\<n>\

To continue:
  cd D:\Code\Claude\03_POC\<n>
  claude

Start with /prime or /gsd:progress.
```

Do NOT write application code, run migrations, build Docker images, or deploy in this session.
