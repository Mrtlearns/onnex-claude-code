# Onnex AI Workspace — Structure, Rules, and Justification

> **Location:** `D:\Code\Claude\`
> **Junction:** `C:\Users\mrtma\.claude` → `D:\Code\Claude\.claude-global`
> **Owner:** Mr. T — Onnex AI Agency

---

## Why This Structure Exists

Every Claude Code session needs: who is working, what project this is, what tools are available, what the rules are. This workspace provides that context systematically instead of re-explaining it every session.

The structure separates **global config** from **project work** so that:
- Changing a global skill or hook improves every project simultaneously
- Each project stays focused on its own scope
- Moving between projects gives Claude Code full context without copy-pasting

---

## The Junction

```
C:\Users\mrtma\.claude  →  D:\Code\Claude\.claude-global  (Windows Junction)
```

Every tool that reads `~/.claude` (Claude Code CLI, VSCode, Codex, Antigravity) transparently gets `.claude-global`. This is the mechanism that gives ALL tools a consistent identity.

**Do not delete `C:\Users\mrtma\.claude` — it is the junction, not a real folder.**
**Do not set `CLAUDE_CONFIG_DIR` — the junction makes it unnecessary.**

---

## Layer Map

```
D:\Code\Claude\
├── .claude-global\          ← Layer 1: Global config (single source of truth)
├── 00_Frameworks\           ← Layer 2: Reusable templates (blueprints, not projects)
├── 01_Business\             ← Layer 3: Real work (client delivery + Onnex internal)
├── 02_Personal\             ← Layer 4: Personal projects and management
└── 03_Lab\                  ← Layer 4: Experimentation with explicit lifecycle
```

---

## Layer 1: `.claude-global` — Global Config

**What it is:** Everything that applies to every Claude Code session regardless of project.

| Path | Purpose |
|------|---------|
| `CLAUDE.md` | Global identity — injected into every session automatically |
| `settings.json` | Permissions, model, env vars, hook registrations, statusline |
| `statusline.sh` | Status bar shown in every session |
| `hooks/` | Global lifecycle hooks — fire on every project |
| `skills/` | Domain knowledge loaded into every session |
| `commands/` | Global slash commands available everywhere |
| `context/` | Persistent context: business-info.md, personal-info.md |
| `memory/` | Persistent memory: MEMORY.md + reference files |
| `WORKSPACE.md` | This file — authoritative workspace documentation |
| `BACKLOG.md` | **Cross-project to-do list** — deferred tasks, infrastructure items, research follow-ups |

**Skills — Two Tiers:**

| Prefix | When Used | Current Skills |
|--------|----------|----------------|
| `core-*` | Always — cross-project | `core-docker`, `core-n8n`, `core-security` |
| `onnex-*` | Domain expertise | `onnex-sap`, `onnex-ndt`, `onnex-pi-law` |

Core = platform knowledge (always relevant). Onnex = vertical domain expertise.

**Global Hooks (fire on every project):**

| Hook | Trigger | Action |
|------|---------|--------|
| `session-start.py` | Session open | Injects git status, plans, TELOS (if present) or global context |
| `pre-tool-safety.py` | Before every tool | BLOCK / CONFIRM / ALERT on dangerous operations |
| `session-end.py` | Session close | Writes session log to `.claude/state/sessions/` |
| `auto-commit.py` | Session close | Auto-commits with conventional commit messages |
| `auto_capture.py` | Session close | Extracts facts → mem0 + Chroma (WSL Ubuntu) |

**What does NOT go here:** project code, client-specific context, experimental skills.

---

## Layer 2: `00_Frameworks` — Templates

**What it is:** Reusable blueprints. **Never do real work directly in a Framework folder.** Always spawn a new project FROM it using `/new-project`.

| Folder | Use When | Provides |
|--------|---------|---------|
| `claude-workspace-pro` | Client delivery, Onnex products, serious dev | TELOS + GSD + 7 agents + 15 commands + 6 hooks + 5 skills |
| `claude-workspace-base` | Simple scripts, personal tools, quick scaffolding | 5 commands + basic context + cost-tracker + pre-compact |
| `_lab/` | Testing new framework patterns | Experimental — not for production use |

**Default: always use `pro` unless you have a specific reason not to.**

**Template initialization (happens when you run `/new-project`):**
- All `{{PROJECT_NAME}}`, `{{VERTICAL}}`, `{{START_DATE}}`, `{{PROJECT_DESCRIPTION}}` placeholders replaced
- TELOS files scaffolded with Onnex-level content + project-specific placeholders filled
- Git initialized, `.claude/state/` cleared, `outputs/` and `scripts/` emptied

---

## Layer 3: `01_Business` — Real Work

**What it is:** All production and near-production work with a real business case.

```
01_Business/
├── Onnex/           ← Onnex is the product owner
│   ├── agency-os/
│   ├── atomic-ai-bp/
│   └── email-triage/
└── Clients/         ← External client is the end user
    └── ndt-portal-v1/
