# /new-project

Initialize a new project with the correct folder, template, and infrastructure.
Run from anywhere — the command determines the correct destination and provisions what is needed.

---

## Infrastructure Reference (read before starting)

### claude-controller — the orchestration hub

| Network | Address |
|---------|---------|
| LAN (VLAN 30) | `10.10.30.40` |
| Tailscale | `100.111.233.126` |

claude-controller decides all infrastructure routing:
- App request → provisions on **poc-backend** (`10.10.110.34`, 8c/24GB, Docker)
- Server request → clones a new Ubuntu VM from CloudInit template, returns IP + credentials

**Provisioning API** (no auth required — trust the network):
- `POST /api/v2/provision/app` — Postgres schema, storage bucket, Traefik route, Pi-hole DNS on poc-backend
- `POST /api/v2/provision/server` — clone new VM, provision with docker-compose/script/packages
- `GET /api/jobs/<job_id>/stream` — SSE stream for job progress

**To open a Claude Code session ON claude-controller** (for complex infra work):
```
ssh mrt@100.111.233.126
cd ~/workspaces/<project>
claude
```
claude-controller has: Ansible, SSH keypairs for lateral VM movement, direct LAN access to all homelab services, provisioning API at localhost:5000.

### poc-backend — the app platform

| Resource | Value |
|----------|-------|
| IP | `10.10.110.34` |
| Postgres (inside Docker) | `supabase-db:5432` on `supabase_default` network |
| Redis | `redis://10.10.110.34:6379` |
| Wildcard cert | `*.poc.playsap.us` on traefik-a — no cert setup needed |
| Supabase API | `https://poc-nursery.poc.playsap.us` |

### Infra routing decision

| Condition | Path |
|-----------|------|
| Needs Postgres + pgvector + Redis + storage | App path → poc-backend |
| Needs custom DB, new runtime, isolated networking | VM path → new server |
| Needs both | VM first, then app if also needed |
| No backend needed | Skip infra |

---

## Stage 1: Project Type + Source

**Use AskUserQuestion with 2 questions:**

- **Q1 header: "Project type"** — What kind of project is this?
  - `Client delivery` — Work for a specific paying or prospective client
  - `Onnex internal` — Building an Onnex product or internal tool
  - `Lab / experiment` — POC, untested idea, new framework to try
  - `Personal` — Personal productivity, management, or learning

- **Q2 header: "Source"** — Starting point for this project?
  - `New project` — Create from template (claude-workspace-pro or base)
  - `Import existing repo` — Clone from GitHub/GitLab/Lovable and layer framework on top

If context already makes type and source obvious (e.g. user said "lab project from GitHub"), skip this call and proceed directly.

---

## Stage 1b: Import Flow (only if Source = "Import existing repo")

1. Ask user for the repo URL in text: "What is the repo URL?"
2. Determine destination from type (Stage 2 below), then:
   ```bash
   git clone <url> <DEST>
   ```
3. **Skip Stage 6a and 6b** — the repo is already the base, do not run mkdir or robocopy
4. If the cloned repo has its own CLAUDE.md: **merge** — prepend the Onnex pro wrapper header (filled-in), preserve existing technical content below a `---` separator
5. Continue from Stage 6c (replace placeholders, settings.json, TELOS)
6. Commit with message: `chore: layer claude-workspace-<template> framework onto <project-name>`
7. Continue with Stage 7 (infra) as normal

---

## Stage 2: Determine Destination + Type-Specific Detail

**Destination by type (no question needed for Lab/Personal):**

