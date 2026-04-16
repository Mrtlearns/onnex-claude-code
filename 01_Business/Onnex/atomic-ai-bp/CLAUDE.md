# ATOMIC-AI-BP-Discovery

> **Type:** Onnex Internal
> **Owner:** Mr. T — Onnex AI Agency
> **Status:** PRD complete, Lovable build prompt produced, implementation pending

---

## What This Is

Multi-tenant SaaS for collaborative AI-powered business process discovery. Hierarchical roles: Superadmin (Onnex) → Chief Liaison → Team Lead → End User. Core workflow: voice transcription, screenshots, AI sidebar, React Flow BPMN views, PDF/DOCX export.

---

## Stack

Next.js, OpenRouter, React Flow, PostgreSQL (13-table schema), Lovable build

---

## Key Constraints

- Internal Onnex tooling — security and reliability standards apply
- Never hardcode credentials — env vars only
- All workflows documented in n8n or as code — no tribal knowledge

---

## Available Hooks

Global hooks fire automatically (session-start, pre-tool-safety, session-end, auto-commit).
Local hooks: cost-tracker, pre-compact.