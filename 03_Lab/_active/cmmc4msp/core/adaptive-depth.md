# Adaptive Depth — Methodology Selection Guide

When given a task, select the appropriate depth mode based on complexity and impact.
Apply more rigor to tasks with higher stakes and longer-term consequences.
Apply less ceremony to quick, reversible, low-risk changes.

---

## The Three Modes

### DIRECT — Simple, immediate execution

**When to use:**
- Single file changes (config update, fix a typo, rename a variable)
- Reading/investigating code without changing it
- Running a command or script
- Answering a question
- Changes that take <5 minutes and are trivially reversible

**Process:** Execute directly. No planning document, no test cycle, no review pass.

**Indicators:**
- "Update the port in docker-compose.yml"
- "What does this function do?"
- "Add a logging statement here"
- "Fix the typo in the README"

---

### WORKFLOW — Feature work with quality gates

**When to use:**
- New feature or endpoint (2-6 hours of work)
- Bug fix with non-obvious root cause
- Refactor of an existing module
- Integration with a new external service
- Changes touching 3+ files

**Process:**
1. **Read** — Understand the existing code before changing it
2. **Plan** — State what you're building and how (can be brief, inline)
3. **Test first** — Write failing tests (RED) before production code
4. **Implement** — Minimum code to pass tests (GREEN)
5. **Refactor** — Clean up without breaking tests
6. **Review** — Run `/review` on changed files before committing
7. **Verify** — Smoke test the running system

**Indicators:**
- "Add a new endpoint for X"
- "Implement the lead intake form"
- "Fix the race condition in the job runner"

---

### ALGORITHM — Architecture with full methodology

**When to use:**
- New system or service design
- Technology selection with long-term consequences
- Migrations or major refactors
- Work that requires research before implementation
- Changes that are hard to reverse once committed
- Multi-day or multi-phase work

**Process:**
1. **OBSERVE** — Read all relevant context. Understand the problem fully.
2. **THINK** — Define Ideal State Criteria (ISC). What does success look like?
3. **PLAN** — Architecture, data model, API contracts, implementation sequence
4. **BUILD** — WORKFLOW mode for each component, in order
5. **EXECUTE** — Integration, wiring components together
6. **VERIFY** — End-to-end validation against ISC
7. **LEARN** — Document decisions, gotchas, and outcomes

**Indicators:**
- "Design the {{PROJECT_NAME}} core module architecture"
- "Should we use Kafka or Redis for the event bus?"
- "Migrate the auth system from JWT to sessions"
- "Build Phase 2 of the onboarding flow"

---

## ISC — Ideal State Criteria (for ALGORITHM mode)

Before implementing, define 4-8 binary pass/fail criteria:
- State the outcome, not the action
- 8-12 words per criterion
- Must be testable (can verify pass/fail)

**Example ISC for a lead intake API:**
- New leads are persisted to DB within 500ms of submission
- Duplicate phone numbers return 409 with clear error message
- Missing required fields return 422 with field-level errors
- Speed-to-lead webhook fires within 2 seconds of lead creation
- Leads are not created when external CRM is unavailable
- All endpoints return 401 without valid auth token

---

## Mode Selection Quick Reference

| Signal | Mode |
|--------|------|
| 1 file, <30 lines changed | DIRECT |
| Config / docs update | DIRECT |
| New feature, 1-2 services | WORKFLOW |
| Bug with unclear root cause | WORKFLOW |
| New system design | ALGORITHM |
| Technology decision | ALGORITHM |
| Multi-phase build | ALGORITHM |
| Reversible + low stakes | DIRECT |
| Hard to reverse + high stakes | ALGORITHM |

---

## Override Syntax

You can override the auto-selected mode:
- `"quick:"` prefix → force DIRECT
- `"use tdd"` → force WORKFLOW with TDD enforcement
- `"design first"` or `"plan this"` → force ALGORITHM
