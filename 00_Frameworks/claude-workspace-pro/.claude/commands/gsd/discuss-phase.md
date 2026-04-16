# GSD: Discuss Phase

> Discuss and validate Phase N before planning or building. Use this to think through scope, decisions, and trade-offs.

## Variables

phase_number: $ARGUMENTS

---

## Instructions

This command is for discussion, not implementation. Read the relevant files and initiate a structured conversation about the phase.

**Step 1: Load context**

Read:
1. `.planning/PROJECT.md` — product overview, tech stack
2. `.planning/REQUIREMENTS.md` — find Phase {phase_number} requirements
3. `.planning/ROADMAP.md` — find Phase {phase_number} roadmap entry
4. `.planning/STATE.md` — current decisions and completed work
5. `.planning/phases/0{phase_number}-*/01-CONTEXT.md` — existing context file for this phase (if any)

**Step 2: Frame the discussion**

Present:
1. **What this phase builds** — summarize scope in plain terms
2. **Key decisions to make** — anything not yet locked (from CONTEXT.md or inferred from requirements)
3. **Dependencies** — what must be true before this phase can start
4. **Risks** — what could go wrong or slow things down
5. **Proposed approach** — your recommended way to tackle this phase

**Step 3: Ask questions**

If there are open decisions, ask them one at a time. Don't ask for everything upfront — discuss iteratively.

**Step 4: After discussion**

Once decisions are clear, offer to either:
- Run `/gsd:plan-phase {phase_number}` to create the task plan
- Update `phases/0{phase_number}-*/01-CONTEXT.md` with decisions made in this discussion

---

## Output Format

```
## Phase {N} — {Phase Name}: Discussion

### What We're Building
<plain English description of scope>

### Key Decisions
| Decision | Status | Options |
|----------|--------|---------|
| <decision> | Open / Locked | <option A> vs <option B> |

### Dependencies
- <what must be done first>

### My Recommendation
<your proposed approach>

### Questions
1. <First open question to resolve>
```