```

**`Onnex/` vs `Clients/` distinction:**
- `Onnex/` — building Onnex's own products or internal tools. Revenue = internal savings or SaaS.
- `Clients/` — delivering to an external paying client. Revenue = $40K+ build + $4K+ MRR.

**Required in every project here:**

| File/Folder | Purpose |
|-------------|---------|
| `CLAUDE.md` | Project identity: what it is, stack, constraints, verification protocol |
| `.claude/settings.json` | Registers cost-tracker + pre-compact local hooks |
| `.claude/hooks/` | cost-tracker.py + pre-compact.py |
| `context/TELOS/` | Full strategic context: mission, goals, strategies, challenges, narratives, beliefs, clients |
| `context/strategy.md` | This project's specific strategy and go-to-market approach |
| `context/current-data.md` | Current metrics, status, numbers — updated after each session |

**What does NOT go here:** experimental work (→ `03_Lab/`), personal projects (→ `02_Personal/`)

---

## Layer 4a: `02_Personal` — Personal Projects

**What it is:** Non-client, non-Onnex work. Personal productivity, learning, and life management.

```
02_Personal/
└── management/      Obsidian vault management, personal scripts, GTD system
```

Lighter setup than business projects. CLAUDE.md + context/ is sufficient. Full TELOS not required. Hooks optional.

---

## Layer 4b: `03_Lab` — Experimentation Pipeline

**What it is:** Controlled environment for trying new ideas. Has an explicit lifecycle — nothing lives here forever.

```
03_Lab/
├── _active/         In-flight experiments — being actively worked
├── _adopt/          Validated — ready to promote to 01_Business/ or 02_Personal/
└── _archive/        Discarded — kept for reference, never deleted
```

**Lifecycle rules:**

| Stage | Folder | Action |
|-------|--------|--------|
| Idea → in progress | `_active/` | Work here until decision point |
| Experiment validated | `_adopt/` | Stage before moving to `01_Business/` |
| Experiment abandoned | `_archive/` | Move here, never work on again |

**Promote from `_active/` to `01_Business/` when:**
- A real client or revenue opportunity is attached
- The core value proposition is proven
- You are committing to ongoing development and delivery

**Current `_active/` projects:**

| Project | What It Is | Next Action |
|---------|-----------|------------|
| `pi-lawyer-os` | PI Growth OS — PI law firm AI-OS | Near-promote to `01_Business/Clients/` |
| `AI-OS-POC` | Multi-tenant AI-OS proof of concept | Continue building |
| `ai-sentinel` | AI security/monitoring layer (production-deployed) | Near-promote to `01_Business/Onnex/` |
| `personal-to-do` | Glassmorphic knowledge management MVP | Personal use or archive |

---

## Decision Tree: Where Does New Work Go?

```
Is this work attached to a specific paying or prospective client?
  YES → 01_Business/Clients/<project-name>/

Are you building an Onnex product or internal tool?
  YES → 01_Business/Onnex/<product-name>/

Is this personal (productivity, learning, life management)?
  YES → 02_Personal/<project-name>/

Is this an experiment, POC, or untested idea?
  YES → 03_Lab/_active/<project-name>/

