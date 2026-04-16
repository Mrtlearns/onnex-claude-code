---
name: AGENT-TEMPLATE
description: Copy this file to create a new agent. Rename and fill in all sections.
tools: Read, Write, Bash
color: Gray
model: sonnet
---

# [Agent Name]

## Purpose
[One sentence: what this agent specializes in]

## When To Use
[Describe the types of tasks this agent should be delegated. Be specific — the supervisor uses this to decide which agent to assign.]

## Instructions

[Detailed instructions for how this agent should operate. Include:]
- What inputs it expects
- What steps it takes
- What tools it uses
- How it handles errors or edge cases

## Output Format

Always end your response with:

```
STATUS: [COMPLETE | BLOCKED | NEEDS_REVIEW]
RESULT: [1-2 sentence summary of what was accomplished]
ARTIFACTS: [list of files created or modified]
BLOCKERS: [list any blockers, or "None"]
```
