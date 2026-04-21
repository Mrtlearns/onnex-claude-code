# Prime

> Load workspace context and orient yourself. Run this at the start of every session.

---

## Step 1: Scan Workspace

```bash
ls -la
find . -type f -name "*.md" | head -30
```

---

## Step 2: Read Core Context

Read the following files in order:

1. `CLAUDE.md` — project identity, role, available commands
2. `context/TELOS.md` — TELOS index and cross-reference map
3. `context/TELOS/MISSION.md` — core missions
4. `context/TELOS/GOALS.md` — active goals and milestones
5. `context/TELOS/PROJECTS.md` — active and planned projects
6. `context/TELOS/CHALLENGES.md` — current obstacles
7. `context/TELOS/STRATEGIES.md` — how we're addressing them
8. `context/strategy.md` — THIS project's specific strategy
9. `context/current-data.md` — current metrics and state
10. `context/architecture.md` — current system architecture
11. `.claude/skills/db-ssh-access/SKILL.md` — **MUST READ before any DB/SSH work**: exact working pattern for SSH→Docker→PostgreSQL (credentials, container name, quoting rules, copy-paste templates)

**Also read if relevant to current work:**
- `context/TELOS/NARRATIVES.md` — pitches and talking points (for sales/comms work)
- `context/TELOS/BELIEFS.md` — core beliefs (for strategy/planning work)
- `context/TELOS/CLIENTS.md` — client relationships (for client-facing work)

---

## Step 3: Check Active State

```bash
git status
ls plans/ 2>/dev/null
ls outputs/ 2>/dev/null | tail -5
```

---

## Step 4: Summarize

Provide a concise summary covering:

1. **Who and what** — Mr. T, Onnex, this project's purpose
2. **Current priorities** — top goals, active projects, key challenges
3. **This project** — what it is, where it stands, what the strategy is
4. **Available tools** — commands and agents you can deploy
5. **Ready confirmation** — state you're oriented and ready to work

Keep the summary tight. Mr. T doesn't need a recap of what he already knows — flag anything that looks stale, inconsistent, or worth discussing.

---

## Step 5: Flag Issues (if any)

If you notice:
- TELOS files that appear empty or not filled in
- Goals without linked projects
- Stale `current-data.md`
- Uncommitted work in git

...mention it briefly. Don't lecture, just note it.

---

## Step 6: Reference Files Available

Flag these to Mr. T if the session involves DB or schema work:

| File | Purpose | When to use |
|------|---------|-------------|
| `files/ndtportal_schema_dump.sql` | Full PostgreSQL DDL snapshot (all schemas, tables, functions, indexes) | Before writing migrations, checking column names, understanding table structure — avoids live DB round-trips |
| `.claude/skills/db-ssh-access/SKILL.md` | SSH→Docker→psql lean-path | Any live DB query via SSH |

**Schema currency:** The `ndtportal_schema_dump.sql` reflects the DB state at time of last dump. If migrations have been added since the last session, re-dump with:
```bash
ssh -i /c/Users/mrtma/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126 \
  "ssh mrt@10.10.110.32 'docker exec ndt-portal-postgres-1 pg_dump -U ndtapp -d ndtportal --schema-only --no-owner --no-acl 2>&1'" \
  > files/ndtportal_schema_dump.sql
```
