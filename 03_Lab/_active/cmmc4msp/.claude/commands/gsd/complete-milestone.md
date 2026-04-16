# GSD: Complete Milestone

> Archive milestone, tag release, advance state.

---

## Instructions

**Step 1: Load current state**

Read:
1. `.planning/STATE.md` — current milestone
2. `.planning/MILESTONES.md` — current milestone deliverables
3. `.planning/ROADMAP.md` — what comes next

**Step 2: Confirm milestone is complete**

Check that:
- All phases in the current milestone are verified
- All milestone deliverables are checked off
- No critical issues are open

If not complete, tell the user what's missing and stop.

**Step 3: Archive the milestone**

1. In `.planning/MILESTONES.md`, mark the milestone as complete with today's date
2. In `.planning/STATE.md`:
   - Update `milestone` to the next version
   - Update `milestone_name`
   - Reset phase progress for the new milestone
   - Add session log entry

**Step 4: Git tag**

```bash
cd .
git tag -a v{version} -m "Milestone {version}: {milestone name} complete"
```

Ask the user to confirm before tagging.

**Step 5: Report**

```
## Milestone {version} — {Name}: COMPLETE ✅

### What was delivered:
- <key deliverable>
- <key deliverable>

### Next milestone: {next version}
**Goal:** <next milestone goal>

### Next step:
Run `/gsd:discuss-phase {N}` to begin planning the next phase,
or `/gsd:plan-phase {N}` if the approach is already clear.
```
