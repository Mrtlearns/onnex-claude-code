# GSD: Progress

> Check current project state and get the next recommended action.

---

## Instructions

Read the following files to understand current state:

1. `.planning/STATE.md` — current milestone, phase status, key decisions
2. `.planning/MILESTONES.md` — which milestones are done vs. planned
3. `.planning/ROADMAP.md` — phase structure
4. `.planning/PROJECT.md` — product context
5. Check `.planning/phases/` for any phase PLAN.md or CONTEXT.md files

Then run:
```bash
git status
git log --oneline -10
ls .planning/phases/ 2>/dev/null
```

## Report

```
## NDT Portal v1 — Current State

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
<Single, specific next step>
```

Keep it tight. One screen max. Flag anything that looks stale or inconsistent.
