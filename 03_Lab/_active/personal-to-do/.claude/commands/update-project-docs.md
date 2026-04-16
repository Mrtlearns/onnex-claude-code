# Update Project Docs

> Audit all changes since the last doc update, refresh architecture + API reference + diagrams, commit everything, and push.

---

## Step 1: Detect Project Context

```bash
git rev-parse --show-toplevel
git rev-parse --abbrev-ref HEAD
git remote get-url origin
```

Locate:
- `context/architecture.md` — main architecture doc (create if missing)
- `context/API.md` — API reference (create if missing)
- `context/diagrams.md` — Mermaid diagrams (create if missing)

---

## Step 2: Find the Change Window

```bash
git log --oneline --all -- "context/*.md" "*.md" | head -5
git diff --name-only <last-doc-sha> HEAD
git status --short
git diff --stat HEAD
```

Categorize every changed file: API routes, DB schema/migrations, frontend components, services/Docker, config/env, types/interfaces.

---

## Step 3: Survey Changed Source

Read every changed file in the API routes and types categories. Extract:
- HTTP endpoints, request params, response shapes
- Auth requirements, middleware
- New DB tables, columns, indexes
- New Docker services, port changes

---

## Step 4: Update `context/architecture.md`

Rewrite or patch to reflect current state:
- Frontend route map
- Backend route structure + API endpoints
- Database schemas + recent schema changes
- Docker Compose services
- Routing/proxy rules
- Key data flows

Preserve existing content that hasn't changed. Mark deprecated items as `~~strikethrough~~`.

---

## Step 5: Update `context/API.md`

Full API reference — every endpoint, not just changed ones. For each: method, path, query params, request body, response shape, auth requirements, notes.

---

## Step 6: Update `context/diagrams.md`

Mermaid diagrams — create or update:
- System architecture diagram
- Database schema (ERD-style)
- Key data flow (main workflow)
- API call map (frontend → backend)

Keep diagrams accurate to the code. A wrong diagram is worse than no diagram.

---

## Step 7: Stage, Commit, and Push

```bash
git add context/architecture.md context/API.md context/diagrams.md
# Add specific source files that changed
git commit -m "docs(ndt-portal-v1): update architecture, API ref, and diagrams

Captures changes since [last-doc-sha-short]:
- [major source change 1]
- [major source change 2]

Updated:
- context/architecture.md — [what was updated]
- context/API.md — [what was added/changed]
- context/diagrams.md — [which diagrams were refreshed]

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

git push origin [current-branch]
```

---

## Step 8: Report

```
## Docs Updated — NDT Portal v1

**Commit:** [sha] on [branch]
**Pushed:** [remote URL / branch]

### Source changes captured:
- [bullet per meaningful source change]

### Docs refreshed:
- **architecture.md** — [what changed]
- **API.md** — [endpoints added/updated]
- **diagrams.md** — [which diagrams regenerated]

### Files committed: [N files, +X −Y lines]
```

## Notes

- Never commit secrets (`.env`, `*.key`) — skip and warn
- Mermaid accuracy over completeness
- Running this command twice should produce a clean `git status` on the second run
