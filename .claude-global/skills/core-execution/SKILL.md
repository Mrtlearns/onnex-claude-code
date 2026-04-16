# Core Execution Standards — Onnex AI Agency

**Scope:** All projects, all stacks, all sessions.
**Purpose:** Prevent the most common and most expensive development mistakes.
**Origin:** Distilled from real execution failures across client delivery projects.

---

## The Five-Phase Start Protocol

Before ANY significant implementation, run these phases in order. Each phase catches a class of failure before it becomes expensive.

**Phase 1 — Environment (5 mins)**
```
[ ] Dependencies installed (npm install / pip install / go mod tidy)
[ ] Build passes cleanly before touching code
[ ] Test runner is available and configured
[ ] Working directory confirmed correct
```
If Phase 1 fails: stop, fix environment, restart. Do not write code on a broken build.

**Phase 2 — Configuration (10 mins)**
```
[ ] All config files read: env files, build config, test config, service config, routing config
[ ] All URLs, ports, IDs cross-checked for consistency across files
[ ] No hardcoded IPs, credentials, or environment-specific paths in code
[ ] Gitignored files identified before assuming they can be committed
```
Most bugs across all stacks are config mismatches, not code bugs.

**Phase 3 — Existing State (5 mins)**
```
[ ] Read existing code before writing new code
[ ] Identify reusable utilities, patterns, and components
[ ] Verify all symbols your tests need to import are actually exported
[ ] Check what the build tool expects (module format, target, etc.)
```

**Phase 4 — Deployed/Remote State (5 mins, when applicable)**
```
[ ] Check what is already running before writing setup automation
[ ] Try the simplest access method first (HTTP/API before SSH)
[ ] Identify what is missing vs. what already exists
[ ] Write verification tests for what exists, creation code only for what doesn't
```

**Phase 5 — Plan Alignment (5 mins)**
```
[ ] Plan still makes sense given Phases 1–4 findings
[ ] Gotchas and blockers identified upfront
[ ] Manual steps noted (things that cannot be automated)
[ ] Scope of change is clear and bounded
```

Total: 30 minutes of validation → eliminates ~80% of common failures.

---

## The Commit Gate

**Only commit code that satisfies all three:**

```
1. Build passes (compile / lint / type-check)
2. Tests pass (unit + integration, whatever applies)
3. Build passes again (tests didn't break it)
→ git commit
```

Never commit and hope CI catches errors. Pre-commit validation is 10x cheaper than a broken pipeline.

**Commit message must contain:**
- **What** changed (the diff tells you this, keep it brief)
- **Why** it changed (the reason — this is what gets lost)
- **Manual steps** if any human action is required after the commit
- **Gotchas** if the implementation has non-obvious constraints

---

## Access Hierarchy

When a task requires accessing a running service or server, work from simplest to most complex:

```
1. HTTP/API call (curl, fetch, Playwright)   — no auth setup, fastest
2. CLI tool against remote API               — lightweight, reproducible
3. SSH to target machine                     — only when 1 and 2 won't work
4. Direct database access                    — only for state you can't read via API
```

Never open SSH to check something you can read via HTTP. Never shell into a container to check something the service API exposes.

**Test connectivity before assuming access is broken:**
```bash
curl -sf <service-url>/health && echo "reachable" || echo "unreachable"
```

---

## SSH Infrastructure

All Onnex homelab servers are reached via a two-hop jump through claude-controller:

```bash
# Step 1 — Local → claude-controller (jump host)
ssh mrt@100.111.233.126 -i C:\Users\mrtma\.ssh\MrT_Personal_Key_ed25519

# Step 2 — claude-controller → target server
ssh mrt@<target-ip> -i /opt/claude-workspace/keys/claude-controller-key

# Run a command on a target from local (single-line):
ssh -i C:\Users\mrtma\.ssh\MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@<target-ip> -i /opt/claude-workspace/keys/claude-controller-key '<command>'"
```

- Jump host: `mrt@100.111.233.126` (Tailscale), local key: `C:\Users\mrtma\.ssh\MrT_Personal_Key_ed25519`
- Target user: `mrt`, key on controller: `/opt/claude-workspace/keys/claude-controller-key`
- Target IP varies — check the project CLAUDE.md or memory for the server address

---

