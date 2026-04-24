---
gsd_state_version: 1.0
milestone: v5.0
milestone_name: modular-platform
status: "Phase 5 Code Complete — Modular Platform"
last_updated: "2026-04-23"
last_activity: "2026-04-23 — Phase 5 code complete: 4 new crates, 5 migrations, 22 preseed rules, 18 unit tests green, workspace compiles clean"
progress:
  total_phases: 5
  completed_phases: 5
  total_plans: 5
  completed_plans: 5
---

# AI-Sentinel — State

## Current Position

**All 5 phases code-complete.** AI-Sentinel v5.0 turns the fixed 8-layer gateway into a
modular platform with admin-editable rule sets, token-cost optimizer, and model-agnostic
context bank.

- **L0-L8** pipeline (L8 = token optimizer) + 4 policy trigger hooks
- **4 new crates**: `ai-sentinel-modules`, `ai-sentinel-rules`, `ai-sentinel-optimizer`, `ai-sentinel-context`
- **Dashboard**: HTML+Tailwind served from axum today; Leptos WASM scaffold in repo
- **Postgres**: sqlx migrations (5 files) + pgvector; audit chain migrated from in-memory
- **7 preseed rule sets** lint clean — 22 rules across K-12, higher-ed, corporate, HIPAA, legal-PI, PCI-DSS, dev-lab
- **18 unit tests** green across rules + optimizer + dsl
- Workspace `cargo check --workspace` clean

---

## Phase Table

| Phase | Name | Status | Done |
|-------|------|--------|------|
| 1 | AgentSec Core Build | **Complete** | 100% |
| 2 | Semantic Intent + Egress Inspection | **Complete** | 100% |
| 3 | SDK + SaaS + Multi-tenant | **Complete** | 100% |
| 4 | Gateway MVP (Network MITM Proxy) | **Complete** | 100% |
| 5 | Modular Platform (Rules/Optimizer/ContextBank/Dashboard) | **Complete** | 100% |

---

## Phase 5 Deliverables

### New crates
| Crate | Purpose |
|-------|---------|
| `ai-sentinel-modules` | Module lifecycle — kind enum, Postgres CRUD, SHA-256 CRUD audit chain, license tier |
| `ai-sentinel-rules` | YAML DSL + compiler + evaluator + `PolicyEngine` hot-reload + `PolicyHook` bridge to core |
| `ai-sentinel-optimizer` | L8 layer: semantic cache (DashMap + LRU) + model router (heuristic complexity) |
| `ai-sentinel-context` | pgvector-backed capture + embedder (Ollama) + 12h summarizer |

### Migrations (`migrations/`)
- `001_modules.sql` — modules / module_versions / module_audit
- `002_rules.sql` — rule_sets / rule_evaluations
- `003_context.sql` — CREATE EXTENSION vector + context_entries / context_summaries + HNSW indexes
- `004_audit.sql` — durable pipeline audit chain
- `005_optimizer.sql` — cache_entries warmup snapshot

### Pipeline changes
- `Pipeline` now accepts `PolicyHook` via `with_policy()`; evaluates at 4 triggers:
  pipeline-start (ingress/egress), L4 entry (tool_call), cost_threshold + token_budget after layers
- L8 optimizer registered between L2_Threat and L3_Intent (ingress only)

### Admin API (12 new endpoints)
- `GET /admin/modules`, `GET /admin/modules/:id`, `PUT /admin/modules/:id` (ETag), `DELETE /admin/modules/:id`
- `POST /admin/modules/:id/enable` | `disable`
- `GET /admin/modules/:id/versions`, `POST /admin/modules/:id/revert/:version`
- `GET /admin/modules/:id/audit`
- `POST /admin/rules/validate`, `POST /admin/rules/dry-run`

### Dashboard
- `GET /dashboard` — HTML+Tailwind (served from `static/dashboard.html`) with modules list,
  enable/disable toggles, audit verify, dry-run tester
- `crates/ai-sentinel-dashboard/` Leptos CSR scaffold for richer follow-up build

### Preseed rule sets (`config/modules/`)
| Vertical | Tier | Rules | Highlights |
|----------|------|-------|------------|
| education-k12 | pro | 4 | homework-completion block, age-inappropriate block, student-name redact, after-hours warn |
| education-higher-ed | pro | 3 | direct-copy warn, research-scope allow, exam-term flag |
| corporate-default | basic | 3 | secrets block, egress PII redact, cost guardrail |
| healthcare-hipaa | enterprise | 3 | PHI ingress/egress, BAA-only providers |
| legal-pi | pro | 3 | privilege-route, settlement redact, opposing-counsel flag |
| financial-pci-dss | enterprise | 3 | PAN/CVV block both directions |
| dev-agent-lab | basic | 3 | observation-only warnings |

Total: **7 modules, 22 rules** — all lint clean via `cargo run --bin rules-lint`.

---

## Locked Decisions (Phase 5 additions)

| Decision | Value |
|----------|-------|
| DSL format | YAML (serde_yaml) |
| Rule triggers | 7: ingress/egress/tool_call/session_start/session_end/cost/token |
| Rule actions | 9: allow/reject/redact/warn/rewrite/rate_limit/route_to_model/forward/run_layer |
| Evaluator priority merge | reject > forward > run_layer > route > rewrite > redact > rate_limit > warn > allow |
| Engine hot-reload | ArcSwap + DashMap (zero lock on eval) |
| Perf budget | <200 µs idle, <1 ms for 50 rules (criterion bench target) |
| Cache | DashMap + LRU (10k cap, 24h TTL) + Postgres warmup snapshot |
| Embedding model | `nomic-embed-text` via Ollama (768 dims) |
| Summary cadence | 12h interval per caller_id |
| Dashboard | HTML+Tailwind today; Leptos CSR scaffold for follow-up |
| License tiers | basic / pro / enterprise |

---

## Session Log

| Date | Activity |
|------|----------|
| 2026-03-25 | GSD .planning/ scaffold created |
| 2026-03-25 | Architecture digested; all planning files rewritten; Phase 1 PLAN.md created |
| 2026-03-25 | Phase 1 complete: 8-layer pipeline, 14 verification points, 4-container stack |
| 2026-03-25 | Phase 2 complete: L3 (hash-projection drift) + L6 (SSRF/exfil/egress-PII), 20/20 tests |
| 2026-03-25 | Phase 3 complete: Python SDK, white-label profiles, L3 threshold tuned, 22/22 tests |
| 2026-04-20 | Council: gateway vs sidecar architecture decision — gateway wins with 3 hard gates |
| 2026-04-20 | Phase 4 planned: network-layer MITM proxy, 5 waves, 5 new crates, PLAN.md created |
| 2026-04-20 | Phase 4 code complete: classifier + proxy + gateway.toml + compose |
| 2026-04-21 | Phase 4 smoke tests pass: all 5 tests on 10.10.110.36:8081 |
| 2026-04-23 | Phase 5 planned + executed: 4 crates, 5 migrations, 7 preseeds, dashboard; 18 tests green |
