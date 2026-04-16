# GSD: Quick

> Ad-hoc task execution without full phase overhead. For small, well-defined tasks.

## Variables

task: $ARGUMENTS

---

## Instructions

This is a lightweight execution path for tasks that don't warrant a full phase plan.

**When to use:**
- Bug fixes
- Single-file changes
- Config updates
- Small feature additions
- Documentation updates

**When NOT to use:**
- Tasks spanning multiple services
- Anything that changes the database schema
- New phases or major features (use `/gsd:plan-phase` instead)

---

**Step 1: Understand the task**

Read relevant files for context. Don't read everything — only what's needed for this specific task.

**Step 2: Execute**

Do the task. Keep changes minimal and focused.

**Step 3: Verify**

Confirm the task is done and working. Run relevant checks.

**Step 4: Update STATE.md**

Add a brief session log entry to `projects/pi-lawyer-os/.planning/STATE.md`:
```
| {today} | Quick task: {task description} — {result} |
```

**Step 5: Report**

One paragraph: what was done, what changed, what to watch for.
