# /new-project

Create a new sub-project scaffold with a fully bootstrapped GSD `.planning/` directory.

## Usage

```
/new-project <project-slug> "<One-line description>"
```

If called with no arguments, ask the user for the project slug and description before proceeding.

---

## What to Do

### Step 1 — Gather inputs

- `PROJECT_SLUG` — kebab-case directory name
- `PROJECT_DESCRIPTION` — one sentence describing what it builds and for whom
- If not provided, ask before continuing

### Step 2 — Create directory structure

```
<PROJECT_SLUG>/
  .planning/
    config.json
    PROJECT.md
    STATE.md
    MILESTONES.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
      01-foundation/
        01-CONTEXT.md
```

### Step 3 — Populate each file

**`config.json`** — standard GSD v2.0 config:
```json
{
  "version": "2.0",
  "project": "<PROJECT_SLUG>",
  "mode": "interactive",
  "granularity": "standard",
  "profile": "balanced",
  "git_strategy": "phase",
  "toggles": {
    "research": false,
    "discuss": true,
    "plan_check": true,
    "verifier": true,
    "nyquist": false
  },
  "workflow": {
    "_auto_chain_active": false
  }
}
```

**`PROJECT.md`** — expand the description into full product context, tech stack (Onnex defaults: Claude API, n8n, PostgreSQL, Docker Compose), core domain concepts, AI opportunities, open questions.

**`STATE.md`** — frontmatter + session log with today's entry.

**`MILESTONES.md`** — v0 (current), v1.0+, inferred from description.

**`ROADMAP.md`** — 5-7 draft phases, Phase 1 always: Foundation + DB Schema.

**`REQUIREMENTS.md`** — draft requirements as `- [ ]` checkboxes.

**`phases/01-foundation/01-CONTEXT.md`** — placeholder, list key tech decisions to resolve.

### Step 4 — Confirm

```
Created: <PROJECT_SLUG>/.planning/
  ✓ config.json
  ✓ PROJECT.md
  ✓ STATE.md
  ✓ MILESTONES.md
  ✓ ROADMAP.md
  ✓ REQUIREMENTS.md
  ✓ phases/01-foundation/01-CONTEXT.md

Next step: /gsd:discuss-phase 1
```

Ask: "Commit this scaffold to git?"
