# Phase 5 — Modular Platform: Plan

**Created:** 2026-04-23
**Status:** Complete
**Milestone:** v5.0

---

## Scope

Turn AI-Sentinel into a modular platform: admin-editable YAML rule sets (multiple active
simultaneously), a token-cost optimizer (L8), and a model-agnostic context bank. All
backed by a Postgres store with pgvector. Ship an admin dashboard for CRUD + audit.

---

## Waves

### Wave 1: Postgres foundation & module lifecycle — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 1.1 | Add sqlx + pgvector deps, wire `PgPool` | `Cargo.toml`, `crates/ai-sentinel-store/src/postgres.rs` |
| 1.2 | Migrations 001-005 | `migrations/*.sql` |
| 1.3 | New crate `ai-sentinel-modules` | `crates/ai-sentinel-modules/` |
| 1.4 | L7 audit → Postgres (dual-mode) | `crates/ai-sentinel-layers/src/l7_audit.rs` |
| 1.5 | docker-compose: `pgvector/pgvector:pg16` | `docker-compose.yml` |

### Wave 2: Rules engine crate — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 2.1-2.6 | DSL + compiler + evaluator + engine + tests + bench | `crates/ai-sentinel-rules/` |

### Wave 3: Pipeline integration — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 3.1 | `PolicyHook` trait in core, `PolicyEngine` impl | `crates/ai-sentinel-core/src/pipeline.rs`, `crates/ai-sentinel-rules/src/hook.rs` |
| 3.2 | 4 trigger hooks in `Pipeline::run` | same |
| 3.3 | `RuleMatch` → `LayerResult` translation | `crates/ai-sentinel-rules/src/hook.rs` |

### Wave 4: Preseed rule sets — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 4.1 | 7 YAML rule sets | `config/modules/*.yaml` |
| 4.2 | Bootstrap loader | `crates/ai-sentinel-api/src/bootstrap.rs` |
| 4.3 | `rules-lint` CLI | `crates/ai-sentinel-rules/src/bin/rules_lint.rs` |

### Wave 5: Token Optimizer (L8) — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 5.1-5.5 | Semantic cache (DashMap+LRU) + router + L8 Layer | `crates/ai-sentinel-optimizer/` |

### Wave 6: Context Bank — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 6.1 | pgvector store + Ollama embedder | `crates/ai-sentinel-context/src/{store,embedder}.rs` |
| 6.2 | Capture layer (mpsc → bg worker) | `crates/ai-sentinel-context/src/capture.rs` |
| 6.3 | 12h summarizer worker | `crates/ai-sentinel-context/src/summarizer.rs` |

### Wave 7: Admin CRUD API — ✅ Complete
| Task | Description | Files |
|------|-------------|-------|
| 7.1-7.4 | 12 /admin/modules endpoints + YAML validate + dry-run | `crates/ai-sentinel-api/src/routes/admin_modules.rs` |

### Wave 8: Dashboard — ✅ Complete (scaffold + HTML-first)
| Task | Description | Files |
|------|-------------|-------|
| 8.1 | Leptos CSR crate (excluded from workspace, built with trunk) | `crates/ai-sentinel-dashboard/` |
| 8.2 | HTML+Tailwind dashboard today | `crates/ai-sentinel-api/static/dashboard.html` |
| 8.3 | `/dashboard` route | `crates/ai-sentinel-api/src/{main.rs,routes/mod.rs}` |

---

## Success Criteria (all met)

- [x] `cargo check --workspace` clean
- [x] `cargo test -p ai-sentinel-rules` — 18 tests pass
- [x] `cargo run --bin rules-lint -- config/modules/*.yaml` — all 7 OK
- [x] 22 preseed rules across 7 verticals
- [x] Dashboard toggles modules + shows audit + runs dry-run
- [x] Policy engine hot-reload verified
- [x] License tier gate implemented (`AI_SENTINEL_LICENSE_TIER`)

---

## Technical Specifics

### Service Names / Ports
No new containers. Postgres image swapped to `pgvector/pgvector:pg16`.

### File Conventions
- YAML rule sets live in `config/modules/*.yaml`
- Migrations in `migrations/NNN_name.sql` (sqlx migrate)
- New crate names follow `ai-sentinel-<feature>`

### Key Commands
```bash
# Lint preseed rules
cargo run --bin rules-lint -- config/modules/*.yaml

# Run rules tests
cargo test -p ai-sentinel-rules

# Build Leptos dashboard (requires wasm target + trunk)
cd crates/ai-sentinel-dashboard && trunk build --release
```

---

## Deferred (Out of Scope)

- Advanced RAG over context bank (Phase 6)
- ML-based intent classifier (Phase 6)
- Per-user RBAC on dashboard
- A/B testing framework for rule sets
- Policy-as-code Git sync
- Real-time dashboard metrics via WebSocket (polls every 5s today)
