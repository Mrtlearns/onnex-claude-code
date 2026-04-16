# GSD: Plan Phase

> Create atomic task plans for Phase N. Produces a PLAN.md in the phase directory.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Do NOT implement anything.** This command creates a plan only.

**Step 1: Load context**

Read:
1. `.planning/PROJECT.md`
2. `.planning/REQUIREMENTS.md` — Phase {phase_number} requirements
3. `.planning/ROADMAP.md` — Phase {phase_number} success criteria
4. `.planning/phases/0{phase_number}-*/01-CONTEXT.md`
5. `context/architecture.md`, `context/API.md` as needed

**Step 2: Create the PLAN.md**

Write `.planning/phases/0{phase_number}-{name}/PLAN.md`:

```markdown
# Phase {N} — {Name}: Plan

**Created:** {today's date}
**Status:** Ready
**Milestone:** {milestone version}

---

## Scope
<2-3 sentence summary of what this phase delivers>

---

## Waves

### Wave 1: {name}
**Goal:** <what wave 1 accomplishes>

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | <task> | <file paths> | No / Yes (which agent) |

### Wave 2: {name}
**Goal:** <what wave 2 accomplishes>
**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | <task> | <file paths> | No |

---

## Success Criteria
- [ ] <criterion from ROADMAP.md>

---

## Technical Specifics
### Service Names / Ports
### File Conventions
### Key Commands

---

## Deferred (Out of Scope)
- <explicit list of things NOT in this phase>
```

**Step 3: Update STATE.md**

Set phase {phase_number} status to "Planned". Add session log entry.

**Step 4: Report**

```
## Phase {N} Plan Created

**File:** .planning/phases/0{N}-{name}/PLAN.md
**Waves:** {count} | **Total tasks:** {count}

Next step: /gsd:execute-phase {N}
```
