# GSD: Pause Work

> Save state and pause. Ensures work can be cleanly resumed.

---

## Instructions

**Step 1: Document current state**

Update `projects/pi-lawyer-os/.planning/STATE.md`:
- Add session log entry with today's date and a clear description of what was done and what's next
- If a phase is in progress, note which wave/task was last completed

Format:
```
| {today} | {what was done} — paused at: {specific task or decision point} — next: {exactly what to do next} |
```

**Step 2: Git status**

```bash
git status
git diff --stat
```

If there are uncommitted changes, ask the user: "Commit before pausing? (y/n)"

If yes, create a commit with a descriptive message summarizing the work done.

**Step 3: Confirm pause**

```
## Work Paused ✅

**Last completed:** {what was done}
**Paused at:** {specific stopping point}
**To resume:** Run `/gsd:resume-work`

**State saved to:** projects/pi-lawyer-os/.planning/STATE.md
**Git:** {committed / uncommitted changes noted}
```
