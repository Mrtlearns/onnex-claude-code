# Global CLAUDE.md — Onnex AI Agency

Loaded automatically on every Claude Code session via junction at `C:\Users\mrtma\.claude` → `D:\Code\Claude\.claude-global`.
Also loaded by Cowork and Claude Desktop tasks via the same junction.
No CLAUDE_CONFIG_DIR env var required — junction handles all tools (VSCode, Codex, Antigravity, CLI).

---

## Who You Are Working With

**Mr. T** — AI Development Engineer, Software Architect, SAP Expert (18 modules), Cybersecurity Expert, Business Process Optimization Expert.
Owner of **Onnex**, an AI Agency delivering AI-assisted Operating Systems to SME clients across multiple verticals.

Always address the user as **Mr. T**.

Read `context/personal-info.md` and `context/business-info.md` for full context.

**Stack:** Python, n8n, Docker, Proxmox homelab (botonomy.xyz), self-hosted GitLab (gitlab.botonomy.xyz), PostgreSQL/pgvector, Hasura, Temporal, Authentik, Traefik, Tailscale, dual RTX 3090 + Ollama, WSL2/Ubuntu, WezTerm + Zellij.

---

## Task Completion Format (MANDATORY)

After completing ANY task — always close with this exact format, no exceptions:

```
Done with task: <task name>

You asked for: <one-line restatement of the request>

| Step | Description | Tested | Status |
|------|-------------|--------|--------|
| 1    | ...         | 🟢/🟡/🔴 | 🟢/🟡/🔴 |

Legend: 🟢 Pass / Done  🟡 Partial / Warning  🔴 Fail / Blocked

To-Do (Claude):
- ...

To-Do (MrT):
- ...

Done MrT
```

**Tested column:** Did a smoke test or verification run for this step?
**Status column:** Did this step fully succeed?

If there were issues with a step — use 🟡 (partial/warning) or 🔴 (failed) and explain in the relevant To-Do section.
If Claude has nothing pending, write "None" under To-Do (Claude).
If MrT has nothing pending, write "None" under To-Do (MrT).

---

## Workspace Structure

```
D:\Code\Claude\
├── .claude-global\          ← this directory (junction target)
│   ├── CLAUDE.md            ← this file (global identity)
│   ├── settings.json        ← global settings + hook registrations
│   ├── hooks\               ← global lifecycle hooks (all projects)
│   ├── scheduled-tasks\     ← Cowork scheduled task SKILL.md files
│   ├── skills\
│   │   ├── core-docker\     ← Proxmox/Docker homelab context
│   │   ├── core-n8n\        ← n8n standards and patterns
│   │   ├── core-security\   ← security baseline for all deliverables
│   │   ├── core-windows-mcp\ ← Windows MCP tool selection + safe patterns
│   │   ├── onnex-sap\       ← SAP 18-module domain knowledge
│   │   ├── onnex-ndt\       ← NDT/aerospace vertical domain
│   │   └── onnex-pi-law\    ← PI law firm vertical domain
│   ├── commands\            ← global slash commands
│   ├── context\             ← persistent context files
│   └── memory\              ← persistent memory files
│
├── 00_Frameworks\           ← reusable workspace templates
│   ├── claude-workspace-pro\    ← full framework (TELOS + agents + hooks)
│   └── claude-workspace-base\   ← lightweight base template
│
├── 01_Business\
│   ├── Onnex\               ← Onnex internal products
│   └── Clients\             ← client delivery projects
│
├── 02_Personal\             ← personal management and projects
│
└── 03_Lab\                  ← experimentation pipeline
    ├── _active\             ← in-flight experiments
    ├── _adopt\              ← graduated, pending integration
    └── _archive\            ← discarded but preserved
```

---

## Cowork Context

Cowork is the Claude Desktop agentic task tool. It shares this `~/.claude/` config via the junction, so it automatically picks up this CLAUDE.md, all skills, and all scheduled tasks.

**How Cowork uses this config:**
- This CLAUDE.md provides identity and context for every Cowork session
- Skills in `skills/` are loaded for task-relevant domains
- Scheduled tasks are stored in `scheduled-tasks/<task-name>/SKILL.md` — edit these files to modify task prompts

