# Code Review Skill

## Purpose

Code review catches bugs, security issues, and design problems before they reach
production. A good review improves the code — a bad review is just criticism.

Focus on real problems that matter. Skip pedantic style issues unless they affect
readability significantly.

---

## Review Checklist

### 1. Correctness

**Logic**
- Does the code do what the intent describes?
- Are all conditional branches correct? (check negation logic carefully)
- Are list/array operations correct? (off-by-one, empty list handling)
- Are comparisons correct? (== vs is, null checks, type coercion)

**Data integrity**
- Are DB writes inside transactions where needed?
- Is optimistic locking/version checking used for concurrent updates?
- Are partial failures handled? (if step 2 of 3 fails, is step 1 rolled back?)

**Error handling**
- Are errors propagated correctly or silently swallowed?
- Are error messages useful (not "an error occurred")?
- Are external calls (APIs, DB) wrapped in appropriate error handling?

### 2. Security

**Input validation**
- Is all user input validated at the API boundary?
- Are SQL queries parameterized? (no f-strings in queries)
- Are file paths sanitized? (prevent path traversal)
- Are HTML/JS contexts escaped?

**Authentication/Authorization**
- Is every protected endpoint checking auth?
- Are permission checks done server-side?
- Are JWTs verified (signature + expiry)?

**Secrets**
- Are any secrets, API keys, or passwords hardcoded?
- Are secrets ever logged?

**ITAR (NDT Portal v1 specific)**
- Is controlled data ever routed to cloud APIs without going through ndtv1-comply first?
- Is the classification result checked before any LLM call?

### 3. Tests

**Coverage**
- Is the happy path tested?
- Are error cases tested?
- Are boundary conditions tested?

**Test quality**
- Do tests actually fail if you delete the production code?
- Are assertions specific?
- Is there too much mocking?

### 4. Performance

**Database**
- Are there N+1 query patterns?
- Are large result sets paginated?

### 5. Code Quality

- Do names describe what the thing is/does?
- Can any function be split? (>40 lines, ask why)
- Does this follow existing project conventions?

---

## Severity Ratings

| Rating | Meaning |
|--------|---------|
| `MUST-FIX` | Bug, security hole, data loss risk, ITAR violation — blocks merge |
| `SHOULD-FIX` | Real issue that will cause problems, but not immediate |
| `CONSIDER` | Optional — worth thinking about but not required |

---

## Review Output Template

```
VERDICT: [APPROVED | APPROVED_WITH_NOTES | CHANGES_REQUESTED]

### MUST-FIX
- [file.py:42] <what the issue is and why it matters>

### SHOULD-FIX
- [file.py:87] <issue and recommendation>

### CONSIDER
- [file.py:103] <optional suggestion with rationale>

### Test Coverage
<Are tests adequate? What scenarios are missing?>

### Summary
<2-3 sentences: overall assessment, main concern>
```

---

## What NOT to Comment On

- Whitespace, indentation (that's a linter's job)
- Variable naming that's clear enough
- Performance optimizations without evidence of a bottleneck
- Hypothetical future requirements
- Stylistic preferences when no convention exists in the codebase