Later: 03_Lab/_active/ → 01_Business/ (business case proven)
Later: 03_Lab/_active/ → 03_Lab/_archive/ (abandoned)
```

---

## Quick Reference: What Goes Where

| Work type | Destination |
|-----------|-------------|
| Client engagement (NDT, PI law, MSP, medical, other) | `01_Business/Clients/<n>/` |
| Onnex internal tool or product | `01_Business/Onnex/<n>/` |
| Personal management, scripts, Obsidian | `02_Personal/<n>/` |
| New POC, experiment, untested idea | `03_Lab/_active/<n>/` |
| Validated lab experiment | Promote to `01_Business/` |
| Abandoned lab experiment | `03_Lab/_archive/<n>/` |
| New template pattern (testing) | `00_Frameworks/_lab/<n>/` |
| Proven new template | `00_Frameworks/claude-workspace-<n>/` |
| Cross-project knowledge | `.claude-global/skills/core-<n>/` or `onnex-<n>/` |
| Global command | `.claude-global/commands/<n>.md` |
| Global hook | `.claude-global/hooks/<n>.py` + register in `settings.json` |
| Deferred task or research follow-up | `.claude-global/BACKLOG.md` |

---

## Hook Execution Order Per Session

```
1. SessionStart  → session-start.py (global)
2. PreToolUse    → pre-tool-safety.py (global) — fires before EVERY tool call
3. PostToolUse   → cost-tracker.py (local — only if project has .claude/hooks/)
4. PreCompact    → pre-compact.py (local — only if project has .claude/hooks/)
5. Stop          → session-end.py (global)
6. Stop          → auto-commit.py (global)
7. Stop          → auto_capture.py (global, WSL) — memory extraction
```

Projects using pro template get all 7. Projects with only global hooks get 1, 2, 5, 6, 7.
**Never re-register global hooks in a project settings.json — causes double-firing.**

---

## Backlog

Deferred tasks, infrastructure items, and research follow-ups live in:

```
D:\Code\Claude\.claude-global\BACKLOG.md
```

**When to add to BACKLOG.md:**
- A task is identified but can't be done in the current session
- A research decision needs a follow-up build task
- Infrastructure work is planned but not yet scheduled

**Format:** Each item includes priority (🔴/🟡/🟢), full context, exact commands to run, and effort estimate. Items are self-contained — no prior session knowledge needed to action them.

**Current open items (as of 2026-03-31):**
- 🔴 Complete memory migration (run `migrate_batch.py` in WSL terminal)
- 🟡 Deploy Honcho on poc-backend (10.10.110.34)
- 🟡 Fix Node.js PATH in WSL + deploy GitNexus
- 🟢 Onnex Memory Dashboard (React + react-force-graph)
- 🟢 Autonomous skill creation hook (Hermes-style)

---

## Maintenance Rules

1. **Update `context/current-data.md` after each significant work session**
2. **Review `context/TELOS/` quarterly** — goals and challenges change
3. **Promote or archive `03_Lab/_active/` projects** — do not let them stagnate
4. **Keep `00_Frameworks/claude-workspace-pro` clean** — no project artifacts, no working session images
5. **Never re-register global hooks in project settings.json** — causes double-firing
6. **Run `/prime` when returning to a project after more than a week away**
7. **Review `BACKLOG.md` at the start of any planning session** — it is the authoritative task list

---

## Troubleshooting

**Junction broken:**
```powershell
(Get-Item C:\Users\mrtma\.claude -Force).LinkType  # should return: Junction
(Get-Item C:\Users\mrtma\.claude -Force).Target    # should return: D:\Code\Claude\.claude-global
```

**Skills not loading:** Check that skill folder has `SKILL.md` directly inside it (one level deep).

**Hooks double-firing in pro projects:** Pro `settings.json` should only have `PostToolUse` and `PreCompact`.

**CLAUDE_CONFIG_DIR persisting (requires elevated PowerShell):**
```powershell
reg delete "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v CLAUDE_CONFIG_DIR /f
```
