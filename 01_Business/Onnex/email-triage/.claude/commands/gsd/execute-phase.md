# GSD: Execute Phase

> Execute Phase N in parallel waves. Reads the PLAN.md and builds.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Step 1: Load the plan**

Read:
1. `.planning/phases/0{phase_number}-*/PLAN.md`
2. `.planning/phases/0{phase_number}-*/01-CONTEXT.md`
3. `context/architecture.md`, `context/API.md` as needed

Confirm the plan exists. If it doesn't, tell the user to run `/gsd:plan-phase {phase_number}` first.

**Step 2: Update STATE.md**

Set phase {phase_number} status to "In Progress".

**Step 3: Execute wave by wave**

For each wave in the PLAN.md:
1. Announce: "Starting Wave {N}: {name}"
2. Execute tasks (parallel within wave where possible)
3. Validate success criteria for the wave
4. Report brief status after each wave

**Parallelization rules:**
- Infrastructure tasks (Docker, schema, config) → parallel within wave
- Frontend + backend tasks that don't share files → parallel
- Tasks that write to the same file → sequential

**Step 4: After all waves**

1. Run the success criteria checklist from PLAN.md
2. Update STATE.md — set phase to "Complete", add session log entry
3. Tell user to run `/gsd:verify-work {phase_number}`

**Step 5: Final report**

```
## Phase {N} — {Name}: Execution Complete

### Waves completed:
- ✅ Wave 1: {name}
- ✅ Wave 2: {name}

### Success criteria:
- ✅ <criterion met>
- ⚠️ <criterion partial or skipped>

Next step: /gsd:verify-work {N}
```

---

## Error Handling

If a task fails:
1. Stop the current wave
2. Report the error clearly
3. Do NOT proceed to the next wave
4. Ask the user how to proceed

Do not silently skip failed tasks.