## Autonomous Task Completion

Execute all post-implementation steps without asking unless blocked by an approval gate.

**Approval gates — stop and ask MrT before proceeding:**
- Irreversible destructive operations: DROP TABLE, rm -rf, delete branches, wipe volumes
- External spend or provisioning: cloud resources, paid API keys, domain changes
- Business-logic decisions: choosing between approaches with product/UX implications

**No approval needed — execute autonomously:**
- Creating test users in any system (Authentik, DB, admin UIs)
- Running unit, integration, and E2E Playwright tests
- Installing packages and dependencies
- Restarting Docker services after config changes
- Configuring services with known values
- Building and deploying frontend
- Making HTTP/API calls to verify state

**Standard test credentials:** `D:\Code\Claude\.claude-global\context\default-credentials.md`
Read this file when any setup step needs a user account, admin login, or test identity.

---

## Test Authoring Rules

**Before writing any test:**
- Verify every symbol the test imports actually exists and is exported
- Verify the test framework's module system matches your import style (ESM vs CJS)
- Verify the test environment (jsdom, node, etc.) matches the code being tested

**Selector resilience (UI/E2E tests):**
- Use the simplest selector that uniquely identifies the element
- One selector per locator — no comma-separated CSS chains as OR logic
- Wrap visibility checks in try/catch when element absence is not a failure
- Prefer `getByRole`, `getByTestId`, `getByText` over CSS class selectors

**Test structure:**
- Tests must be runnable in isolation — no hidden ordering dependencies
- Mock only at the boundary your code owns (don't mock the code you're testing)
- If a test needs a symbol from the module under test, that symbol must be exported

---

## Configuration Management

**Gitignored files (typically .env, .env.local, secrets):**
- Never try to commit them — run `git check-ignore <file>` first if unsure
- If a config change is required, document it in: commit message + a tracked .md file
- Template files (.env.example) should be committed and kept in sync

**Cross-service configuration:**
- Any URL that appears in more than one file is a potential mismatch bug
- When a URL changes, grep for all occurrences before declaring it fixed
- Routing rules (reverse proxy, path prefixes) must be checked for conflicts when adding new routes

**Environment variables:**
- Each service owns its own env vars — don't assume another service's vars are accessible
- Env vars injected at build time vs. runtime behave differently — know which applies
- Placeholder values must be visibly marked (e.g., `=PLACEHOLDER-SET-AFTER-SETUP`)

---

## Decision Trees

**"Should I automate this or do it manually?"**
```
Will it need to run again (different environment, new team member, CI)?
├─ Yes → Automate
└─ No → Do manually, document in a tracked file

Is the target already in the desired state?
├─ Yes → Write a verification test, not setup code
└─ No → Write setup code + verification test
```

**"Should I use SSH or API access?"**
```
Can the information be obtained via HTTP/API?
├─ Yes → Use HTTP/API
└─ No → Use SSH

Is the operation a system-level command (systemctl, docker, file permissions)?
├─ Yes → SSH required
└─ No → API probably sufficient
```

**"Is this ready to commit?"**
```
Does the build pass? → No: fix code
Do tests pass?      → No: fix tests or code
Build still passes? → No: fix tests
Any gitignored changes? → Yes: document in commit message + tracked .md
Commit message has Why + Manual steps? → No: add them
→ All yes: commit ✅
```

---

## What This Skill Does NOT Cover

Things that are intentionally kept in project-level CLAUDE.md or component gotcha docs:

- Stack-specific build commands (npm vs pip vs gradle vs cargo)
- Service-specific configuration keys (Authentik, Hasura, n8n, etc.)
- Project-specific server addresses or infrastructure paths
- Component-level gotchas (React context exports, Traefik priority quirks, etc.)

Those belong in the project's own GOLDEN_RULES.md or CLAUDE.md. This skill contains only the principles that hold regardless of stack, language, or project.

---

## Evolution

When a new failure pattern is found in any project:
1. Fix it in the project
2. Assess: is this a universal principle or project-specific?
3. Universal → add to this skill
4. Project-specific → add to that project's GOLDEN_RULES.md
5. Both? → abstract the principle here, keep specifics in the project

This skill should stay lean. If it grows beyond ~150 lines of content it is probably absorbing project-specific detail. Move that back to the project.
