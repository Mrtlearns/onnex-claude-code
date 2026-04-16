---
name: debug
description: >
  Structured debugging workflow. Diagnoses bugs, errors, and unexpected behavior using
  a systematic reproduce → isolate → hypothesize → test → fix → verify approach.
  Produces root cause analysis and a verified fix.
  Triggers on: "debug", "fix this bug", "why is X broken", "this isn't working", "error in", "exception"
---

# /debug — Structured Debugging

Read `.claude/skills/systematic-debugging/SKILL.md` before starting.

## Process

### Step 1 — Reproduce
Get the exact failure before touching any code.
- What is the exact error message / unexpected behavior?
- What are the exact inputs/conditions that trigger it?
- Is it reproducible 100% of the time, or intermittent?

Run the failing case. Confirm you can reproduce it. If you can't reproduce it, stop here and ask.

### Step 2 — Isolate the scope
Narrow down where the bug lives:
- Which layer fails? (UI → API → service → DB → external?)
- Add temporary logging/prints to trace data flow
- Binary search: comment out halves of the code path to locate the fault
- Check recent changes: `git log --oneline -10`, `git diff HEAD~1`

### Step 3 — Form hypotheses
List 2-3 specific hypotheses about root cause. For each:
- What evidence supports this hypothesis?
- What single test would confirm or refute it?

### Step 4 — Test hypotheses
Test the most likely hypothesis first. Do NOT fix anything yet — just prove or disprove.

### Step 5 — Fix
Once root cause is confirmed:
- Apply the minimal fix. Don't refactor surrounding code unless it caused the bug.
- If the fix is non-obvious, add a brief comment explaining why.

### Step 6 — Verify
```bash
# Run the exact scenario that was failing
# Run the full test suite to check for regressions
pytest tests/ -v
```

### Step 7 — Root Cause Analysis
Write a one-paragraph RCA:
- What was the bug?
- Why did it happen? (root cause, not symptoms)
- What prevented it from being caught earlier?
- Is the same pattern present elsewhere in the codebase?

## Output

```
ROOT CAUSE: [one sentence]

FIX: [what was changed and why]

REGRESSIONS: [test suite result — pass/fail counts]

FOLLOW-UP: [other locations with the same pattern, if any]
```
