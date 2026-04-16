# GSD: Complete Milestone

> Archive milestone, tag release, advance state.

---

## Instructions

**Step 1: Load current state**

Read:
1. `.planning/STATE.md`
2. `.planning/MILESTONES.md`
3. `.planning/ROADMAP.md`

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
   - Reset phase progress for the new milestone
   - Add session log entry

**Step 4: Git tag**

```bash
git tag -a v{version} -m "Milestone {version}: {milestone name} complete"
```

Ask the user to confirm before tagging.

**Step 5: Report**

```
## Milestone {version} — {Name}: COMPLETE ✅

### What was delivered:
- <key deliverable>

### Next milestone: {next version}
**Goal:** <next milestone goal>

### Next step:
Run `/gsd:discuss-phase {N}` or `/gsd:plan-phase {N}`
```
