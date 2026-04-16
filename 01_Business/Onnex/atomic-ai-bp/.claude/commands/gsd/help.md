# GSD: Help

> Full GSD command reference.

---

## GSD Command Reference

GSD (Get Shit Done) is the spec-driven execution system for NDT Portal v1. State lives in `.planning/`.

### Workflow Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/gsd:progress` | Check current state + get next action | Start of any session |
| `/gsd:discuss-phase N` | Discuss Phase N scope + decisions | Before planning a new phase |
| `/gsd:plan-phase N` | Create atomic task plan for Phase N | After discussion, before building |
| `/gsd:execute-phase N` | Build Phase N from the plan | After plan is ready |
| `/gsd:verify-work N` | UAT validation for Phase N | After execution |
| `/gsd:complete-milestone` | Archive milestone, tag release | After all phases in milestone verified |

### Utility Commands

| Command | Purpose | When to use |
|---------|---------|-------------|
| `/gsd:quick [task]` | Ad-hoc task without phase overhead | Small fixes, config changes |
| `/gsd:resume-work` | Resume after interruption | Start of session after pause |
| `/gsd:pause-work` | Save state cleanly | End of session |
| `/gsd:health` | Diagnose .planning/ directory | If something seems wrong |
| `/gsd:help` | This reference | When you forget a command |

### Standard Workflow

```
1. /gsd:progress          → understand current state
2. /gsd:discuss-phase N   → align on scope (optional if obvious)
3. /gsd:plan-phase N      → create task plan
4. /gsd:execute-phase N   → build it
5. /gsd:verify-work N     → validate
6. /gsd:complete-milestone → archive when milestone done
```

### State Files

| File | Purpose |
|------|---------|
| `.planning/STATE.md` | Current milestone, phase status, decisions, session log |
| `.planning/MILESTONES.md` | Milestone definitions and completion status |
| `.planning/ROADMAP.md` | Phase-by-phase roadmap |
| `.planning/REQUIREMENTS.md` | Full requirements by phase |
| `.planning/PROJECT.md` | Product context, tech stack |
| `.planning/phases/0N-name/01-CONTEXT.md` | Phase-specific tech decisions |
| `.planning/phases/0N-name/PLAN.md` | Task plan (created by /gsd:plan-phase) |

### Current Project: NDT Portal v1

- Stack: Next.js 14, FastAPI, Temporal, PostgreSQL/pgvector, Hasura, Anthropic SDK + Ollama
- Three services: ndtv1-comply, ndtv1-sanitize, ndtv1-gateway
- ITAR compliance is non-negotiable
