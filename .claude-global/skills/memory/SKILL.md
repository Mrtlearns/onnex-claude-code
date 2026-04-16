# Skill: memory

Persistent semantic memory for Onnex AI workspace.
4-layer system: native auto-memory + instincts + mem0/Chroma semantic store + GitNexus structural.

## Python path
All scripts: `wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/<script>.py`

## Operations

### Semantic search (hybrid — use this by default)
```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/smart_search.py \
  --query "topic" --agent-id global --limit 10
```
Hybrid BM25 + vector search, temporal decay, MMR diversity.
Works offline for keyword search; vector search is always available (CPU sentence-transformers).

### Add a specific fact
```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/mem_add.py \
  --content "fact to remember" --agent-id global
```
Project-specific: use `--agent-id ndtv1`, `--agent-id pi_lawyer_os`, etc.
If offline, queues to ~/.onnex-memory/pending/queue.jsonl for later extraction.

### Rebuild FTS5 keyword index (run after bulk imports)
```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/smart_search.py \
  --rebuild-index --agent-id global
```

### Sync mem0 memories to MEMORY.md
```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/mem_sync_md.py \
  --agent-id global
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/mem_sync_md.py \
  --agent-id ndtv1 --dry-run
```

### Add a daily log entry
```bash
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/daily_log.py \
  --content "completed NDT pipeline refactor" --type event
```
Types: note, event, decision, error, insight, task

### Instincts (/learn and /evolve)
Use the /learn and /evolve global commands (these call instincts.py internally).

## Architecture

### Layer 0 — Native Claude Code auto-memory
Claude writes its own MEMORY.md observations. Free, passive, zero setup.
200 line / 25KB limit per file.

### Layer 1 — instincts.jsonl
File: `D:\Code\Claude\.claude-global\memory\instincts.jsonl`
Explicit patterns with confidence scores. Use /learn to add, /evolve to refine.
Always available, no external deps, git-tracked.

### Layer 2 — Semantic memory (mem0 + Chroma + sentence-transformers)
- Vector store: Chroma at `~/.onnex-memory/chroma/` (embedded, no server)
- Embeddings: sentence-transformers/all-MiniLM-L6-v2 (CPU, 384-dim, offline-safe)
- Extraction LLM: OpenRouter gpt-4o-mini (online only)
- Keyword index: SQLite FTS5 at `~/.onnex-memory/fts/memory_fts.db` (always offline)
- Offline mode: FTS5 search works, extraction queued in `~/.onnex-memory/pending/`
- Auto-capture: Stop hook fires after every Claude Code session → extracts facts
- Scoping: `agent_id` per project (global, ndtv1, pi_lawyer_os, ai_os_poc, ai_sentinel, ...)
- MEMORY.md sync: run mem_sync_md.py to regenerate human-readable MEMORY.md

### Layer 3 — GitNexus structural memory (TODO: install Node.js in WSL first)
- `npx gitnexus analyze --skills` per client project
- Generates .claude/skills/generated/ per code module
- MCP server: `npx gitnexus mcp` — serves knowledge graph to Claude Code
- Dashboard: KuzuDB Cypher queries + react-force-graph visualization

## Agent IDs (project scopes)
| Project | agent_id |
|---------|---------|
| Global (cross-project) | global |
| NDT Portal v1 | ndtv1 |
| PI Growth OS | pi_lawyer_os |
| AI-OS-POC | ai_os_poc |
| ai-sentinel | ai_sentinel |
| Agency OS | agency_os |
| ATOMIC-AI-BP | atomic_ai_bp |
| Email Triage | email_triage |

## Data locations
- Vector store: `~/.onnex-memory/chroma/`
- FTS5 index: `~/.onnex-memory/fts/memory_fts.db`
- History DBs: `~/.onnex-memory/history_<agent_id>.db`
- Daily logs: `~/.onnex-memory/logs/YYYY-MM-DD.md`
- Offline queue: `~/.onnex-memory/pending/queue.jsonl`
- Auto-capture log: `~/.onnex-memory/auto_capture.log`
- Instincts: `D:\Code\Claude\.claude-global\memory\instincts.jsonl`
- MEMORY.md: `D:\Code\Claude\.claude-global\memory\MEMORY.md`

## Security
- sanitize_text() strips API keys, tokens, JWTs, connection strings before any external call
- Applied in auto_capture.py and mem_add.py automatically
- Chroma + FTS5 are local files — no data leaves WSL
- Only extracted facts (not raw conversation) go to OpenRouter
- .env is gitignored

## Stop hook command (registered in global settings.json)
```
wsl python3 /mnt/d/Code/Claude/.claude-global/skills/memory/scripts/auto_capture.py
```
