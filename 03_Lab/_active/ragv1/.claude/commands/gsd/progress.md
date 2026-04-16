# GSD: Progress

> Check current project state and get the next recommended action.

---

## Instructions

Read the following files to understand current state:

1. `projects/pi-lawyer-os/.planning/STATE.md` — current milestone, phase status, key decisions
2. `projects/pi-lawyer-os/.planning/MILESTONES.md` — which milestones are done vs. planned
3. `projects/pi-lawyer-os/.planning/ROADMAP.md` — phase structure
4. `projects/pi-lawyer-os/.planning/PROJECT.md` — product context
5. Check `projects/pi-lawyer-os/.planning/phases/` for any phase PLAN.md or CONTEXT.md files

Then run:
```bash
git status
git log --oneline -10
ls projects/pi-lawyer-os/.planning/phases/ 2>/dev/null
```

## Report

Output a concise status report:

```
## PI Lawyer OS — Current State

**Milestone:** <current milestone and status>
**Active Phase:** <phase number and name>
**Phase Status:** <not started / in progress / complete>

### Completed
- <milestone or phase that is done>

### In Progress
- <what is currently being built>

### Phase Progress
| Phase | Name | Status |
|-------|------|--------|
...

### Key Decisions Locked
- <tech stack summary>
- <other locked decisions>

### Next Recommended Action
<Single, specific next step — e.g., "Run /gsd:plan-phase 1 to create Phase 1 task plan">
```

Keep it tight. One screen max. Flag anything that looks stale or inconsistent.
