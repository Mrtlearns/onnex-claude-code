# claude-workspace-pro

> **The full-featured template.** Includes everything from `claude-workspace-base` plus Simon's Level 5-7 agentic capabilities, lifecycle hooks, and domain skills.

---

## When to Use This Template

Use `claude-workspace-pro` for:

- **Complex, multi-domain projects** that benefit from agent orchestration
- **Automation-heavy work** — n8n workflows, data pipelines, multi-step processes
- **Projects where auto-commit and safety guards are valuable** (production-adjacent work)
- **SAP, homelab, or AI agency work** for Onnex clients
- **Anything you expect to run sessions on over multiple days**

For simple, single-domain scripting or quick POCs, use `claude-workspace-base` instead.

---

## What's Included

### From Base (Liam + Cole)
| Command | Purpose |
|---------|---------|
| `/prime` | Orient Claude to the workspace |
| `/create-plan` | Plan changes without implementing |
| `/implement` | Execute a plan |
| `/generate-prp` | Generate a Product Requirements Prompt |
| `/execute-prp` | Implement from a PRP |

### Pro Additions (Simon Level 5-7)
| Feature | Description |
|---------|-------------|
| `/supervise` | Orchestrator mode — delegates to agents |
| `agents/` | Subagent definitions (n8n-builder, researcher) |
| `hooks/session-start.py` | Auto-injects workspace context on session open |
| `hooks/pre-tool-safety.py` | Blocks dangerous writes/commands |
| `hooks/auto-commit.py` | Auto-commits on session stop |
| `skills/n8n/` | n8n domain knowledge for the n8n agent |

---

## Quick Start

1. Copy this folder to your project location (or use `/new-project` from global config)
2. Fill in `CLAUDE.md` — project name and description
3. Fill in `context/` files — personal-info, business-info, strategy, current-data
4. Open Claude Code in the project folder
5. Run `/prime` to orient Claude

---

## Hook Registration

Hooks are pre-registered in `.claude/settings.json`. They activate automatically when Claude Code opens the project. No additional setup needed beyond having Python available.

---

## Adding Agents

1. Copy `.claude/agents/AGENT-TEMPLATE.md`
2. Rename to `[agent-name].md`
3. Fill in purpose, instructions, and output format
4. Reference the new agent in CLAUDE.md's agents table

---

## Template Registry

This template is part of the Onnex template system:

| Template | Use Case |
|----------|---------|
| `claude-workspace-base` | Simple/single-domain projects |
| `claude-workspace-pro` | Complex/multi-domain, agentic (this one) |
| `claude-workspace-mansel` | Mansel Scheffel framework (upstream fork) |
| `claude-workspace-david` | David Ondrej framework (upstream fork) |
| `claude-workspace-pai` | PAI framework (upstream fork) |

Managed via `/new-project` and `/promote` from the global config at `D:\Code\.claude-global`.
