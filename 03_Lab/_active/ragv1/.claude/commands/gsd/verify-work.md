# GSD: Verify Work

> UAT validation for Phase N. Checks that all success criteria are met.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Step 1: Load success criteria**

Read:
1. `projects/pi-lawyer-os/.planning/phases/0{phase_number}-*/PLAN.md` — success criteria checklist
2. `projects/pi-lawyer-os/.planning/ROADMAP.md` — Phase {phase_number} success criteria
3. `projects/pi-lawyer-os/.planning/MILESTONES.md` — milestone deliverables for this phase

**Step 2: Run verification checks**

For each success criterion, verify it is actually met. Use available tools:

```bash
# Check Docker services
docker compose ps

# Check database schema
docker compose exec postgres psql -U postgres -c "\dt"

# Check API endpoints
curl http://localhost:3000/leads

# Check n8n workflows
# (manual check — list workflows in n8n UI or via API)

# Check frontend builds
ls projects/pi-lawyer-os/frontend/dist/ 2>/dev/null
```

For criteria that require visual or functional testing, flag them for manual user verification.

**Step 3: Report results**

```
## Phase {N} — {Name}: Verification Report

| Criterion | Status | Notes |
|-----------|--------|-------|
| Docker stack healthy | ✅ Pass | All 6 services running |
| Schema deployed | ✅ Pass | firms, leads, communications tables exist |
| Speed-to-lead < 2 min | ⚠️ Manual test needed | n8n workflow deployed, needs live test |
| ... | | |

### Passed: {N}/{total}
### Needs manual testing: {N}
### Failed: {N}

### Issues Found
<list any failures or gaps>

### Recommendation
<Pass → run /gsd:complete-milestone | Fix issues first → describe what to fix>
```

**Step 4: If all criteria pass**

Update `projects/pi-lawyer-os/.planning/STATE.md`:
- Mark phase as "Verified"
- Offer to run `/gsd:complete-milestone` if this was the final phase in a milestone
