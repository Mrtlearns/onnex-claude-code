---
name: first-principles
description: >
  First-principles decomposition for complex problems. Strips away assumptions, analogies,
  and conventional wisdom to rebuild understanding from fundamental truths. Use when stuck,
  when existing approaches feel wrong, or when you need to justify a decision from scratch.
  Triggers on: "/first-principles", "break this down", "why are we doing it this way", "from scratch"
---

# /first-principles — First Principles Decomposition

Use when convention is obscuring the right answer. Rethink from the ground up.

## Process

### Step 1 — State the goal
What are we actually trying to achieve? Not the solution — the outcome.
Write it as: "We need [outcome] because [reason]."

### Step 2 — List all current assumptions
What are we taking for granted? What are we doing because "that's how it's done"?
Write down every assumption, even obvious ones.

### Step 3 — Identify the fundamental constraints
What is actually, physically, logically required? Not convention — hard constraints.
A fundamental constraint is something that cannot be changed without changing the goal.

### Step 4 — Rebuild from the constraints
Starting only from the fundamental constraints, design the solution.
Do not carry forward any assumption that isn't required by the constraints.

For each design decision, ask:
- "Is this required by a fundamental constraint, or is it a convention?"
- "What is the simplest thing that satisfies this constraint?"

### Step 5 — Compare to the existing approach
- Where does the first-principles design differ from the current approach?
- For each difference: is the current approach better, worse, or equivalent?
- Which differences are worth acting on?

## Output

```
## Goal
[One sentence — the actual outcome needed]

## Assumptions Identified
1. [Assumption] — [required / convention / worth challenging]
2. ...

## Fundamental Constraints
1. [What is actually required]
2. ...

## First-Principles Design
[The solution rebuilt from constraints only]

## Delta from Current Approach
| Decision | Current | First-Principles | Action |
|----------|---------|-----------------|--------|
| [decision] | [current choice] | [fp choice] | [keep/change/investigate] |

## Recommended Changes
[Which differences are worth acting on, and why]
```
