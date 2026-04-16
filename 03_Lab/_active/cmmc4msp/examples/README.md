# Examples

This folder contains code examples that Claude uses as patterns when implementing features.

**This folder is critical.** AI coding assistants perform significantly better when they can see patterns to follow rather than inventing from scratch.

## What to Put Here

Add examples that show:

- **Code structure patterns** — how you organize modules, imports, classes
- **Integration patterns** — how you connect to APIs, databases, external services  
- **n8n workflow patterns** — partial workflow JSONs showing how you wire nodes
- **Error handling** — how you handle and log errors in this project
- **Testing patterns** — how tests are structured and what they cover
- **SAP integration patterns** — ABAP snippets, RFC call patterns, BAPI usage

## How Claude Uses These

When you run `/generate-prp`, Claude reads this folder to understand your patterns.
When you run `/execute-prp`, Claude follows these patterns when writing new code.
When agents build workflows, they reference examples here for consistency.

The more relevant examples you add, the more consistent and on-pattern the output will be.
