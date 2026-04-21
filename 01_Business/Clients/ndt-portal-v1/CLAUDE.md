# NDT Portal v1 (ndtv1)

> **Type:** Client Product — Onnex Delivery
> **Vertical:** NDT / Aerospace Inspection
> **Phase:** Active development — pipeline + renderer
> **Stack:** Next.js 14, R3F/drei, FastAPI, Temporal, PostgreSQL/pgvector, Hasura, Anthropic SDK + Ollama

**Read `context/TELOS/` for full strategic context.**

---

## What This Is

ITAR-aware AI document processing platform for NDT companies. Three-service pipeline:
- **ndtv1-comply** — ITAR classification and compliance layer
- **ndtv1-sanitize** — document sanitization before LLM processing
- **ndtv1-gateway** — orchestration and API gateway

Universal two-stage LLM pipeline:
- **Stage 1** — classifies part type and extracts geometry primitives
- **Stage 2** — runs RT analysis using dynamically assembled code-specific system prompts

3D visualization via Three.js/R3F with overlay rendering, raycaster tooltips, 60 FPS at 500K triangle budget.

---

## Architecture

```
Email / Portal → n8n ingestion → ndtv1-gateway
  → ndtv1-comply (ITAR check)
  → ndtv1-sanitize (clean data)
  → Stage 1 LLM (part classification + geometry)
  → Stage 2 LLM (RT analysis, code-specific prompt)
  → Temporal (workflow orchestration)
  → PostgreSQL/pgvector (storage + similarity)
  → Hasura (GraphQL API)
  → Next.js frontend + R3F renderer
```

---

## Key Specs
- `files/ndtv1-complete-pipeline-spec.md` — full pipeline specification
- `files/ndtv1-preingestion-spec.md` — pre-ingestion processing spec
- Renderer Design Spec v1.0 — Three.js/R3F component tree, Zustand state, overlay rules

---

## 🏆 Golden Rules & Best Practices

**READ FIRST:** `GOLDEN_RULES.md` — Lessons learned from development history. Enforces error-free, efficient execution.

**Key principles:**
1. **Validate before you build** — Check existing state before writing code
2. **Environment & config first** — Audit all configuration files before implementation
3. **Package installation & build verification** — Every session starts with deps + build check
4. **Test exports before writing tests** — Verify imports work before writing test suites
5. **Server state first** — Check what's deployed before automating setup
6. **Gitignore-safe commits** — Never commit ignored files; document manually
7. **Network first, SSH later** — Use HTTP when possible, SSH only when needed
8. **Build → Test → Commit** — Pre-commit validation catches 95% of errors
9. **Test selector resilience** — Playwright selectors must be specific + handle errors
10. **Document at commit time** — Future developers need context in commit messages

**Pre-execution:** Use checklist in `GOLDEN_RULES.md` before starting significant work.

**Performance target:** 55 mins for similar tasks (vs. 105 mins without checklist).

---

## n8n Workflows
| Workflow | Purpose |
|----------|---------|
| WF-1 | Email → UT quote |
| WF-2 | Email → RT quote |
| WF-3 | Salesforce → UT quote |
| WF-4 | Unified classifier |
| WF-5 | Pipeline orchestrator |

---

## Key Constraints
- **ITAR compliance is non-negotiable** — no controlled data to cloud APIs without sanitization
- **60 FPS renderer budget** — 500K triangle max, instanced geometry for complex parts
- **LLM accuracy** — Stage 2 must use code-specific prompts, not generic prompting
- **Ollama fallback** — all LLM calls must have local fallback path
- Never hardcode API keys — env vars only
- Python for FastAPI services, TypeScript for Next.js

---

## Autonomous Deployment (MANDATORY)

Mr. T requires all build/deploy/push steps to be completed **autonomously without asking**. Never list `git push`, `docker build`, `npm run build`, or server deployment as "To-Do (MrT)" items. Execute them.

