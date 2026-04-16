# /import-plan

Convert an existing planning document (from Claude chat, Notion, a doc, etc.) into a fully-populated GSD `.planning/` directory — ready to start executing, not just drafting.

## Usage

```
/import-plan <project-slug>
```

**Before running:** save your planning content to:
```
<project-slug>/PLANNING-IMPORT.md
```

---

## What to Do

### Step 1 — Find and read the planning input

Look for `PLANNING-IMPORT.md`. If it doesn't exist, ask the user to create it and paste their planning content into it, then re-run.

### Step 2 — Parse the planning document

Extract: project definition, technical decisions, domain model, phases/milestones, requirements, open questions/risks.

### Step 3 — Assess completeness

| Level | Condition | GSD entry point |
|-------|-----------|-----------------|
| **Full** | Stack decided, phases defined, requirements written | Skip discuss → `/gsd:plan-phase 1` |
| **Partial** | Domain clear, stack partially decided, phases rough | `/gsd:discuss-phase 1` with pre-loaded context |
| **Vision only** | What/why clear, how/stack not decided | `/gsd:discuss-phase 1` from scratch |

### Step 4 — Create/update the project scaffold

Create `.planning/` with fully specific content (no "TBD" unless genuinely unknown):

- `config.json` — standard GSD v2.0 config
- `PROJECT.md` — fully populated from the import
- `STATE.md` — reflects planning stage
- `MILESTONES.md` — real milestones with specific deliverables
- `ROADMAP.md` — real phases with specific goals and success criteria
- `REQUIREMENTS.md` — real requirements as checkboxes
- `phases/01-foundation/01-CONTEXT.md` — if stack is decided, fully populate

### Step 5 — Delete the import file

```bash
rm PLANNING-IMPORT.md
```

### Step 6 — Report and recommend next step

```
✓ Imported planning into .planning/

Planning completeness: [Full / Partial / Vision only]

Files created/updated:
  ✓ config.json
  ✓ PROJECT.md      — [N] decisions documented, [N] open questions remain
  ✓ STATE.md
  ✓ MILESTONES.md   — [N] milestones defined
  ✓ ROADMAP.md      — [N] phases defined
  ✓ REQUIREMENTS.md — [N] requirements captured
  ✓ phases/01-.../01-CONTEXT.md
  ✗ PLANNING-IMPORT.md deleted

Open questions still to resolve:
  - [list anything genuinely undecided]

Recommended next step:
  [/gsd:plan-phase 1] or [/gsd:discuss-phase 1]
```
