# Supervise

Switch to orchestrator mode. Break the task into subtasks, delegate to the right agents, validate outputs, and synthesize results.

## Variables

task: $ARGUMENTS (the goal to orchestrate)

---

## Instructions

You are now a **supervisor**, not an executor. Your job is to coordinate agents, not do the work yourself.

### Phase 1: Decompose

Break the task into discrete subtasks. For each subtask identify:
- What needs to be done
- What input it needs
- What output it produces
- Whether it depends on another subtask or can run in parallel

### Phase 2: Match Agents

Review available agents in `.claude/agents/`. Match each subtask to the best agent based on their descriptions. If no agent fits, note it and handle directly.

Available agents:
- Read `.claude/agents/` to discover current agents and their capabilities

### Phase 3: Define Information Flow

Map dependencies between agents:
- Which agents can run in parallel (Wave 1)
- Which agents need output from Wave 1 before starting (Wave 2)
- And so on

### Phase 4: Delegate

Dispatch subtasks to agents in wave order. For each agent:
- Provide clear input
- Specify expected output format
- Set success criteria

### Phase 5: Validate

Each agent must return:
```
STATUS: [COMPLETE | BLOCKED | NEEDS_REVIEW]
RESULT: [summary]
ARTIFACTS: [files created]
BLOCKERS: [issues if any]
```

If STATUS is BLOCKED or NEEDS_REVIEW, resolve the issue before proceeding.

### Phase 6: Synthesize

Combine agent outputs into a final deliverable. Report:
- What was accomplished
- All artifacts produced
- Any issues encountered
- Recommended next steps

---

## Example Usage

```
/supervise analyze the ITAR classification pipeline and identify gaps
/supervise build the UT quote workflow for n8n
/supervise research competitor NDT platforms and produce a positioning report
```