| Type | Destination |
|------|-------------|
| Client | `D:\Code\Claude\01_Business\Clients\<project-name>\` |
| Onnex internal | `D:\Code\Claude\01_Business\Onnex\<product-name>\` |
| Lab | `D:\Code\Claude\03_Lab\_active\<project-name>\` |
| Personal | `D:\Code\Claude\02_Personal\<project-name>\` |

**Use AskUserQuestion only when type requires a sub-choice:**

- **If Client** → Q header "Vertical" — NDT / PI Law / MSP / Medical / Other
- **If Onnex** → Q header "Product area" — agency-os / atomic-ai-bp / new product / Other
- **If Lab or Personal** → Skip this call (destination is already fixed)

Remind for Lab: "Promote to 01_Business/ when proven, archive when abandoned."

---

## Stage 3: Project Details + TELOS Input

**Use AskUserQuestion with up to 6 questions:**

- **Q1 header: "Description"** — One-line description of what this project builds. Offer smart presets based on type + Other:
  - *(Client)* `Vertical SaaS / client delivery tool` — AI-assisted OS for a specific client vertical
  - *(Lab)* `Pipeline / RAG / AI experiment` — Exploring a new pattern, framework, or technique
  - *(Onnex)* `Internal Onnex platform module` — Adds capability to the Onnex AI-OS platform
  - `Other` — User types custom description

- **Q2 header: "Template"** — Which framework template?
  - `pro` — Full: TELOS + Agents + Hooks + GSD + 15 commands (Recommended for Client / Onnex)
  - `base` — Lightweight: hooks + skills only, no agents (Recommended for Lab / Personal)
  - `blank` — CLAUDE.md only, minimal setup

- **Q3 header: "GitLab"** — Mirror to gitlab.botonomy.xyz?
  - `Yes — create + push` — Create private repo and push via API + SSH
  - `No — skip` — GitHub or local only

**If template = `pro` (TELOS input required), ask 3 more questions:**

- **Q4 header: "Goal"** — Strategic goal for this project (e.g., "Automate NDT report generation", "Build AI-native PI intake system")
  - Free text — capture the core business outcome

- **Q5 header: "Business Model"** — How does this project generate/create value? (e.g., "Time savings via automation", "New revenue stream", "Internal efficiency", "Client deliverable")
  - Free text — capture the value proposition

- **Q6 header: "Timeline"** — Target completion or milestone date? (e.g., "Q2 2026", "90 days", "MVP by April", "Ongoing")
  - Free text — capture the time horizon

**If template = `base` or `blank`: skip Q4-Q6** (TELOS will not be populated)

After this call, if project name was not provided in the original request, ask for it in text:
> "What should the project be named? (kebab-case, e.g. `my-project-name`)"
Validate: lowercase letters, numbers, hyphens only. Check destination does not already exist.

---

## Stage 4: Infrastructure

### Stage 4a — Infrastructure type

**Use AskUserQuestion with 1 question:**

- **Q header: "Infrastructure"** — Does this project need backend infrastructure?
  - `None — local dev only` — No provisioning needed
  - `App on poc-backend` — Postgres/pgvector + Redis + Traefik route + Pi-hole DNS
  - `Dedicated VM` — Own Ubuntu server (isolated networking, custom runtime)
  - `Not sure` — Show the routing decision table, then loop back

If "Not sure" selected: output the routing table from the reference section above, then call AskUserQuestion again with just the 3 clear options (no "Not sure").

### Stage 4b — App details (only if App on poc-backend chosen)

**Use AskUserQuestion with 3 questions:**

- **Q1 header: "Storage bucket"** — Does the app need object storage?
  - `Yes — for docs` — Documents, PDFs, reports
  - `Yes — for uploads` — User-uploaded files (images, attachments)
  - `Yes — for assets` — Static assets, exports
  - `No bucket` — No storage needed

- **Q2 header: "Visibility"** — Who can reach this app?
  - `Internal` — Pi-hole DNS only (*.poc.playsap.us, homelab access)
  - `External` — Public DNS + wildcard cert (accessible outside homelab)

- **Q3 header: "App port"** — Which port will the container serve on?
  - `3100` — Standard first POC slot
  - `3200` — Second slot
  - `8080` — Common for Vite/React dev servers
  - `Other` — User types custom (avoid 3000 — Supabase Studio, 5432/6543 — Postgres)

### Stage 4c — VM details (only if Dedicated VM chosen)

Ask in text (too many free-text fields for AskUserQuestion):
- VM name (kebab-case, becomes hostname)
- CPU cores (default: 2), RAM MB (default: 4096), Disk (default: 20G)
- Provisioning method: Docker Compose / bash script / package list / bare clone
- Public hostname? subdomain, port, visibility

---

## Stage 5: Confirm Before Creating

Output this summary block and ask `Proceed? (y/n)`:

```
About to create:
  Local path:     D:\Code\Claude\<destination>\<project-name>\
  Type:           <Client / Onnex Internal / Lab / Personal>
  Template:       <pro / base / blank>
  Description:    <description>
  Git:            <yes / no>
  GitLab:         <yes / no>
  Infrastructure: <None | App on poc-backend | Dedicated VM>
    [App]  Schema: poc_<n> | Bucket: poc-<n>-<purpose> | URL: https://<n>.poc.playsap.us
    [VM]   Name: <n> | Specs: <cpu>c/<ram>MB | Hostname: <n>

