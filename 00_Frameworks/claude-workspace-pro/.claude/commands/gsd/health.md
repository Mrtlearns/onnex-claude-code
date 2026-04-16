# GSD: Health

> Diagnose .planning/ directory health. Check for missing files, inconsistencies, and stale content.

---

## Instructions

**Step 1: Inventory**

```bash
find ./.planning -type f | sort
find ./reference -type f | sort
```

**Step 2: Check each file**

For each expected file, verify it exists and has real content (not a template stub):

| File | Expected content |
|------|-----------------|
| `.planning/PROJECT.md` | Product description, tech stack, business model |
| `.planning/REQUIREMENTS.md` | Phase-by-phase requirements with checkboxes |
| `.planning/ROADMAP.md` | 6-phase roadmap with success criteria |
| `.planning/MILESTONES.md` | v0–v2.2 milestones with deliverables |
| `.planning/STATE.md` | Current milestone, phase progress, session log |
| `.planning/config.json` | GSD config |
| `.planning/phases/01-foundation/01-CONTEXT.md` | Tech stack, schema, service list |
| `reference/architecture.md` | System architecture |
| `reference/db-schema.sql` | Phase 1 schema |
| `reference/neo4j-schema.md` | Graph schema |
| `reference/ai-prompts.md` | AI prompt library |
| `reference/n8n-workflows/speed-to-lead.json` | Workflow skeleton |
| `reference/n8n-workflows/missed-call-recovery.json` | Workflow skeleton |

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
| phases/01-foundation/01-CONTEXT.md | ✅ OK | — |
...

### Consistency Checks
- Phase alignment (REQ vs ROADMAP): ✅ / ⚠️ {issue}
- STATE milestone matches MILESTONES: ✅ / ⚠️ {issue}
- Tech stack consistent: ✅ / ⚠️ {issue}

### Issues Found: {N}
{list issues if any}

### Overall: ✅ Healthy / ⚠️ Issues found
```