**Cowork working folders:**
- Business tasks → point Cowork at `D:\Code\Claude\01_Business\<project>\`
- Personal tasks → point Cowork at `D:\Code\Claude\02_Personal\`
- Output files → each project has an `outputs\` folder; Cowork writes deliverables there

**Cowork output standards:**
- Excel (.xlsx) — use for data, calculations, financial models
- Word (.docx) — use for reports, proposals, client deliverables
- PowerPoint (.pptx) — use for presentations and slide decks
- All outputs should be business-quality, not drafts

**Cowork constraints:**
- Never modify code files, `.claude/` config files, or git history in Cowork sessions
- Never write to `00_Frameworks\` templates
- Confirm before any bulk file operations (rename, move, delete)
- Follow the same no-hardcoded-secrets rule as all other tools

---

## Global Skills

Skills load automatically in every session. Two tiers:

| Tier | Skill | When Applied |
|------|-------|--------------|
| Core | `core-execution` | **Every task** — pre-execution protocol, commit gate, access hierarchy, test rules |
| Core | `core-docker` | Any Docker, Proxmox, homelab, or deployment work |
| Core | `core-n8n` | Any n8n workflow design or review |
| Core | `core-refactor` | Any file split, extraction, or code reorganisation — includes Vitest unit testing setup |
| Core | `core-security` | Every deliverable — security by default |
| Core | `core-windows-mcp` | Any Windows automation via claude.ai chat MCP tools |
| Onnex | `onnex-sap` | SAP-related tasks, integrations, ABAP, automation |
| Onnex | `onnex-ndt` | NDT/aerospace/RT/UT analysis work |
| Onnex | `onnex-pi-law` | PI law firm client work and PI Growth OS |
| Tool | `obsidian` | Obsidian vault read/write via MCP — knowledge base operations |
| Tool | `autoresearch` | Autonomous multi-step research pipelines (Karpathy) |
| Tool | `awesome-design-md` | Design system documentation patterns (VoltAgent) |
| Tool | `firecrawl` | Web scraping and crawling → LLM-ready markdown |
| Tool | `playwright` | Browser automation, E2E testing, screenshots (plugin enabled) |
| Tool | `notebooklm` | Source-grounded research via Google NotebookLM |
| Tool | `skill-creator` | Anthropic canonical pattern for building new skills |
| Tool | `rag-anything` | Universal RAG pipeline — any document format, pgvector backend |
| Tool | `gws-cli` | Google Workspace CLI — Drive, Gmail, Calendar, Docs automation |

Per-project skills live in `.claude/skills/` and load only within that project.

---

## Windows MCP Tool Priority (claude.ai chat sessions)

When using MCP tools in claude.ai chat to operate Mr. T's Windows machine:

```
1. Filesystem:*           D:\Code\ file ops — separate stable MCP, instant
2. Windows-MCP:Registry   registry reads/writes
3. Invoke-RestMethod      HTTP API calls (-TimeoutSec 5 always)
4. Test-Port ($PROFILE)   TCP checks — non-blocking 1500ms
5. Windows-MCP:PowerShell process mgmt, git, env vars only
```

**NEVER in PowerShell:** `Test-NetConnection`, `Find-NetRoute`, `Test-Connection`, `python subprocess` — these block the MCP process thread and cause crashes.

**WinError 206** (command too long) → use `Filesystem:write_file` instead of `Out-File` via PowerShell.

Full reference: `memory/reference_tool_selection.md` | Full skill: `skills/core-windows-mcp/SKILL.md`

---

## Global Commands

| Command | Purpose |
|---------|---------|
| `/new-project` | Create a new project from a template |
| `/cleanup` | Audit project root for stray files and reorganize |
| `/promote` | Graduate a lab experiment to a full GitLab repo |
| `/prime` | Orient Claude to the current project context |
| `/research` | Tiered web research (Quick / Standard / Extensive) |
| `/debug` | Structured debugging: reproduce → isolate → fix → verify |
| `/review` | Code review: correctness, security, tests, patterns |
| `/council` | Multi-perspective debate for hard architecture decisions |

Full command sets (GSD, agents, PRP workflow) available when using `claude-workspace-pro` template.

---

## Global Hooks

Registered in `settings.json` — fire on every project:

| Hook | Trigger | Action |
|------|---------|--------|
| `session-start.py` | Session open | Injects git status, plans, outputs, TELOS (if present) or global context |
| `pre-tool-safety.py` | Before every tool | 3-tier safety: block / confirm / alert + project root hygiene |
| `session-end.py` | Session close | Writes session log, clears work state |
| `auto-commit.py` | Session close | Auto-commits with conventional commit messages |

Projects using `claude-workspace-pro` get additional hooks (cost-tracker, pre-compact) from their local `.claude/settings.json`.

---

## TELOS Framework

Full TELOS (MISSION, GOALS, PROJECTS, STRATEGIES, CHALLENGES, NARRATIVES, BELIEFS, CLIENTS) lives in `claude-workspace-pro/context/TELOS/`.

For projects not using the pro template, reference `context/business-info.md` and `context/personal-info.md` in this directory for Onnex context.

---

## Delivery Methodology

**ATOM:** Audit → Transform → Optimize → Maintain
**QDOAA:** Quality, Delivery, Operations, Analytics, Adoption

Applied to all Onnex client deliverables. Every engagement follows these gates.

---

## Remote Projects (SSH)

Claude Code connects to remote VMs via SSH. Key contexts:

| VM | Tailscale IP | Purpose |
|----|-------------|---------|
| claude-controller | 100.111.233.126 | Central orchestration hub (Ansible, slash commands, CLAUDE.md) |

SSH key auth configured on port 2222 for gitlab.botonomy.xyz across all repos.

---

## Key Constraints

- Direct, no fluff. Expert-level communication — no hand-holding unless asked.
- Python preferred unless context demands otherwise.
- Never hardcode secrets — env vars or credential stores only.
- Conventional commit format on all auto-commits.
- Security by default on every deliverable.

---

## Full Documentation

See `D:\Code\Claude\.claude-global\WORKSPACE.md` for complete workspace structure, what goes where, decision trees, and maintenance rules.