Proceed? (y/n)
```

---

## Stage 6: Create Local Project

### 6a: Create directory
```bash
DEST="D:/Code/Claude/<destination>/<project-name>"
mkdir -p "$DEST"
```

### 6b: Copy template (pro or base)
```powershell
robocopy "D:/Code/Claude/00_Frameworks/claude-workspace-<pro|base>" "$DEST" /E `
  /XD ".git" "node_modules" ".next" "dist" "target" "__pycache__" ".venv" `
      ".claude/state" "outputs" "scripts" ".cp-images" `
  /XF ".env" "*.log" "mcp-shell.log"
mkdir -p "$DEST/outputs" "$DEST/scripts" "$DEST/.claude/state/sessions"
```
For `blank`: create minimal dirs + minimal CLAUDE.md only.
**Skip 6a and 6b if import path (Stage 1b) — repo is already the base.**

### 6c: Replace CLAUDE.md placeholders
```powershell
$c = Get-Content "$DEST/CLAUDE.md" -Raw
$c = $c -replace "{{PROJECT_NAME}}", $projectName
$c = $c -replace "{{VERTICAL}}", $vertical
$c = $c -replace "{{START_DATE}}", (Get-Date -Format yyyy-MM-dd)
$c = $c -replace "{{PROJECT_DESCRIPTION}}", $description
$c | Out-File "$DEST/CLAUDE.md" -Encoding UTF8 -NoNewline
```

### 6d: Set up .claude hooks
For `blank`: copy cost-tracker.py + pre-compact.py from pro template.

Write `.claude/settings.json` — ONLY PostToolUse + PreCompact:
```json
{
  "hooks": {
    "PostToolUse": [{"matcher":"","hooks":[{"type":"command","command":"python \".claude/hooks/cost-tracker.py\""}]}],
    "PreCompact":  [{"matcher":"","hooks":[{"type":"command","command":"python \".claude/hooks/pre-compact.py\""}]}]
  }
}
```
**Do NOT add SessionStart, PreToolUse, or Stop — those are global and will double-fire.**

### 6e: Populate TELOS placeholders (pro template only)

**Skip if template = `base` or `blank`**

Replace core TELOS placeholders in `context/TELOS/*.md` files with gathered project data. Detailed placeholder entries (e.g. `{{GOAL_1_TITLE}}`, `{{CHALLENGE_1}}`) are left for the user to refine on first session.

Use PowerShell:

