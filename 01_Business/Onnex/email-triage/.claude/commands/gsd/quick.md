# GSD: Quick

> Ad-hoc task execution without full phase overhead. For small, well-defined tasks.

## Variables

task: $ARGUMENTS

---

## Instructions

**When to use:**
- Bug fixes, single-file changes, config updates, small feature additions, documentation updates

**When NOT to use:**
- Tasks spanning multiple services, DB schema changes, new phases (use `/gsd:plan-phase` instead)

---

**Step 1: Understand the task** — read only what's needed for this specific task.

**Step 2: Execute** — keep changes minimal and focused.

**Step 3: Verify** — confirm the task is done and working.

**Step 4: Update STATE.md**

```
| {today} | Quick task: {task description} — {result} |
```

**Step 5: Report** — one paragraph: what was done, what changed, what to watch for.
