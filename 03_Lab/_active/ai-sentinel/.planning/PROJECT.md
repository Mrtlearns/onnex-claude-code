# AI-Sentinel (AgentSec)

> Enterprise AI security sidecar — 8-layer protection for every LLM call

---

## What We're Building

AI-Sentinel is a language-agnostic, HTTP-based security sidecar built in Rust. It deploys alongside any agent runtime and enforces layered, configurable protection on every inbound and outbound AI call via a single `POST /check` endpoint. No modification to underlying agent code required.

Built by Onnex as a reusable infrastructure component deployable across all AI-OS verticals (PI Lawyer OS, NDT Portal, etc.) and as a standalone enterprise product.

**Current Milestone:** v1.0 — AgentSec Core Build (Phase 1 Planned)

---

## Tech Stack (Locked)

| Layer | Technology | Notes |
|-------|-----------|-------|
| Language | Rust (stable ≥1.75) | Memory safety, single static binary, minimal CVE surface |
| HTTP framework | axum | Async, tower middleware, ergonomic routing |
| Async runtime | tokio | Full async stack |
| Session store — memory | DashMap | Default, zero-dependency |
| Session store — cache | Redis (deadpool-redis) | Production option |
| Session store — persistent | PostgreSQL (sqlx) | Audit + telemetry persistence |
| PII detection | Microsoft Presidio sidecar | 10ms timeout, regex fallback |
| Threat intel | CrowdSec CTI + NVD + OWASP LLM Top 10 | Live feed, hot-swap |
| Auth | JWT Bearer + SHA-256 API key hash | jsonwebtoken + sha2/hmac |
| Deployment | Docker Compose (4 containers) | Traefik edge, non-root uid 65534 |
| Observability | Prometheus + OpenTelemetry + stdout | prometheus-client + tracing |
| API docs | OpenAPI 3.1 (utoipa) + Scalar browser | GET /openapi.json + GET /docs |
| Build VM | Ubuntu 24.04 @ 10.10.111.36 | ai-sentinel-build |
| Live domain | ai-sentinel.on-nex.us | Traefik TLS termination |
| Env prefix | `AI_SENTINEL_` | All config variables |

---

## Eight-Layer Security Stack

| Layer | Direction | Purpose | Phase 1 |
|-------|-----------|---------|---------|
| L0 — Telemetry Envelope | Both (async) | Full-fidelity observability — wraps entire pipeline | ✅ Full |
| L1 — Input Sanitization | Ingress | Prompt injection detection, token budget, PII detect/strip | ✅ Full |
| L2 — Identity & Trust | Ingress | Auth (JWT/API key), trust chain (HMAC), threat intel feed, MCP env filter | ✅ Full |
| L3 — Semantic Intent Guard | Ingress | Behavioral drift / salami-slicing detection | 🔲 Stub |
| L4 — Tool & Action Authorization | Ingress | RBAC tool allowlist, destructive action gate, CVE-mapped patterns | ✅ Full |
| L5 — Execution Sandbox | Ingress | Token bucket rate limit, daily cost cap, emergency stop | ✅ Full |
| L6 — Output Inspection | Egress | SSRF protection, exfiltration patterns, egress PII scan | 🔲 Stub |
| L7 — Audit & Telemetry | Both (async) | SHA-256 hash-chained tamper-evident audit log | ✅ Full |

L3 and L6 stubs: `applies_to` returns false, `check()` returns `Ok(Pass)` — interface complete, implementation deferred to Phase 2.

---

## Call Flow

```
Ingress path:
  Caller → POST /check (direction: ingress)
    → L1 (injection/PII) → L2.1 (auth) → L2.2 (trust) → L2.3 (threat)
    → L4 (tool authz) → L5 (rate/cost) → L7 async audit
    → Response: pass (forward to LLM) or reject (return error)

Egress path:
  POST /check (direction: egress)
    → L6 (SSRF/exfil/PII) → L7 async audit
    → Response: pass (deliver to caller) or reject
```

---

## Crate Structure

```
ai-sentinel/
├── crates/
│   ├── ai-sentinel-core/      # Layer trait, types, pipeline runner, session trait, config
│   ├── ai-sentinel-layers/    # L0–L7 implementations
│   ├── ai-sentinel-feed/      # Threat intel worker (CrowdSec, NVD, OWASP, custom)
│   ├── ai-sentinel-store/     # Session + audit backends (memory, Redis, Postgres)
│   └── ai-sentinel-api/       # axum HTTP service + binary
├── config/
│   ├── default.toml           # All Phase 1 layers enabled, memory store
│   ├── minimal.toml           # L0 + L1 + L7 only
│   └── enterprise.toml        # All layers, Postgres, OpenTelemetry
├── tests/integration/         # 5 integration test files
└── scripts/                   # Python paramiko deploy scripts
```

---

## Callers

Any HTTP client that can POST JSON — n8n, Temporal, raw Anthropic SDK, Claude Code, custom agents, API gateways.

---

## Deployment Model

- Standalone sidecar microservice (not embeddable library at Phase 1)
- Single integration point: `POST /check` before LLM call (ingress) and after LLM response (egress)
- 4-container docker-compose: agentsec + presidio-analyzer + postgres:16-alpine + redis:7-alpine
- Traefik for TLS termination at ai-sentinel.on-nex.us

---

## Phase Roadmap Summary

| Phase | Name | Milestone | Status |
|-------|------|-----------|--------|
| 1 | AgentSec Core Build | v1.0 | Planned |
| 2 | Semantic Intent + Egress Inspection | v2.0 | Not started |
| 3 | SDK + SaaS + Multi-tenant | v3.0 | Not started |