```powershell
$telosFiles = @("MISSION.md", "GOALS.md", "PROJECTS.md", "STRATEGIES.md", "CHALLENGES.md", "NARRATIVES.md", "BELIEFS.md", "CLIENTS.md")
$telosPath = "$DEST/context/TELOS"
$today = (Get-Date -Format "yyyy-MM-dd")

# Core placeholders to replace globally across TELOS + strategy.md + .gitlab-ci.yml
$replacements = @{
  "{{PROJECT_NAME}}" = $projectName
  "{{VERTICAL}}" = $vertical
  "{{START_DATE}}" = $today
  "{{PROJECT_DESCRIPTION}}" = $description
  "{{STATUS}}" = "Not started — framework initialized"
  "{{CLIENT_OR_VERTICAL}}" = $vertical
  "{{GOAL}}" = $telosGoal
  "{{BUSINESS_MODEL}}" = $businessModel
  "{{TIMELINE}}" = $timeline
  "{{ACTION_1}}" = "[ ] Complete Phase 1 planning"
  "{{ACTION_2}}" = "[ ] Set up infrastructure"
  "{{YOUR_PERSONAL_MISSION}}" = "To deliver exceptional value through this project"
  "{{PRIMARY_GOAL}}" = $telosGoal
  "{{PRIMARY_CHALLENGE}}" = "TBD — fill in context/TELOS/CHALLENGES.md"
  "{{CI_RUNNER_TAG}}" = $projectName
  "{{DEPLOYMENT_PATH}}" = "/opt/$projectName"
  "{{PRODUCTION_URL}}" = "$projectName.on-nex.us"
}

foreach ($file in $telosFiles) {
  $filePath = "$telosPath/$file"
  if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw
    foreach ($key in $replacements.Keys) {
      $content = $content -replace [regex]::Escape($key), $replacements[$key]
    }
    $content | Out-File $filePath -Encoding UTF8 -NoNewline
    Write-Host "[OK] $file"
  }
}

# Also update context/strategy.md, context/current-data.md, and .gitlab-ci.yml
@("strategy.md", "current-data.md") | ForEach-Object {
  $filePath = "$DEST/context/$_"
  if (Test-Path $filePath) {
    $content = Get-Content $filePath -Raw
    foreach ($key in $replacements.Keys) {
      $content = $content -replace [regex]::Escape($key), $replacements[$key]
    }
    $content | Out-File $filePath -Encoding UTF8 -NoNewline
    Write-Host "[OK] $_"
  }
}

# Replace placeholders in .gitlab-ci.yml
$ciPath = "$DEST/.gitlab-ci.yml"
if (Test-Path $ciPath) {
  $content = Get-Content $ciPath -Raw
  foreach ($key in $replacements.Keys) {
    $content = $content -replace [regex]::Escape($key), $replacements[$key]
  }
  $content | Out-File $ciPath -Encoding UTF8 -NoNewline
  Write-Host "[OK] .gitlab-ci.yml"
}

Write-Host ""
Write-Host "TELOS core placeholders populated. Detailed sections (goals, challenges, etc.)"
Write-Host "should be refined on first session: /prime -> review context/TELOS/ -> edit as needed"
```

### 6f: Initialize git
```bash
cd "$DEST" && git init && git add . && git commit -m "init: <project-name> from <template> template"
```
Skip if import path — repo already has git history. Just `git add .` and commit the framework layer.

If GitHub remote exists (import path or user provided a GitHub URL), add it as origin before Stage 6g:
```bash
git remote add origin <github-url>
```

### 6g: Create GitLab repo (if requested)

**First check if `$GITLAB_TOKEN` is set:**
```bash
if [ -z "$GITLAB_TOKEN" ]; then
  # Token not found — add remote only, instruct user
  git remote add gitlab "ssh://git@gitlab.botonomy.xyz:2222/mrt/<project-name>.git"
  echo "GitLab token not found. Remote added."
  echo "To complete: create the project at https://gitlab.botonomy.xyz/mrt/<project-name>"
  echo "Then run: git push -u gitlab main"
  # Continue — do not block
else
  curl -s -X POST "https://gitlab.botonomy.xyz/api/v4/projects" \
    -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name":"<project-name>","visibility":"private","initialize_with_readme":false}'
  # Add GitLab as a dedicated remote (for explicit pulls/fetch)
  git remote add gitlab "ssh://git@gitlab.botonomy.xyz:2222/mrt/<project-name>.git"
  # Configure origin to push to BOTH GitHub and GitLab simultaneously
  git remote set-url --add --push origin <github-or-existing-origin-url>
  git remote set-url --add --push origin "ssh://git@gitlab.botonomy.xyz:2222/mrt/<project-name>.git"
  # Single push to origin now syncs both
  git push -u origin main
fi
```

---

## Stage 7: Provision Infrastructure (if requested)

### App path — provision on poc-backend

```bash
BASE=http://10.10.30.40:5000   # LAN
# BASE=http://100.111.233.126:5000  # Tailscale (remote)

RESP=$(curl -s -X POST $BASE/api/v2/provision/app \
  -H 'Content-Type: application/json' \
  -d '{"name":"<project-name>","description":"<description>","needs_db":true,"bucket":"<purpose-suffix>","route":{"enabled":true,"visibility":"<internal|external>","port":<port>}}')
JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
curl -N "$BASE/api/jobs/$JOB/stream"
# Wait for: {"done": true, "status": "success"}
```

Capture: `schema` (poc_<n>), `bucket` (poc-<n>-<purpose>), `route_url`.

**Fetch Supabase keys:**
```python
import paramiko
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('10.10.110.34', username='mrt', password='Poll0000')
_, out, _ = c.exec_command("grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' /opt/stacks/supabase/.env")
print(out.read().decode('utf-8', errors='replace')); c.close()
```

