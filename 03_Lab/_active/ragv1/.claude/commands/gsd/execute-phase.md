# GSD: Execute Phase

> Execute Phase N in parallel waves. Reads the PLAN.md and builds.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

**Step 1: Load the plan**

Read:
1. `projects/pi-lawyer-os/.planning/phases/0{phase_number}-*/PLAN.md` — the task plan to execute
2. `projects/pi-lawyer-os/.planning/phases/0{phase_number}-*/01-CONTEXT.md` — tech decisions and specifics
3. `projects/pi-lawyer-os/reference/` — architecture, schema, workflow references as needed

Confirm the plan exists. If it doesn't, tell the user to run `/gsd:plan-phase {phase_number}` first.

**Step 2: Update STATE.md**

Set phase {phase_number} status to "In Progress" in `projects/pi-lawyer-os/.planning/STATE.md`.

**Step 3: Execute wave by wave**

For each wave in the PLAN.md:

1. **Announce the wave:** "Starting Wave {N}: {name}"
2. **Execute tasks:** For tasks within a wave, use the Agent tool to run them in parallel when possible. For sequential tasks, execute in order.
3. **Validate:** After each wave, verify the success criteria for that wave before moving to the next.
4. **Report:** Brief status after each wave completes.

**Parallelization rules:**
- Infrastructure tasks (Docker, schema, config) → parallel within wave
- Frontend + backend tasks that don't share files → parallel
- Tasks that write to the same file → sequential
- Use `/supervise` for complex multi-agent orchestration

**Step 4: After all waves complete**

1. Run the success criteria checklist from PLAN.md
2. Update `projects/pi-lawyer-os/.planning/STATE.md`:
   - Set phase {phase_number} to "Complete"
   - Add session log entry
3. Tell user to run `/gsd:verify-work {phase_number}` for UAT validation

**Step 5: Final report**

```
## Phase {N} — {Name}: Execution Complete

### Waves completed:
- ✅ Wave 1: {name}
- ✅ Wave 2: {name}
...

### Success criteria:
- ✅ <criterion met>
- ⚠️ <criterion partial or skipped>

### Next step:
Run `/gsd:verify-work {N}` to validate.
```

---

## Error Handling

If a task fails:
1. Stop the current wave
2. Report the error clearly
3. Do not proceed to the next wave
4. Ask the user how to proceed (fix, skip, or adjust plan)

Do not silently skip failed tasks.
