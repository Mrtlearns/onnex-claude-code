# claude-workspace-base

A structured Claude Code workspace template — the foundation layer for all Onnex AI projects.

## What This Is

This is the **base template** combining the best of:
- **Liam Ottley** — workspace structure, context loading, session workflow
- **Cole Medin** — PRP (Product Requirements Prompt) framework, `/generate-prp`, `/execute-prp`

It provides a clean, minimal starting point for any project. For complex or multi-agent work, use `claude-workspace-pro` instead.

## When To Use This

- Simple, single-domain projects
- Client deliverables that don't need agent orchestration
- Starting point for evaluating new Claude Code techniques

## Structure

```
.
├── CLAUDE.md              # Core context — loaded every session
├── INITIAL.md             # Feature request template
├── .claude/
│   └── commands/          # Slash commands
│       ├── prime.md           # /prime — session initialization
│       ├── create-plan.md     # /create-plan — plan before building
│       ├── implement.md       # /implement — execute a plan
│       ├── generate-prp.md    # /generate-prp — generate a PRP from INITIAL.md
│       └── execute-prp.md     # /execute-prp — execute a PRP
├── context/               # Who you are, your goals, current priorities
├── examples/              # Code examples for Claude to reference
├── plans/                 # Implementation plans
├── PRPs/                  # Product Requirements Prompts
├── outputs/               # Work products and deliverables
├── reference/             # Templates and reusable patterns
└── scripts/               # Automation scripts
```

## Commands

| Command | Purpose |
|---|---|
| `/prime` | Initialize session with full context |
| `/create-plan` | Plan before making changes |
| `/implement` | Execute a plan |
| `/generate-prp` | Generate a PRP from INITIAL.md |
| `/execute-prp` | Execute a PRP |

## Usage

1. Clone this repo into your project folder
2. Fill in `context/` files with your role, goals, and priorities
3. Run `/prime` at the start of every Claude Code session

## Part Of

This template is part of the Onnex Claude Code workspace system:

| Template | Contents | Use When |
|---|---|---|
| `claude-workspace-base` | Liam + Cole | Simple/single-domain projects |
| `claude-workspace-pro` | Base + Simon + GSD | Complex/multi-agent projects |
| `claude-workspace-mansel` | Mansel Scheffel as-is | Evaluating Mansel's approach |
| `claude-workspace-david` | David Ondrej as-is | Evaluating David's approach |
| `claude-workspace-pai` | PAI template as-is | Evaluating PAI approach |

Global commands (`/new-project`, `/promote`) are available via `D:\Code\.claude-global`.