**Write `.env`:**
```env
DATABASE_URL=postgresql://supabase_admin:<POSTGRES_PASSWORD>@supabase-db:5432/postgres
DB_SCHEMA=poc_<schema_name>
SUPABASE_URL=https://poc-nursery.poc.playsap.us
SUPABASE_ANON_KEY=<ANON_KEY>
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
STORAGE_BUCKET=poc-<n>-<purpose>
REDIS_URL=redis://10.10.110.34:6379
NEXT_PUBLIC_APP_URL=https://<n>.poc.playsap.us
PORT=<port>
```
App containers MUST join `supabase_default` Docker network to use `supabase-db:5432`.
Do NOT use `10.10.110.34:5432` — that is Supavisor and rejects with "Tenant or user not found".

**Verify schema exists:**
```python
_, out, _ = c.exec_command(
    "docker exec supabase-db psql -U supabase_admin -d postgres "
    "-c \"SELECT schema_name FROM information_schema.schemata WHERE schema_name='poc_<n>';\"")
print(out.read().decode('utf-8', errors='replace'))
```

---

### VM path — provision new server

```bash
BASE=http://10.10.30.40:5000
RESP=$(curl -s -X POST $BASE/api/v2/provision/server \
  -H "Content-Type: application/json" \
  -d '{
    "name": "<vm-name>",
    "description": "<description>",
    "cpu": <cores>, "memory": <mb>, "disk": "<size>G",
    "provision": {"method": "<docker-compose|script|packages|bare>", "content": "<content>"},
    "route": {"enabled": <true|false>, "port": <port>, "subdomain": "<n>", "visibility": "<internal|external>"}
  }')
JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
curl -N "$BASE/api/jobs/$JOB/stream"
# VM IP and SSH credentials are emitted in the job output stream
```

---

## Stage 8: Session Boundary + Final Report

This command is complete. Open a NEW Claude Code session at the project path for all development work.

```
Project created successfully.

  Path:    D:\Code\Claude\<destination>\<project-name>\
  Template: <pro|base|blank>
  Git:     initialized [+ pushed to gitlab.botonomy.xyz]

[If App infra:]
  Schema:  poc_<n>
  Bucket:  poc-<n>-<purpose>
  URL:     https://<n>.poc.playsap.us

[If VM infra:]
  VM IP:   <ip>
  SSH:     ssh mrt@<ip>

To start building:
  cd D:\Code\Claude\<destination>\<project-name>
  claude

First steps in your new session:
  1. /prime                   orient Claude to the workspace (includes TELOS summary)
  2. Review context/TELOS/    core values are pre-populated; refine goals, challenges, narratives
  3. /gsd:discuss-phase 1     plan first phase [pro template only]
```

Do NOT in this session: write app code, run DB migrations, build Docker images, deploy, seed data.

---

## Reference: Infra Naming (poc-backend)

| Resource | Pattern | Example |
|----------|---------|---------|
| Postgres schema | `poc_<n>` (underscores) | `poc_msp_portal` |
| Storage bucket | `poc-<n>-<purpose>` | `poc-msp-portal-uploads` |
| Redis prefix | `<n>:` | `msp-portal:jobs:` |
| Public hostname | `<n>.poc.playsap.us` | `msp-portal.poc.playsap.us` |

No cross-project foreign keys. No tables in `public` schema. No shared bucket names.

## Reference: Templates

| Template | Commands | Agents | Hooks | Skills | TELOS |
|----------|---------|--------|-------|--------|-------|
| `pro` | 15+ | 7 | cost-tracker + pre-compact | 5 | Full Onnex scaffold |
| `base` | 5 | none | cost-tracker + pre-compact | 2 | Full Onnex scaffold |
| `blank` | none | none | cost-tracker + pre-compact | none | none |

## Notes

- Global hooks fire automatically — do not re-register locally (causes double-firing)
- Full workspace docs: `D:\Code\Claude\.claude-global\WORKSPACE.md`
- Provisioning API docs: `D:\Code\Claude\.claude-global\memory\reference_provisioning_api.md`
- AskUserQuestion tool requires 2–4 options per question; Claude will always add "Other" automatically for free-text input
