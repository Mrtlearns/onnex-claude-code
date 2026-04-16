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
- Are file paths sanitized? (prevent path traversal: `../../etc/passwd`)
- Are HTML/JS contexts escaped? (XSS prevention)

**Authentication/Authorization**
- Is every protected endpoint checking auth?
- Are permission checks done server-side (not just client-side)?
- Are JWTs verified (signature + expiry) not just decoded?

**Secrets**
- Are any secrets, API keys, or passwords hardcoded? (`grep -r "password" --include="*.py"`)
- Are secrets ever logged? (check logger.debug/info calls near sensitive operations)
- Are env vars accessed via os.environ.get() with no fallback to a hardcoded default?

**Docker/infra**
- Are containers running as root unnecessarily?
- Are ports exposed beyond what's needed?
- Are secrets passed via ENV (acceptable) vs. baked into image (not acceptable)?

### 3. Tests

**Coverage**
- Is the happy path tested?
- Are error cases tested? (invalid input, external failure, auth failure)
- Are boundary conditions tested? (empty input, max values, exactly-at-limit)

**Test quality**
- Do tests actually fail if you delete the production code?
- Are assertions specific? (`assert result == expected` not `assert result is not None`)
- Is there too much mocking? (mocks hide integration bugs)
- Are tests independent? (no shared state between test cases)

### 4. Performance

**Database**
- Are there N+1 query patterns? (loop with a query inside)
- Are indexes present for the filter/join columns being used?
- Are large result sets paginated?
- Are unnecessary columns selected? (`SELECT *` when only 2 fields needed)

**Memory**
- Are large datasets streamed or batched rather than loaded fully into memory?
- Are expensive objects cached where appropriate?

### 5. Code Quality

**Naming**
- Do names describe what the thing is/does?
- Are abbreviations avoided unless universally understood?

**Complexity**
- Can any function be split? (rule of thumb: if it's over 40 lines, ask why)
- Is there nested logic that could be flattened with early returns?
- Is there duplication that should be extracted?

**Patterns**
- Does this follow existing project conventions?
- Is a new abstraction being introduced for a one-time use? (YAGNI)
- Are new dependencies necessary? (adding a library for one function is rarely justified)

---

## Severity Ratings

| Rating | Meaning |
|--------|---------|
| `MUST-FIX` | Bug, security hole, data loss risk — blocks merge |
| `SHOULD-FIX` | Real issue that will cause problems, but not immediate |
| `CONSIDER` | Optional — worth thinking about but not required |

When in doubt, use SHOULD-FIX over MUST-FIX unless you can describe the concrete failure mode.

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
- Variable naming that's clear enough (bike-shedding)
- Performance optimizations without evidence of a bottleneck
- Hypothetical future requirements ("what if we need to support X someday")
- Stylistic preferences when no convention exists in the codebase

A review full of CONSIDERs that are all style preferences is noise.
Focus on issues that would actually cause problems.
