# AI-Sentinel

> **Type:** Lab → Active (production deployed)
> **Status:** v1.0 deployed at ai-sentinel.on-nex.us (10.10.110.36)
> **Stack:** Rust/Axum, Docker Compose, Python FastAPI (test harness)

---

## What This Is

AI security and monitoring layer for Onnex infrastructure. Runs as a Rust/Axum service that intercepts, inspects, and controls AI API traffic. Acts as a policy enforcement point between Claude Code / n8n agents and the external LLM APIs.

Deployed on `ai-sentinel.on-nex.us` — production on Proxmox.

---

## Workspace Structure

```
ai-sentinel/
├── crates/
│   ├── ai-sentinel-core/    Core pipeline logic
│   ├── ai-sentinel-layers/  Policy enforcement layers
│   ├── ai-sentinel-feed/    Event feed / telemetry
│   ├── ai-sentinel-store/   Persistence layer
│   └── ai-sentinel-api/     Axum HTTP API
├── sdk/                     Python SDK for integration
├── docs/
│   ├── API.md               REST API reference
│   ├── ARCHITECTURE.md      Architecture & developer reference
│   └── INTEGRATION.md       Python SDK integration guide
├── infra/                   Docker Compose, Traefik config
└── tests/                   Integration tests
```

---

## Key API

`POST /check` — primary endpoint. Runs all pipeline layers for a request.
Base URL: `https://ai-sentinel.on-nex.us` (production) or `http://localhost:8080` (local).

---

## Key Constraints
- Rust only for core — no Python in the hot path
- All policy rules must be deterministic and auditable
- Production changes require docker compose pull + restart, not in-place edits
- Never expose raw LLM API keys through the sentinel — proxy only