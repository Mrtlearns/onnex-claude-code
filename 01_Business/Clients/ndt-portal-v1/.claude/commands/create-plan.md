# Plan

Create a detailed implementation plan for changes to this workspace. Plans are thorough documents that capture the full context, rationale, and step-by-step tasks needed to execute a change with complete alignment across the project.

## Variables

request: $ARGUMENTS (describe what you want to plan — new command, new workflow, structural change, template update, etc.)

---

## Instructions

- **IMPORTANT:** You are creating a PLAN, not implementing changes. Research thoroughly, think deeply, then output a comprehensive plan document.
- Use your reasoning capabilities to think hard about the request, workspace structure, and best approach.
- Research the workspace to understand existing patterns, conventions, and how this change fits.
- Create the plan in the `plans/` directory with filename: `YYYY-MM-DD-{descriptive-name}.md`
  - Use today's date
  - Replace `{descriptive-name}` with a short, kebab-case name (e.g., "add-guest-research-command", "restructure-outputs", "create-outreach-workflow")
- Fill out every section of the Plan Format below. Replace all `<placeholders>` with specific, actionable content.
- Be thorough — this plan will be executed by `/implement` and needs enough detail to execute without ambiguity.
- Follow existing patterns. Study similar files in the workspace before proposing new structures.

---

## Research Phase

Before writing the plan, investigate:

1. **Read core reference files:**
   - `CLAUDE.md` — workspace overview
   - `context/` — background context on the user and project

2. **Explore relevant areas:**
   - If creating a command: read existing commands in `.claude/commands/`
   - If modifying outputs: explore `outputs/` structure and examples
   - If updating templates: check `reference/` for existing patterns
   - If adding scripts: review `scripts/` for conventions

3. **Understand connections:**
   - How does this change relate to existing workflows?
   - What files reference or depend on areas being changed?
   - Are there naming conventions to follow?

---

## Plan Format

Write the plan using this exact structure:

```markdown
# Plan: <descriptive title>

**Created:** <YYYY-MM-DD>
**Status:** Draft
**Request:** <one-line summary of what was requested>

---

## Overview

### What This Plan Accomplishes

<2-3 sentences describing the end result and why it matters>

### Why This Matters

<Connect this change to the project's goals or mission. How does this add value?>

---

## Current State

### Relevant Existing Structure

<List files, folders, or patterns that exist and relate to this change>

### Gaps or Problems Being Addressed

<What's missing, broken, or suboptimal that this plan fixes?>

---

## Proposed Changes

### Summary of Changes

<Bulleted list of all changes at a high level>

### New Files to Create

| File Path         | Purpose                            |
| ----------------- | ---------------------------------- |
| `path/to/file.md` | Description of what this file does |

### Files to Modify

| File Path         | Changes                      |
| ----------------- | ---------------------------- |
| `path/to/file.md` | Description of modifications |

### Files to Delete (if any)

<List any files being removed and why>

---

## Design Decisions

### Key Decisions Made

1. **<Decision>**: <Rationale>
2. **<Decision>**: <Rationale>

### Alternatives Considered

<What other approaches were considered and why they were rejected?>

### Open Questions (if any)

<List any decisions that need user input before implementation>

---

## Step-by-Step Tasks

Execute these tasks in order during implementation.

### Step 1: <Task Title>

<Detailed description of what to do>

**Actions:**
- <Specific action>
- <Specific action>

**Files affected:**
- `path/to/file.md`

---

## Validation Checklist

- [ ] <Verification step>
- [ ] CLAUDE.md updated if structure changed

---

## Success Criteria

1. <Specific, measurable criterion>
2. <Specific, measurable criterion>
```

---

## Report

After creating the plan:

1. Provide a brief summary of what the plan covers
2. List any open questions that need user input before implementation
3. Provide the full path to the plan file: `plans/YYYY-MM-DD-{name}.md`
4. Remind user to run `/implement plans/YYYY-MM-DD-{name}.md` to execute
