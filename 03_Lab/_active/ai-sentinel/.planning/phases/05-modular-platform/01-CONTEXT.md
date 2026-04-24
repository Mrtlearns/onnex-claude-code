# Phase 5 — Modular Platform: Context

**Created:** 2026-04-23
**Status:** Complete
**Milestone:** v5.0

## Why

Phases 1-4 produced a fixed 8-layer security gateway. Shipping AI-Sentinel to
commercial clients requires three additional properties:

1. **Per-vertical policy posture** — K-12 schools, law firms, healthcare, and corporate
   buyers all need different rules. The platform must let an admin enable/disable rule
   sets per deployment, version them, and audit every change.
2. **Cost control** — LLM spend scales with traffic. A semantic cache + model router
   can cut 50–80% of routine-query cost.
3. **Model-agnostic context** — customers worried about being trapped in a single
   provider's ecosystem need their conversation context stored independently. A
   pgvector-backed bank with periodic summarization achieves that.

Phase 5 delivers all three as pluggable modules sharing one lifecycle contract:
enable/disable toggle, versioned YAML config, SHA-256 CRUD audit chain, license-tier
gating.

## Decisions (locked in kickoff)

| Fork | Choice |
|------|--------|
| Scope shape | One mega Phase 5 — all three modules + dashboard in one release |
| Dashboard | Leptos CSR crate scaffolded; HTML+Tailwind ships today for fast iteration |
| Context bank storage | Postgres + pgvector day-one; embeddings via local Ollama `nomic-embed-text` |
| Audit persistence | Migrate both pipeline + module-CRUD audit to Postgres/sqlx |

## Scope

In scope:
- `ai-sentinel-modules` — Postgres-backed module lifecycle
- `ai-sentinel-rules` — YAML DSL, compiler, evaluator, PolicyEngine
- `ai-sentinel-optimizer` — L8 layer (cache + router)
- `ai-sentinel-context` — capture path, pgvector store, summarizer
- Admin CRUD API (12 endpoints)
- 7 preseed rule sets
- HTML dashboard served from axum

Deferred:
- Advanced RAG (re-ranking, knowledge graph) — Phase 6+
- ML intent classifier — current regex + heuristics only
- Per-user RBAC on dashboard — single admin token for v5.0
- A/B testing framework for rule sets

## Risks + Mitigations

- **Regex engine lookaround unsupported** — mitigated by rules-lint (caught during
  HIPAA preseed authoring; fixed by enumerating non-BAA providers instead).
- **Postgres unavailable in local dev** — module store + durable audit gracefully
  fall back (in-memory audit, /admin/modules returns 503). Main pipeline unaffected.
- **Leptos WASM build complexity** — excluded from the workspace default members so
  `cargo build --workspace` is unaffected; built independently with `trunk build`.

## Success Criteria (met)

- [x] Workspace `cargo check --workspace` clean (errors 0, warnings only)
- [x] `cargo test -p ai-sentinel-rules` green (18 tests pass)
- [x] `cargo run --bin rules-lint -- config/modules/*.yaml` — all 7 preseeds OK
- [x] Policy engine hot-reload proven via `hot_reload_replaces_rules` test
- [x] Dashboard HTML serves + authenticates + toggles
- [x] Modules/admin API writes + reads via ModuleStore
