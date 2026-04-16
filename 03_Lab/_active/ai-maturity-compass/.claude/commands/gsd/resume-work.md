# GSD: Resume Work

> Resume after interruption. Re-orient and pick up where we left off.

---

## Instructions

**Step 1: Load state**

Read:
1. `.planning/STATE.md` — current milestone, phase, session log
2. `.planning/phases/` — find any phase with status "In Progress"

```bash
git status
git log --oneline -5
ls .planning/phases/
```

**Step 2: Find active work**

If a phase is "In Progress":
- Read its `PLAN.md`
- Identify which waves/tasks were completed vs. pending
- Look at git log to understand what was last committed

**Step 3: Re-orient report**

```
## Resuming {{PROJECT_NAME}} Work

**Last session:** {date from STATE.md session log}
**Last activity:** {last session log entry}

**Current position:**
- Milestone: {milestone}
- Phase: {phase name and number}
- Phase status: {status}

**Where we left off:**
<specific task or wave that was in progress>

**What's next:**
<specific next action — e.g., "Continue Wave 2 — build the lead ingestion form">

**Uncommitted changes:** {git status summary}

Ready to continue. Say "go" or give a specific direction.
```
