# Email Triage

> **Type:** Onnex Internal
> **Owner:** Mr. T — Onnex AI Agency
> **Status:** Architecture designed, implementation pending

---

## What This Is

Hybrid autonomous email triage for 50+ daily emails. n8n for scheduling/API plumbing, Python agentic service on claude-controller for classification using Ollama locally with Claude Haiku fallback. PostgreSQL for few-shot feedback learning.

---

## Stack

n8n, Python, Ollama (local), Claude Haiku (fallback), PostgreSQL, Gmail API

---

## Key Constraints

- Internal Onnex tooling — security and reliability standards apply
- Never hardcode credentials — env vars only
- All workflows documented in n8n or as code — no tribal knowledge

---

## Available Hooks

Global hooks fire automatically (session-start, pre-tool-safety, session-end, auto-commit).
Local hooks: cost-tracker, pre-compact.