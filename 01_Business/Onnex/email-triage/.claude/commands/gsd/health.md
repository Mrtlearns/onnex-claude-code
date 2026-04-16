# GSD: Health

> Diagnose .planning/ directory health. Check for missing files, inconsistencies, and stale content.

---

## Instructions

**Step 1: Inventory**

```bash
find .planning -type f | sort
```

**Step 2: Check each file**

| File | Expected content |
|------|-----------------|
| `.planning/PROJECT.md` | Product description, tech stack, architecture overview |
| `.planning/REQUIREMENTS.md` | Phase-by-phase requirements with checkboxes |
| `.planning/ROADMAP.md` | Phase roadmap with success criteria |
| `.planning/MILESTONES.md` | Milestones with deliverables |
| `.planning/STATE.md` | Current milestone, phase progress, session log |
| `.planning/config.json` | GSD config |
| `.planning/phases/01-foundation/01-CONTEXT.md` | Tech stack, schema, service list |
| `context/architecture.md` | System architecture |
| `context/API.md` | API reference |

**Step 3: Check consistency**

- Do REQUIREMENTS.md phases match ROADMAP.md phases?
- Does STATE.md current milestone match MILESTONES.md?
- Are tech stack decisions consistent between PROJECT.md and 01-CONTEXT.md?

**Step 4: Report**

```
## .planning/ Health Report

### Files
| File | Status | Issue |
|------|--------|-------|
| PROJECT.md | ✅ OK | — |
| REQUIREMENTS.md | ✅ OK | — |
...

### Consistency Checks
- Phase alignment (REQ vs ROADMAP): ✅ / ⚠️ {issue}
- STATE milestone matches MILESTONES: ✅ / ⚠️ {issue}
- Tech stack consistent: ✅ / ⚠️ {issue}

### Issues Found: {N}
{list issues if any}

### Overall: ✅ Healthy / ⚠️ Issues found
```
