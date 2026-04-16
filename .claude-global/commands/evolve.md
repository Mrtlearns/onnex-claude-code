# /evolve

Analyze the instinct library, merge duplicates, resolve contradictions, and update confidence scores.
Run periodically (weekly or after heavy learning sessions) to keep the library clean.

---

## When to run

- After 5+ new /learn calls in a session
- When /recall returns too many similar results
- Weekly maintenance

---

## Step 1: Check instinct count

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/learning_capture.py --stats
```

If < 5 active instincts: no action needed.

---

## Step 2: Dry run first

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/evolve.py --dry-run
```

Show the user what would change (merges, prunes, confidence updates).
Ask: "Apply these changes? (y/n)"

---

## Step 3: Apply (if confirmed)

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/evolve.py
```

---

## Step 4: Report

```
Evolution complete ✓
  Before: [N] instincts
  After:  [M] instincts
  Merged: [X] groups
  Pruned: [Y] entries
  Updated confidence: [Z] entries
```

## Notes
- Requires online connection to OpenRouter for LLM analysis
- If offline: evolution is skipped, try again when connected
- Evolution never deletes instincts you explicitly added — it merges and deduplicates
