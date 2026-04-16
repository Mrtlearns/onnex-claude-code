# Planning Import Prompts

Two prompts for use in Claude.ai (or any LLM) to produce a PLANNING-IMPORT.md
that the `/import-plan` command can consume with maximum fidelity.

---

## PROMPT 1 — Paste at the START of the planning session

> Use this to prime the LLM so it captures decisions correctly throughout the conversation.
> Paste this before you describe your project idea.

---

```
I'm planning a new software project. As we discuss it, I need you to track everything we decide in a structured way, because at the end I'll ask you to export it as a planning document that feeds directly into a code project scaffold.

As we talk, keep a running internal record of:
- Every tech/architecture decision we make AND the reasoning behind it
- Things we explicitly ruled out and why
- Requirements and features we identify (tag as must-have vs. nice-to-have)
- Phases or work breakdown we agree on
- Things that are still open/undecided
- Assumptions we're making

When I say "export plan", produce a structured PLANNING-IMPORT.md document using the exact format I'll share at the end.

Now — here's what I'm building: [DESCRIBE YOUR PROJECT]
```

---

## PROMPT 2 — Paste at the END to produce the export

> Use this after the planning conversation is done.
> It produces the PLANNING-IMPORT.md you paste into your project.

---

```
Now export everything we've discussed as a structured PLANNING-IMPORT.md file.
Use exactly this format — be specific, not generic. Include reasoning for every decision.
If something is genuinely undecided, say so explicitly. Do not fill gaps with plausible-sounding guesses.

---

# PLANNING-IMPORT: [Project Name]

## Project Identity
- **Slug:** [kebab-case-name]
- **Full name:** [Human-readable name]
- **One-liner:** [One sentence — what it builds and for whom]
- **Target vertical:** [Industry / customer type]
- **Core problem solved:** [2-3 sentences — the pain point this eliminates]
- **Why now / why Onnex:** [Why this project, why this moment]

---

## Tech Stack

### Decided
For each item: what was chosen AND why (including why alternatives were rejected).

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Frontend | | |
| Backend | | |
| Database | | |
| Auth | | |
| Automation | | |
| AI / LLM | | |
| File/Doc storage | | |
| Deployment | | |
| CI/CD | | |

### Undecided / Still Open
For each: what the options are, what we're leaning toward, what would break the tie.

- **[Layer]:** Considering [A] vs [B]. Leaning [A] because [reason]. Open question: [what we need to know].

---

## Architecture Decisions

For each significant architectural choice:

### [Decision name]
- **Choice:** [What was decided]
- **Reasoning:** [Why]
- **Rejected alternatives:** [What else was considered and why it lost]
- **Constraints this creates:** [What downstream decisions this locks in]

---

## Domain Model

### Core Entities
For each entity: name, key fields, status lifecycle (if any), relationships.

#### [EntityName]
- **Purpose:** [What it represents]
- **Key fields:** [field: type — description]
- **Status lifecycle:** [state1 → state2 → state3] (if applicable)
- **Relationships:** [links to other entities]

### Critical Business Rules
- [Rule 1 — constraint or invariant the system must enforce]
- [Rule 2]

---

## Phases / Work Breakdown

### Phase 1 — [Name]
- **Goal:** [One sentence]
- **In scope:** [Exact list of what gets built]
- **Out of scope:** [Explicit exclusions — what comes later]
- **Success criteria:** [Observable, testable conditions that prove this phase is done]
- **Dependencies:** [What must exist before this phase can start]

### Phase 2 — [Name]
[same structure]

[Continue for all phases discussed]

---

## Requirements

### Must Have — v1.0
- [ ] [Requirement — specific and testable]

### Must Have — v1.1
- [ ] [Requirement]

### Nice to Have (future)
- [ ] [Requirement]

### Non-Functional Requirements
- [ ] [Performance, security, compliance, scale targets]

---

## Integration Points

For each external system the project touches:

### [System name]
- **Purpose:** [Why we integrate]
- **Direction:** [inbound / outbound / bidirectional]
- **Method:** [API / webhook / file / email]
- **Auth:** [How authentication works]
- **Key data exchanged:** [What goes in/out]

---

## Open Questions

For each unresolved item — do NOT guess an answer:

### [Question]
- **Why it matters:** [What breaks if we get this wrong]
- **Options:** [A, B, C]
- **Leaning:** [Which option and why, or "no lean yet"]
- **What would resolve it:** [Information or decision needed]

---

## Risks & Assumptions

### Assumptions We're Making
- [Assumption] — [consequence if wrong]

### Known Risks
- [Risk] — [likelihood: high/med/low] — [mitigation approach]

---

## Rejected Options Log

Things we explicitly considered and ruled out:

| What | Why considered | Why rejected |
|------|---------------|--------------|
| | | |

---

## AI / Automation Opportunities

Specific use cases where AI or n8n automation adds value in this project:

- **[Use case]:** [Input → what AI does → output] — [value delivered]

---

## Deployment & Infrastructure Notes

- **Hosting:** [Server, VM, cloud — what's decided]
- **Domain/URL:** [If known]
- **Docker Compose structure:** [Services expected, if discussed]
- **Secrets management:** [Approach]
- **Backup/DR:** [If discussed]

---

## Session Summary

- **Date:** [Today's date]
- **What was decided:** [3-5 bullet summary of key decisions made]
- **What's still open:** [3-5 bullet summary of open questions]
- **Confidence level:** [High / Medium / Low — how complete is this planning]
- **Recommended GSD entry point:** [/gsd:plan-phase 1 if complete, /gsd:discuss-phase 1 if gaps remain]
```

---

## Notes on Using These Prompts

**For the start prompt:**
- Paste it literally, then describe your project in the same message
- You don't have to structure your conversation — just talk naturally
- The LLM tracks internally; you won't see the running record mid-conversation

**For the end prompt:**
- Paste it verbatim — the format markers are intentional
- If the LLM skips a section or fills it with "TBD", that's correct — it means it genuinely wasn't discussed
- The output may be long (300-600 lines for a well-planned project) — that's fine, paste all of it

**After export:**
1. Copy the full output
2. In Claude Code: `projects/<slug>/PLANNING-IMPORT.md` → paste it in
3. Run `/import-plan <slug>`
4. The command parses it, builds all GSD files, deletes the import file
5. Proceed with `/gsd:plan-phase 1` or `/gsd:discuss-phase 1` as recommended

**Quality signal:**
A good PLANNING-IMPORT.md has:
- More text in "Reasoning" columns than in "Choice" columns
- At least 3-5 items in "Rejected Options Log"
- Specific field names, not just entity names
- Explicit success criteria per phase (not just goals)
- Open Questions section has real questions, not empty