**Manual deploy path** (CI/CD runner has 503 issues as of 2026-04-21 — GitLab runner polls but gitlab.botonomy.xyz backend returns 503):
1. Build locally: `npx tsc --noEmit` (api) + `npm run build` (frontend)
2. Push to git: `git push origin master` (from `D:\Code\Claude\` root)
3. Copy changed files to server via base64 pipe (files owned by root — use `base64 -d | sudo tee`):
   ```bash
   cat local_file | base64 -w0 | ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
     "ssh mrt@10.10.110.32 'base64 -d | sudo tee /opt/ndt-portal/path/to/file > /dev/null'"
   ```
4. Rebuild API image: `sudo docker build -t ndt-api:latest ./api/`
5. Build frontend: `sudo npm run build` (in `/opt/ndt-portal/frontend/`) — reporter warning at end is benign, check dist mtime
6. Restart API: `sudo docker compose up -d api`

**Server paths:** `/opt/ndt-portal/` — files owned by root, all writes need `sudo tee` or `sudo base64 -d`.

---

## Post-Build Verification
1. Docker Compose stack starts clean
2. n8n email ingestion workflow receives test message and triggers pipeline
3. Stage 1 classifier returns correct part type and geometry
4. Stage 2 analysis returns structured findings
5. R3F renderer loads at 60 FPS with test geometry
6. Hasura GraphQL queries return correct data structure

---

## Available Hooks
Global hooks fire automatically (session-start, pre-tool-safety, session-end, auto-commit).
Local: cost-tracker, pre-compact.

---

## Deployment: Changes → Live

**Critical Path:** Local changes → `git commit` → `git push` → GitLab CI/CD → Server → Live

### GitLab Authentication (Primary: PAT via HTTPS)

**Method:** Personal Access Token (PAT) via HTTPS
- **Advantage:** Works everywhere (local, containers, remote, CI/CD, Ultraplan)
- **Advantage:** No key files needed
- **Remote URL:** `https://oauth2:<PAT>@gitlab.botonomy.xyz/mrt/ndt-portal-v1.git`

**Setup (one-time):**
```bash
# Store PAT in environment variable (never hardcode in repo)
export GITLAB_TOKEN="glpat-..."

# Configure git remote with PAT
git remote set-url origin "https://oauth2:${GITLAB_TOKEN}@gitlab.botonomy.xyz/mrt/ndt-portal-v1.git"

# Test authentication
git fetch origin main
# Should succeed without prompting for password
```

**For Ultraplan / Remote Execution:**
- PAT must be available as `GITLAB_TOKEN` environment variable in the remote environment
- Ultraplan should set up: `git config --global url."https://oauth2:${GITLAB_TOKEN}@gitlab.botonomy.xyz/".insteadOf "https://gitlab.botonomy.xyz/"`
- This way, all git operations automatically use the PAT

**Security:**
- Store PAT as environment variable, not in git history
- PAT expires: [set in GitLab settings]
- Revoke immediately if exposed
- Rotate every 90 days

### Phase 1: Local Development

1. **Make changes** in this directory (`D:\Code\Claude\01_Business\Clients\ndt-portal-v1\`)
2. **Verify build locally before pushing:**
   ```bash
   cd frontend && npm run build
   # Must complete without TypeScript errors
   ```
3. **Stage and commit:**
   ```bash
   git add <files>
   git commit -m "feat/fix: description"
   ```
4. **Push to GitLab:**
   ```bash
   git push origin main
   # → triggers CI/CD automatically
   ```

### Phase 2: Automated CI/CD Pipeline (`.gitlab-ci.yml`)

GitLab Runner on `ndtv1` (10.10.110.32) **auto-detects changes** and rebuilds only affected services:

```bash
CHANGED=$(git diff --name-only HEAD~1 HEAD)
# Evaluates what changed (api/, frontend/, pipeline/*, etc.)
```

**Per-component build:**
- `frontend/**` changed → builds frontend: `cd frontend && npm ci && npm run build` → outputs `./dist/`
- `api/**` changed → builds Docker image: `docker build -t ndt-api:latest ./api/`
- `pipeline/comply/**` changed → builds image: `docker build -t ndt-comply:latest ./pipeline/`
- (similar for sanitize, gateway)

**Deployment to server:**
```bash
sudo rsync -rlDt --delete ./dist/ /opt/ndt-portal/dist/
# Static assets to Nginx
sudo cp docker-compose.yml /opt/ndt-portal/docker-compose.yml
cd /opt/ndt-portal && docker compose up -d
# Pulls new images, restarts containers
```

### Phase 3: Monitor Pipeline

**Watch runner execution:**
```bash
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'journalctl -u gitlab-runner | grep \"job=NNN\"'"
# Shows build logs in real-time
```

**Verify deployment on server:**
```bash
ssh mrt@10.10.110.32 'stat /opt/ndt-portal/dist/index.html | grep Modify'
# Should show recent timestamp (job completion time)
```

### Phase 4: Verify in Browser

1. **Hard refresh** (Ctrl+Shift+R) to bypass cache
2. **Check Network tab** in DevTools to confirm new assets loaded
3. **Inspect localStorage** if Settings changes: `localStorage.getItem('ndt_integration_settings')`

---

## Common Failure Points & Fixes

| Symptom | Cause | Fix |
|---------|-------|-----|
| **`git push` hangs / "authentication failed"** | PAT expired or not set | `export GITLAB_TOKEN="glpat-..."` and re-configure remote |
| **Ultraplan can't push** | PAT not in Ultraplan environment | Ensure `GITLAB_TOKEN` env var is passed to Ultraplan container |
| **Job failed (exit 1)** | TypeScript compile error | Fix error locally, re-commit, re-push |
| **Job stuck / context canceled** | Runner restart mid-build | `sudo systemctl restart gitlab-runner`, trigger new build |
| **Frontend doesn't update** | Package lock mismatch | Sync `package-lock.json`, run `npm ci` on server |
| **Changes visible locally, not on server** | Not pushed to GitLab | Verify `git push origin main` succeeded with PAT |
| **Browser shows old UI after refresh** | Cache not cleared | Hard refresh (Ctrl+Shift+R), clear localStorage |
| **CI detects no changes** | Change outside detection pattern | Commit affects file outside monitored dirs; pipeline still runs but skips rebuild |

---

## Deployment Checklist

Before claiming "live":
- [ ] Local build passes: `cd frontend && npm run build` ✓
- [ ] Committed and pushed: `git push origin main` ✓
- [ ] GitLab job succeeded: `journalctl | grep "Job succeeded"` ✓
- [ ] Server dist updated: `stat /opt/ndt-portal/dist/index.html` shows recent time ✓
- [ ] Browser hard refresh shows changes ✓

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **ndt-portal-v1** (1925 symbols, 3578 relationships, 74 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/ndt-portal-v1/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/ndt-portal-v1/context` | Codebase overview, check index freshness |
| `gitnexus://repo/ndt-portal-v1/clusters` | All functional areas |
| `gitnexus://repo/ndt-portal-v1/processes` | All execution flows |
| `gitnexus://repo/ndt-portal-v1/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
