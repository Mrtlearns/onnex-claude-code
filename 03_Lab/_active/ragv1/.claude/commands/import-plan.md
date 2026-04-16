# /import-plan

Convert an existing planning document (from Claude chat, Notion, a doc, etc.) into a fully-populated GSD `.planning/` directory — ready to start executing, not just drafting.

## Usage

```
/import-plan <project-slug>
```

The project may or may not already exist under `projects/`. Either is fine.

**Before running:** save your planning content to:
```
projects/<project-slug>/PLANNING-IMPORT.md
```
(paste it in, dump the chat, export from Notion — any format works)

---

## What to Do

### Step 1 — Find and read the planning input

Look for `projects/<project-slug>/PLANNING-IMPORT.md`. If it doesn't exist, tell the user to create it and paste their planning content into it, then re-run the command.

### Step 2 — Parse the planning document

Extract everything you can find. Look for (but don't require all of):

**Project definition:**
- What it builds, for whom, why it matters
- Target vertical / customer persona
- Core problem being solved

**Technical decisions:**
- Tech stack choices (frontend, backend, database, auth, infra, AI)
- Architecture decisions (monolith vs. services, hosting, deployment model)
- Third-party integrations

**Domain model:**
- Key entities / data objects
- Relationships between them
- Status lifecycles, state machines

**Phases / milestones:**
- Work breakdown (even informal: "first we build X, then Y")
- Priorities and sequencing rationale
- Dependencies between workstreams

**Requirements:**
- Feature lists, user stories, acceptance criteria
- Must-haves vs. nice-to-haves
- Non-functional requirements (performance, security, compliance)

**Open questions / risks:**
- Anything flagged as undecided
- Risks or blockers identified
- Assumptions made

### Step 3 — Assess completeness

Determine how far the planning goes:

| Level | Condition | GSD entry point |
|-------|-----------|-----------------|
| **Full** | Stack decided, phases defined, requirements written | Skip discuss → `/gsd:plan-phase 1` |
| **Partial** | Domain clear, stack partially decided, phases rough | `/gsd:discuss-phase 1` with pre-loaded context |
| **Vision only** | What/why clear, how/stack not decided | `/gsd:discuss-phase 1` from scratch (but richer PROJECT.md) |

Tell the user which level they're at and what's still open.

### Step 4 — Create/update the project scaffold

Create or update `projects/<project-slug>/.planning/` with **fully specific content** (no "TBD", no "draft" markers unless genuinely unknown):

**`config.json`** — standard GSD v2.0 config

**`PROJECT.md`** — fully populated from the import:
- What we're building (from planning)
- Current milestone with real goal
- Tech stack table — use actual decisions, not TBD
- Architecture decisions already made
- Deployment details if known
- Resolved decisions table
- Open questions (only genuinely unresolved items)

**`STATE.md`** — reflects planning stage:
- If no code exists: `status: "Planning complete — ready to execute Phase 1"`
- Phase progress: all phases listed with status "Not started"
- Key decisions table populated from planning
- Session log entry: "Imported planning from [source]"

**`MILESTONES.md`** — real milestones with specific deliverables (not generic candidates)

**`ROADMAP.md`** — real phases with specific goals and success criteria derived from the planning. No "TBD" on phase names or goals.

**`REQUIREMENTS.md`** — real requirements as checkboxes, grouped by phase/milestone, derived from feature lists in the planning document

**`phases/01-foundation/01-CONTEXT.md`** — if stack is decided, fully populate:
- `<domain>` — exact scope of Phase 1
- `<decisions>` — all tech/arch decisions with rationale from planning
- `<specifics>` — service names, ports, env vars, repo layout (if known)
- `<code_context>` — patterns and conventions to follow
- `<deferred>` — what's explicitly out of Phase 1

If stack is NOT decided, leave as placeholder and note what must be resolved.

Repeat for any other phases where context is sufficiently defined.

### Step 5 — Delete the import file

After successful scaffold creation, delete `PLANNING-IMPORT.md`:
```bash
rm projects/<project-slug>/PLANNING-IMPORT.md
```
The planning content is now in the GSD files where it belongs.

### Step 6 — Report and recommend next step

Output a summary:

```
✓ Imported planning into projects/<slug>/.planning/

Planning completeness: [Full / Partial / Vision only]

Files created/updated:
  ✓ config.json
  ✓ PROJECT.md      — [N] decisions documented, [N] open questions remain
  ✓ STATE.md
  ✓ MILESTONES.md   — [N] milestones defined
  ✓ ROADMAP.md      — [N] phases defined
  ✓ REQUIREMENTS.md — [N] requirements captured
  ✓ phases/01-.../01-CONTEXT.md  — [full / placeholder]
  ✗ PLANNING-IMPORT.md deleted

Open questions still to resolve:
  - [list anything genuinely undecided]

Recommended next step:
  [/gsd:plan-phase 1]   ← if planning is full
  [/gsd:discuss-phase 1] ← if partial or vision only
```

Then ask: "Commit this to git?"

---

## Tips for the Planning Import File

The import file can be anything — a Claude.ai chat export, a Notion dump, bullet points, prose. The richer the better. Specifically useful:

- **Paste the Claude chat summary** (Claude.ai → copy conversation)
- **Include decisions AND reasoning** — "we chose X because Y" maps directly to CONTEXT.md `<decisions>`
- **Include rejected options** — "we considered X but ruled it out because..." is valuable context
- **Include exact names** — table names, service names, endpoint paths if discussed
- **Include open questions** explicitly — they become blockers in STATE.md

The command handles messy, unstructured input. Don't clean it up — just paste it.
