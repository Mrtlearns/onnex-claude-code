# GSD: Plan Phase

> Create atomic task plans for Phase N. Produces a PLAN.md in the phase directory.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Do NOT implement anything.** This command creates a plan only.

**Step 1: Load context**

Read:
1. `.planning/PROJECT.md` — tech stack, architecture decisions
2. `.planning/REQUIREMENTS.md` — Phase {phase_number} requirements (find the right phase section)
3. `.planning/ROADMAP.md` — Phase {phase_number} success criteria
4. `.planning/phases/0{phase_number}-*/01-CONTEXT.md` — tech decisions and specifics for this phase
5. `reference/` — architecture, schema, workflow references

**Step 2: Identify the phase directory**

Find or infer the phase directory path: `.planning/phases/0{phase_number}-{name}/`

**Step 3: Create the PLAN.md**

Write `.planning/phases/0{phase_number}-{name}/PLAN.md` with this structure:

```markdown
# Phase {N} — {Name}: Plan

**Created:** {today's date}
**Status:** Ready
**Milestone:** {milestone version this maps to}

---

## Scope

<2-3 sentence summary of what this phase delivers>

---

## Waves

Break tasks into parallel execution waves. Tasks within a wave can run simultaneously. Waves execute sequentially.

### Wave 1: {name}
**Goal:** <what wave 1 accomplishes>

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | <task> | <file paths> | No / Yes (which agent) |
| 1.2 | <task> | <file paths> | No |

### Wave 2: {name}
**Goal:** <what wave 2 accomplishes>
**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | <task> | <file paths> | No |

---

## Success Criteria

Copy from ROADMAP.md Phase {N} success criteria:
- [ ] <criterion>
- [ ] <criterion>

---

## Technical Specifics

### Service Names
<exact Docker service names, ports, env var names>

### File Conventions
<naming, directory structure, patterns to follow>

### Key Commands
<docker-compose commands, migration commands, etc.>

---

## Deferred (Out of Scope)

- <explicit list of things NOT in this phase>
```

**Step 4: Update STATE.md**

Update `.planning/STATE.md`:
- Set phase {phase_number} status to "Planned"
- Add session log entry

**Step 5: Report**

```
## Phase {N} Plan Created

**File:** .planning/phases/0{N}-{name}/PLAN.md
**Waves:** {count}
**Total tasks:** {count}

### Summary of waves:
- Wave 1: {name} — {N} tasks
- Wave 2: {name} — {N} tasks
...

### Next step:
Run `/gsd:execute-phase {N}` to begin building.
```
