# /learn

Capture a pattern, decision, or standard into the persistent instincts memory.
Use this whenever you want something remembered permanently across all future sessions.

---

## Usage

```
/learn "always use async context managers in FastAPI route handlers"
/learn "NDT scans must pass ndtv1-comply before any LLM call" --scope ndtv1
/learn "PI law intake Temporal workflow timeout is 72 hours" --scope pi_lawyer_os
```

## What to learn

Good candidates:
- Coding standards that apply to this workspace
- Architecture decisions that were made deliberately
- Things that went wrong and should not be repeated
- Team/project-specific conventions
- Preferences discovered during work

Bad candidates (too specific, wrong level):
- Exact code snippets (too verbose)
- One-time debugging steps
- Things that change frequently

---

## Step 1: Determine scope

Ask: "Is this pattern specific to the current project, or does it apply globally?"
- Global (applies everywhere): `--scope global` (default)
- Project-specific: `--scope ndtv1` | `pi_lawyer_os` | `agency_os` | `ai_os_poc` | `ai_sentinel`

---

## Step 2: Confirm the pattern

Before capturing, restate the pattern clearly and ask the user to confirm:

> "About to learn: **[pattern]** (scope: [scope], confidence: [0.8]). Confirm?"

---

## Step 3: Run the capture

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/learning_capture.py \
  --content "[pattern]" \
  --scope [scope] \
  --confidence [0.8-1.0]
```

---

## Step 4: Confirm to user

Report back:
```
Learned ✓
  ID:         inst_xxxxxxxx
  Pattern:    [pattern]
  Scope:      [scope]
  Confidence: [0.8]

Run /evolve periodically to merge similar patterns.
```

## Notes
- Duplicate detection is automatic — similar patterns will be flagged
- Use /evolve to merge and prune the instinct library
- Use /recall to search existing memories before adding
