# Onnex Workspace Backlog

Cross-project tasks, deferred decisions, and research follow-ups.
Format: Priority (🔴 High / 🟡 Medium / 🟢 Low) | Area | Item

---

## 🧠 Memory System

### ~~🔴 Complete memory migration~~ ✅ DONE — 2026-03-31
All 4 scopes migrated successfully via WSL terminal:
- global: 20 facts (5 UPDATE, 15 ok)
- ndtv1: 9 facts (1 UPDATE, 8 ok)
- pi_lawyer_os: 8 facts (4 UPDATE, 4 ok)
- workspace: 6 facts (2 ADD/UPDATE, 4 ok)
Logs at: `~/.onnex-memory/migrate_<scope>.log`

---

### 🟡 Deploy Honcho on poc-backend (homelab)
**Context:** Researched Honcho (plastic-labs/honcho) as Layer 4 addition to the Onnex Memory Stack.
Honcho adds dialectic user modeling — it builds a persistent "peer representation" of both
the user and the AI across sessions, improving personalization over time without manual input.

**Decision:** Deploy on poc-backend (10.10.110.34), NOT on WSL Ubuntu laptop.
- poc-backend already has Docker, pgvector (Supabase stack), Redis — all Honcho's dependencies
- WSL Ubuntu is not always-on and has path translation issues
- Skip Honcho's bundled DB containers — reuse existing pgvector instance (create `honcho` DB)
- Skip Honcho's Redis container — reuse homelab Redis

**Deployment spec:**
```bash
# On poc-backend
git clone https://github.com/plastic-labs/honcho.git
cd honcho
cp .env.template .env
# Edit .env:
#   DB_CONNECTION_URI=postgresql+psycopg://user:pass@supabase-db:5432/honcho
#   OPENAI_API_KEY=<use OPENROUTER_API_KEY via compatible base>
#   AUTH_USE_AUTH=false   # disable auth for internal homelab use

# Slim docker-compose — only API server + deriver, no DB/Redis containers
docker compose up -d honcho deriver
```

**Access from laptop:**
```bash
# Add to ~/.onnex-memory/.env
HONCHO_BASE_URL=http://10.10.110.34:8000
```

**Integration point:**
- Wire into `auto_capture.py` Stop hook — after mem0 extraction, also feed session to Honcho
- Add `HONCHO_BASE_URL` to `.env` on laptop
- Add to Hermes agent config if/when Hermes is deployed

**Requires:** Homelab SSH access, poc-backend Docker session
**Estimated effort:** 1 session (~1-2 hours)
**Reference:** Discussion in claude.ai chat session (March 2026) — Hermes agent deep dive

---

### 🟡 Install Node.js in WSL + deploy GitNexus per-project
**Context:** Node.js v24.14.1 installed via nvm but not on PATH in non-interactive shells.
GitNexus needs Node for `npx gitnexus analyze --skills` per project.

**Action:**
```bash
# In WSL terminal — make nvm available to non-interactive shells
echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bashrc
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"' >> ~/.bashrc
source ~/.bashrc
node --version  # verify v24.14.1

# Global MCP setup (once):
npx gitnexus setup

# Per-project (run from each project root in WSL):
cd /mnt/d/Code/Claude/01_Business/Clients/ndt-portal-v1
npx gitnexus analyze --skills

cd /mnt/d/Code/Claude/03_Lab/_active/AI-OS-POC
npx gitnexus analyze --skills
```

**Note:** GitNexus license is PolyForm Noncommercial — check before deploying on client projects.
**Estimated effort:** 30 minutes

---

### 🟢 Build Onnex Memory Dashboard
**Context:** Planned React dashboard combining:
- GitNexus knowledge graph (react-force-graph + KuzuDB Cypher via `gitnexus serve` HTTP API)
- MEMORY.md + instincts.jsonl panels
- Project TELOS status
- Recent session logs

**Stack:** React, react-force-graph, D3
**Dependency:** GitNexus must be deployed first (see above)
**Estimated effort:** 1-2 sessions

---

### 🟢 Implement autonomous skill creation hook (Hermes-style)
**Context:** Hermes agent creates SKILL.md files autonomously after 5+ tool call sessions.
We should implement a similar enhanced Stop hook that detects complex sessions
and attempts to extract procedural skills automatically (without requiring /learn from user).

**Implementation:**
- Enhance `auto_capture.py`: if `session_tool_calls >= 5` and corrections detected → extract skill
- Write extracted skill to `.claude/skills/generated/` in project directory
- Use OpenRouter for extraction (same model as fact extraction)

**Estimated effort:** 1 session

---

## 🏗️ Infrastructure

### 🟢 Run /recall smoke test against migrated memories
**Context:** Migration complete (43 facts across 4 scopes). Need to verify /recall retrieval
is working end-to-end with the full dataset, not just the 5-fact smoke test.

**Action:** In Claude Code session, run:
```
/recall "ITAR compliance pipeline ndtv1"
/recall "PI law speed to lead Twilio TCPA"
/recall "Windows MCP tool selection rules"
```
Expected: relevant facts returned at score > 0.5 for each query.

**Estimated effort:** 5 minutes

---

*Last updated: 2026-03-31*
*Maintained by: Claude Code (claude.ai session)*
