---
name: review
description: >
  Code review workflow for changed files. Reviews for correctness, security, test coverage,
  and pattern adherence. Returns structured findings with MUST-FIX / SHOULD-FIX / CONSIDER
  ratings. Run before committing or merging.
  Triggers on: "/review", "review this", "review these changes", "check my code"
---

# /review — Code Review

Read `.claude/skills/code-review/SKILL.md` before starting.

## Scope

If specific files are provided, review those. Otherwise, review all changed files:
```bash
git diff --name-only HEAD
git diff --name-only --cached
```

## Review Pass

Work through each changed file systematically. For each file:

**1. Correctness**
- Does the logic match the intent?
- Are all code paths handled? (null checks, empty lists, error cases)
- Are DB operations transactional where needed?
- Any off-by-one errors, wrong comparisons, type mismatches?

**2. Security**
- Input validated at entry points?
- No SQL/command injection vectors?
- Secrets hardcoded or logged?
- Auth checks present on protected operations?

**3. Tests**
- Is the changed behavior covered by tests?
- Do tests actually fail if you delete the production code?
- Any test shortcuts that hide real failures (too much mocking, overly loose assertions)?

**4. Patterns**
- Follows existing conventions in the project?
- No unnecessary new abstractions?
- Naming is clear and consistent?

**5. Performance**
- Any obvious N+1 queries?
- Unnecessary data loaded into memory?

## Severity

| Label | Meaning |
|-------|---------|
| `MUST-FIX` | Bug, security issue, or data integrity risk — do not merge |
| `SHOULD-FIX` | Real problem, lower urgency |
| `CONSIDER` | Optional improvement |

## Output

```
VERDICT: [APPROVED | APPROVED_WITH_NOTES | CHANGES_REQUESTED]

### MUST-FIX
- [file.py:42] Specific issue and why it's a problem

### SHOULD-FIX
- [file.py:87] Issue and recommendation

### CONSIDER
- [file.py:103] Optional suggestion

### Test Coverage
[Are tests adequate? What's missing?]
```
