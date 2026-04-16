# Systematic Debugging Skill

## Core Principle

Debugging is a scientific process: observe → hypothesize → test → conclude.
Random code changes without hypotheses is not debugging — it's thrashing.
Never change code until you understand why the bug exists.

---

## The Process

### Step 1 — Reproduce (before touching any code)

You cannot debug what you cannot reproduce. First goal: reliable reproduction.

- What is the **exact** error message or unexpected behavior?
- What are the **exact** inputs/conditions?
- Is it 100% reproducible or intermittent?
- What environment? (local / staging / production, which OS, which version)

If you cannot reproduce it, stop here. Gather more information.

```bash
# Get exact error with full stack trace
pytest tests/test_feature.py::test_specific_case -v --tb=long

# Run in isolation (no other processes)
docker compose up db redis
python -m pytest tests/ -k "test_name" -s
```

### Step 2 — Isolate the scope

Before reading code, narrow down where the bug lives:

**Check recent changes first:**
```bash
git log --oneline -10
git diff HEAD~1          # What changed since it last worked?
git bisect start         # Binary search through commit history
```

**Layer isolation** — Which layer is failing?
```
User Input → API Endpoint → Service Layer → Repository → Database → External API
```
Add temporary logging to identify which layer returns the wrong value.

**Binary search** — If the call stack is long, comment out the lower half.
Does the bug still occur? If yes, it's in the upper half. Repeat.

### Step 3 — Form hypotheses

List 2-3 specific hypotheses. For each:
- What evidence supports this hypothesis?
- What single test would confirm or refute it?

**Good hypothesis:** "The phone number validation regex is rejecting numbers with
country codes because the pattern doesn't account for the `+` prefix."

**Bad hypothesis:** "Something is wrong with the phone validation."

The good hypothesis is falsifiable. Run one test to prove or disprove it.

### Step 4 — Test hypotheses (do NOT fix yet)

Test the most specific hypothesis first. Add targeted logging or assertions:

```python
# Temporary diagnostic — remove after confirming hypothesis
import logging
logger = logging.getLogger(__name__)

def validate_phone(phone: str) -> bool:
    logger.debug(f"validate_phone called with: {repr(phone)}")
    result = bool(re.match(PHONE_PATTERN, phone))
    logger.debug(f"Pattern '{PHONE_PATTERN}' matched: {result}")
    return result
```

Run the failing case. Does the log output confirm your hypothesis?

- **Yes** → Proceed to fix
- **No** → Refine hypothesis, repeat

### Step 5 — Fix

Once root cause is confirmed, apply the minimal fix.
Do not refactor surrounding code unless it caused the bug.

If the fix is non-obvious, add a brief comment explaining why:
```python
# Include optional + prefix for international numbers — bug fix for #247
PHONE_PATTERN = r"^\+?[\d\s\-\(\)]{10,15}$"
```

### Step 6 — Verify

```bash
# 1. Run the exact scenario that was failing
# 2. Run related test cases
# 3. Run the full test suite for regressions
pytest tests/ -v --tb=short
```

All three must pass before declaring done.

### Step 7 — Root Cause Analysis

Write a brief RCA (save in the commit message or PR description):
- What was the bug? (symptom)
- Why did it happen? (root cause)
- Why wasn't it caught earlier?
- Are there other places in the codebase with the same pattern?

---

## Debugging Patterns by Bug Type

### "It works locally but not in prod/staging"
- Check environment variables — missing or wrong values?
- Check network access — can prod reach the same services?
- Check Docker networking — correct network names?
- Check data differences — is the prod data edge-case input?

### "It was working, now it's broken"
- `git bisect` to find the breaking commit
- Check dependency updates (requirements.txt, package.json)
- Check config/env changes
- Check DB migrations — was a migration applied in prod but not locally?

### "Intermittent / only happens sometimes"
- Race condition? (async code, concurrent requests)
- Resource exhaustion? (connection pool, memory)
- External dependency flaking? (third-party API timeouts)
- State pollution between tests? (shared DB state, global variables)

### "Works in isolation, breaks in integration"
- Check initialization order — is something used before it's set up?
- Check mocks hiding real interface mismatches
- Check transaction isolation — are changes committed when you expect?

### Python-specific
```python
# Add to any function to trace calls
import traceback
traceback.print_stack()

# Inspect object state
import pprint
pprint.pprint(vars(obj))

# Drop into interactive debugger at a specific line
import pdb; pdb.set_trace()
# or in Python 3.7+
breakpoint()
```

---

## When to Escalate vs. Keep Digging

**Keep digging if:**
- You have a hypothesis you haven't tested yet
- You haven't isolated the layer yet
- You haven't checked recent changes

**Escalate (ask Mr. T) if:**
- You've tested all hypotheses and none explain it
- The bug only occurs in production and you have no reproduction path
- It requires access or context you don't have (infra, credentials, domain knowledge)
