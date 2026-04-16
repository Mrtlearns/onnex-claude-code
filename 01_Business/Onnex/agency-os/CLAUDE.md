# Agency OS

> **Type:** Onnex Internal
> **Owner:** Mr. T — Onnex AI Agency
> **Status:** Design phase — framework mapped, implementation pending

---

## What This Is

Onnex internal operating system. Implements the 8 Figure Agency 13-system framework mapped to ATOM phases and QDOAA gates. Automates Onnex's own delivery, sales, and operations.

---

## Stack

n8n, PostgreSQL, FastAPI, Next.js, Docker

---

## Key Constraints

- Internal Onnex tooling — security and reliability standards apply
- Never hardcode credentials — env vars only
- All workflows documented in n8n or as code — no tribal knowledge

---

## Available Hooks

Global hooks fire automatically (session-start, pre-tool-safety, session-end, auto-commit).
Local hooks: cost-tracker, pre-compact.