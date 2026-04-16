# /new-project

Create a new project under `projects/` with a fully bootstrapped GSD `.planning/` directory and all base docs.

## Usage

```
/new-project <project-slug> "<One-line description>"
```

**Examples:**
```
/new-project hvac-field-os "AI-native field service OS for HVAC companies"
/new-project med-spa-os "Client intake and treatment tracking for medical spas"
```

If called with no arguments, ask the user for the project slug and description before proceeding.

---

## What to Do

### Step 1 — Gather inputs

- `PROJECT_SLUG` — kebab-case directory name (e.g. `hvac-field-os`)
- `PROJECT_DESCRIPTION` — one sentence describing what it builds and for whom
- If not provided, ask before continuing

### Step 2 — Create directory structure

Create the following (do NOT create any code files — just the planning scaffold):

```
projects/<PROJECT_SLUG>/
  .planning/
    config.json
    PROJECT.md
    STATE.md
    MILESTONES.md
    ROADMAP.md
    REQUIREMENTS.md
    phases/
      01-foundation/
        01-CONTEXT.md    ← placeholder, says "run /gsd:discuss-phase 1"
```

### Step 3 — Populate each file

**`config.json`** — standard GSD v2.0 config with `"project": "<PROJECT_SLUG>"`:
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

**`PROJECT.md`** — fill in with what you know from the description:
- What we're building (expand the one-liner into 2-3 sentences of product context)
- Current milestone: `v0 — Discovery & Architecture (Not Started)`
- Tech stack table with `TBD` entries and sensible Onnex-standard defaults (Claude API, n8n, PostgreSQL, Docker Compose)
- Core domain concepts (draft 4-6 bullet points inferred from the description)
- AI opportunities (3-5 automation/AI use cases specific to this vertical)
- Open questions (things to resolve in Phase 1 discussion)

**`STATE.md`** — frontmatter + body:
```yaml
---
gsd_state_version: 1.0
milestone: v0
milestone_name: discovery-architecture
status: "Not started — GSD scaffold initialized"
last_updated: "<TODAY_ISO>"
last_activity: "<TODAY> — GSD .planning/ scaffold created"
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
---
```
Body: current position (not started), phase table (empty), open questions pointer to PROJECT.md, session log with today's entry.

**`MILESTONES.md`** — ladder:
- v0: Discovery & Architecture (current)
- v1.0: Foundation + Core Module (planned — describe based on domain)
- v1.1 onward: domain-specific follow-on milestones inferred from description
- Each milestone: goal statement + 4-6 candidate deliverables

**`ROADMAP.md`** — 5-7 draft phases inferred from the domain:
- Phase 1: Foundation — Docker Stack + DB Schema (always first)
- Phase 2-N: domain-specific phases inferred from the description
- Each phase: goal statement + 3-5 expected success criteria
- Note at top: "Draft — phases to be confirmed in `/gsd:discuss-phase 1`"

**`REQUIREMENTS.md`** — draft requirements grouped by milestone:
- v1.0 section: 10-15 inferred requirements as `- [ ]` checkboxes
- v1.1+: 5-8 requirements per milestone
- Note at top: "Draft — to be detailed during Phase 1 discussion"

**`phases/01-foundation/01-CONTEXT.md`** — placeholder:
- Status: Not written
- List the key tech stack decisions that must be made before planning starts
- Prompt: "Run `/gsd:discuss-phase 1` to define this phase before planning"

### Step 4 — Confirm and commit

After creating all files, display a summary table:

```
Created: projects/<PROJECT_SLUG>/.planning/
  ✓ config.json
  ✓ PROJECT.md
  ✓ STATE.md
  ✓ MILESTONES.md
  ✓ ROADMAP.md
  ✓ REQUIREMENTS.md
  ✓ phases/01-foundation/01-CONTEXT.md

Next step: /gsd:discuss-phase 1
```

Then ask: "Commit this scaffold to git?"
If yes: `git add projects/<PROJECT_SLUG>/` and commit with message:
`chore(<PROJECT_SLUG>): bootstrap GSD .planning/ scaffold`

---

## Notes

- Do NOT scaffold any code, Dockerfile, docker-compose, or src/ files — those come from Phase 1 execution
- The roadmap and requirements are intentionally **draft** — they get refined in `/gsd:discuss-phase 1`
- Onnex standard defaults: Claude API (claude-sonnet-4-6), n8n for automation, PostgreSQL, Docker Compose, Traefik
- If the user provides more context (target vertical, tech preferences, similar existing project), use it to make PROJECT.md and ROADMAP.md more specific
