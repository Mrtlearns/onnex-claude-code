---
name: Execute tasks autonomously — don't list steps for MrT to do
description: If Claude can execute a step (SSH, deploy, run scripts), do it. Don't list it as a MrT action.
type: feedback
---

When Claude has the tools and access to complete a step, execute it directly. Do not put it in "To-Do (MrT)" just because it involves a server, script, or deployment.

**Why:** Mr. T expects Claude to use available access (SSH, MCP tools, Bash) to complete the full task, not hand back a list of commands to run manually.

**How to apply:** Before writing anything under "To-Do (MrT)", ask: "Can I do this myself?" If yes — do it. Only assign to MrT things that genuinely require human judgement, credentials Claude doesn't have, or physical actions.
