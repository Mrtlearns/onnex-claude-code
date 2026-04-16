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
- What environment? (local / staging / production, which service)

```bash
# Get exact error with full stack trace
pytest tests/test_feature.py::test_specific_case -v --tb=long

# Run in isolation
docker compose up db redis postgres
python -m pytest tests/ -k "test_name" -s
```

### Step 2 — Isolate the scope

**Check recent changes first:**
```bash
git log --oneline -10
git diff HEAD~1
```

**Layer isolation for NDT Portal v1:**
```
Email/Webhook → n8n → ndtv1-gateway → ndtv1-comply → ndtv1-sanitize → LLM → Temporal → PostgreSQL
```
Add temporary logging to identify which service returns the wrong value.

**Binary search** — Comment out lower half of call stack. Does the bug still occur?

### Step 3 — Form hypotheses

List 2-3 specific hypotheses. For each:
- What evidence supports it?
- What single test would confirm or refute it?

**Good:** "The ITAR classifier is returning `is_controlled=False` for documents with USML Category XV references because the regex doesn't match multi-line descriptions."

**Bad:** "Something is wrong with the classifier."

### Step 4 — Test hypotheses (do NOT fix yet)

Add targeted logging:
```python
import logging
logger = logging.getLogger(__name__)

async def classify(document: Document) -> ClassificationResult:
    logger.debug(f"classify called: doc_id={document.id}, content_hash={document.sha256[:8]}")
    result = await self._run_classifier(document)
    logger.debug(f"classify result: is_controlled={result.is_controlled}, confidence={result.confidence}")
    return result
```

### Step 5 — Fix

Apply the minimal fix. Add a comment if the fix is non-obvious:
```python
# USML descriptions can span multiple lines — use DOTALL flag
USML_PATTERN = re.compile(r"USML\s+Category\s+[IVX]+", re.DOTALL | re.IGNORECASE)
```

### Step 6 — Verify

```bash
pytest tests/ -v --tb=short
docker compose up && # smoke test the pipeline
```

### Step 7 — Root Cause Analysis

Write a brief RCA in the commit message:
- Symptom
- Root cause
- Why it wasn't caught earlier
- Same pattern elsewhere in the codebase?

---

## Debugging Patterns by Bug Type

### "Pipeline produces wrong output"
- Check each stage independently: comply → sanitize → gateway → LLM
- Log inputs and outputs at each service boundary
- Check if the issue is in classification, sanitization, or LLM prompt

### "ITAR content routed to cloud LLM"
- Check ndtv1-comply classification result logs
- Verify the gateway routing logic reads `is_controlled` correctly
- Check if there's a fallback path that bypasses comply

### "Works locally, fails in Docker"
- Check env vars — missing or wrong values?
- Check Docker network — can services reach each other?
- Check volume mounts — is the config file being picked up?

### "Temporal workflow stuck"
- Check workflow history in Temporal UI
- Look for activity timeouts or retries exhausted
- Check if the worker is connected and processing

### Python-specific
```python
import pdb; pdb.set_trace()  # interactive debugger
breakpoint()                  # Python 3.7+
import pprint; pprint.pprint(vars(obj))  # inspect object state
```

---

## When to Escalate

**Keep digging if:**
- You have a hypothesis you haven't tested yet
- You haven't isolated which service layer failed

**Escalate (ask Mr. T) if:**
- Bug only occurs in production with no reproduction path
- Requires access to ITAR-controlled documents to reproduce
- Involves Temporal workflow state corruption
