---
name: Task completion format — split To-Do sections
description: Task summary must split remaining work into To-Do (Claude) and To-Do (MrT), ending with "Done MrT"
type: feedback
---

Always end task summaries with two separate To-Do sections and a closing line:

```
To-Do (Claude):
- ...

To-Do (MrT):
- ...

Done MrT
```

**Why:** Mr. T wants to immediately see what's on him vs what Claude is still handling, and "Done MrT" signals clearly that Claude is finished and not waiting on anything.

**How to apply:** Every task completion summary, globally across all projects. If Claude has nothing pending write "None" under To-Do (Claude). If MrT has nothing pending write "None" under To-Do (MrT). The "Done MrT" line is always last.
