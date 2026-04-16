# /recall

Search the persistent memory (semantic + keyword hybrid search) for relevant context.
Use before starting work on a topic you may have worked on before.

---

## Usage

```
/recall "ITAR compliance pipeline"
/recall "NDT scan analysis architecture"
/recall "PI law speed-to-lead workflow" --agent-id pi_lawyer_os
```

---

## Step 1: Determine scope

Detect from current project context:
- In ndtv1 project → `--agent-id ndtv1`
- In pi-lawyer-os → `--agent-id pi_lawyer_os`
- No clear project → `--agent-id global`

---

## Step 2: Run smart search

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/smart_search.py \
  --query "[user's query]" \
  --agent-id [scope] \
  --limit 8
```

---

## Step 3: Also search instincts

```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/memory/scripts/learning_capture.py \
  --list --scope [scope] --limit 10
```

---

## Step 4: Present results

Format the combined results clearly:

```
Recalled [N] memories for "[query]":

Memories (semantic):
  1. [memory text] (score: 0.87)
  2. [memory text] (score: 0.74)
  ...

Instincts (patterns):
  • [pattern] (conf: 0.9, scope: global)
  • [pattern] (conf: 0.85, scope: ndtv1)
```

If nothing relevant found: "No relevant memories found for this query."

## Notes
- Search works offline (FTS5 keyword search always available)
- Vector similarity requires the embedding model to load (~3s on first call)
- Use /learn to add new memories
