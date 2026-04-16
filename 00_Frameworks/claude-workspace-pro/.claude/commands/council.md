---
name: council
description: >
  Multi-perspective analysis for hard decisions. Convenes a "council" of distinct viewpoints
  to argue positions, surface trade-offs, and reach a synthesized recommendation. Use for
  architecture choices, product strategy, build-vs-buy decisions, or any decision where
  you want adversarial thinking before committing.
  Triggers on: "/council", "get multiple perspectives", "debate this", "what are the trade-offs"
---

# /council — Multi-Perspective Decision Analysis

Use when a decision has significant consequences and you want adversarial thinking
before committing. Council members argue positions — they don't hedge.

## How to Convene the Council

**Step 1 — State the decision question clearly**
One sentence: "Should we X or Y?" or "What's the best approach to Z?"

**Step 2 — Select council members**
Pick 3-5 roles appropriate to the decision:

| Role | Perspective |
|------|------------|
| Pragmatist | Ships fast, values simplicity, "what actually works" |
| Architect | Long-term structure, maintainability, technical debt |
| Security Officer | Threat model, attack surface, compliance |
| Product Manager | User value, scope, timeline |
| Devil's Advocate | Finds flaws in all positions, challenges assumptions |
| Domain Expert | Deep knowledge of the specific problem space |

**Step 3 — Each member argues their position**
Each council member gets a turn. They:
- State their position clearly (one sentence)
- Provide their strongest 2-3 arguments
- Identify the biggest risk in their position
- Name the conditions under which they would change their view

**Step 4 — Cross-examination**
Each member responds to the strongest argument from opposing positions.
No strawmanning — engage with the best version of the opposing case.

**Step 5 — Synthesis**
Draw conclusions:
- Where do members agree? (likely true regardless of approach)
- Where do they fundamentally disagree? (the actual decision point)
- What information would resolve the disagreement?
- What is the recommended decision, and under what conditions?

## Output Format

```
## Decision Question
[One sentence]

## Council Positions

### [Role 1]
Position: [one sentence]
Arguments:
1. ...
2. ...
Key risk: ...
Would change view if: ...

### [Role 2]
[same format]

[...repeat for all members...]

## Cross-Examination
[Key exchanges and rebuttals]

## Synthesis

**Points of agreement:**
- ...

**Core trade-off:**
[The real decision being made]

**Recommendation:**
[Clear decision + conditions under which it applies]

**Conditions that would reverse this recommendation:**
- ...
```
