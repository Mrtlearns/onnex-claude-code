---
name: tdd
description: >
  TDD (Test-Driven Development) workflow. Forces RED-GREEN-REFACTOR discipline for any
  implementation task. Use when building a new feature, function, or service and you want
  to enforce test-first development. Delegates to the engineer agent for implementation.
  Triggers on: "/tdd", "use tdd", "test-driven", "write tests first"
---

# /tdd — Test-Driven Development

Read `.claude/skills/TDD/SKILL.md` before starting.

## The Iron Law

**No production code without a failing test first. No exceptions.**

## Workflow

### Step 1 — Define behavior (not implementation)
Write out what the function/feature DOES, not how it works:
- Input → Output
- Side effects (DB writes, API calls, events)
- Error cases (invalid input, external failure)

### Step 2 — RED: Write the failing test
```python
def test_<behavior_description>():
    # Arrange
    input_data = ...

    # Act
    result = function_under_test(input_data)

    # Assert
    assert result == expected_value
```

Run it. **It must fail.** If it passes, the test is wrong.

Confirm the failure message is meaningful (not an import error or syntax error).

### Step 3 — GREEN: Write minimal production code
Write the simplest code that makes the test pass.
- No additional logic beyond what the test requires
- No handling of cases not yet covered by a test
- Ugly is fine at this stage — clean up in REFACTOR

Run the test. **It must pass.**

### Step 4 — REFACTOR: Clean without changing behavior
- Remove duplication
- Improve naming
- Simplify logic
- Extract functions if needed

Run the test after every change. **It must still pass.**

### Step 5 — Repeat for the next behavior
Add the next test case. Go back to RED.

## Common Mistakes to Avoid

- Writing production code before the test
- Writing multiple tests before writing any production code
- Writing tests that pass trivially (testing implementation instead of behavior)
- Skipping REFACTOR (tech debt accumulates fast)
- Mocking everything (use real dependencies in integration tests)

## Output

Report after each RED-GREEN-REFACTOR cycle:
```
CYCLE [N]:
  RED:    [test name] — confirmed failing ✓
  GREEN:  [what code was written] — test passing ✓
  REFACTOR: [what was cleaned up]
```

Final:
```
COMPLETE: [N] cycles | [N] tests passing | [files created/modified]
```
