# GSD: Verify Work

> UAT validation for Phase N. Checks that all success criteria are met.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Step 1: Load success criteria**

Read:
1. `.planning/phases/0{phase_number}-*/PLAN.md` — success criteria checklist
2. `.planning/ROADMAP.md` — Phase {phase_number} success criteria
3. `.planning/MILESTONES.md` — milestone deliverables for this phase

**Step 2: Run verification checks**

For each success criterion, verify it is actually met:

```bash
# Check Docker services
docker compose ps

# Check database schema
docker compose exec postgres psql -U postgres -c "\dt"

# Check API endpoints
curl http://localhost:3100/health

# Check pipeline stages
# (verify ndtv1-comply, ndtv1-sanitize, ndtv1-gateway respond)
```

Flag criteria requiring visual/functional testing for manual user verification.

**Step 3: Report results**

```
## Phase {N} — {Name}: Verification Report

| Criterion | Status | Notes |
|-----------|--------|-------|
| Docker stack healthy | ✅ Pass | All services running |
| Schema deployed | ✅ Pass | Tables exist |
| Pipeline responds | ⚠️ Manual test needed | |

### Passed: {N}/{total}
### Needs manual testing: {N}
### Failed: {N}

### Issues Found
<list any failures>

### Recommendation
<Pass → run /gsd:complete-milestone | Fix issues first>
```

**Step 4: If all criteria pass**

Update STATE.md — mark phase as "Verified". Offer to run `/gsd:complete-milestone` if this was the final phase.
