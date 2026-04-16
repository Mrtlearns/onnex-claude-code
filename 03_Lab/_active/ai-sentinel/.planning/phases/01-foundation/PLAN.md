# Phase 1 — AgentSec Core Build: Plan

**Created:** 2026-03-25
**Status:** Ready
**Milestone:** v1.0

---

## Scope

Build the complete AI-Sentinel v1.0: Rust/axum 8-layer security sidecar deployed to ai-sentinel.on-nex.us. Covers Python deploy scripts, all 5 Rust crates, L0–L7 layer implementations (L3/L6 as stubs), Redis/Postgres backends, admin routes, Prometheus metrics, OpenAPI docs, Dockerfile, docker-compose, and 5 integration test files. Follows the 15-step sequence from AI-SENTINEL-MASTER-BUILD.md.

---

## Waves

### Wave 0 — Pre-Build: VM Verification + Deploy Scripts
**Goal:** Confirm build VM is ready; create all Python paramiko deploy scripts.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 0.1 | SSH into 10.10.111.36, run Part A Section 9 verification checklist (11 points). Provision any missing items (Rust toolchain, Docker, pre-pulled images, project dir). | SSH | No |
| 0.2 | Create `scripts/_config.py` — VM host/user/pass/port, timeouts (short=60s, build=600s, test=300s), local/remote dirs, sync dirs (crates, config, tests), exclude patterns | `scripts/_config.py` | No |
| 0.3 | Create `scripts/deploy_build.py` — paramiko SSH/SFTP, recursive upload with exclusion, cargo check/build --release, PTY stream, flags: default / --release / --check-only / --upload-only | `scripts/deploy_build.py` | No |
| 0.4 | Create `scripts/deploy_containers.py` — docker compose up/down/logs/status/restart, container status inspection, log tailing, flags: --up / --up --build / --status / --logs / --restart \<svc\> | `scripts/deploy_containers.py` | No |
| 0.5 | Create `scripts/verify_build.py` — hit /health, run cargo test on VM, execute 14-point checklist, flags: --health / --all-tests / --checklist | `scripts/verify_build.py` | No |

**Gate:** `python scripts/deploy_build.py --check-only` connects to VM and reports Rust toolchain version.

---

### Wave 1 — Workspace Scaffold + Core Crates (Build Steps 1–3)
**Goal:** Workspace compiles clean; Layer trait, all types, and memory store defined.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Workspace Cargo.toml with 5 member crates + all shared dependencies. Skeleton Cargo.toml per crate. Stub lib.rs for each. | `Cargo.toml`, `crates/*/Cargo.toml`, `crates/*/src/lib.rs` | No |
| 1.2 | `ai-sentinel-core`: error.rs (LayerError), types.rs (all structs/enums from Section 5 of build doc), layer.rs (Layer trait + LayerContext), session.rs (SessionHandle trait), config.rs (AppConfig + LayerConfig), pipeline.rs (Pipeline::new + Pipeline::run with fail-open) | `crates/ai-sentinel-core/src/` | No |
| 1.3 | `ai-sentinel-store` memory backend: DashMap<String, SessionState>, SessionState struct, TTL eviction via background task | `crates/ai-sentinel-store/src/memory.rs` | No |

**Gate:** `cargo check` (via `python scripts/deploy_build.py --check-only`) passes with zero errors.

---

### Wave 2 — API Skeleton + Binary (Build Step 4)
**Goal:** Running HTTP binary responding to /health.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | `ai-sentinel-api/src/main.rs`: AppState (pipeline, store, feed_handle), axum Router, bind on AI_SENTINEL_PORT | `crates/ai-sentinel-api/src/main.rs` | No |
| 2.2 | `routes/health.rs`: GET /health → 200 `{"status":"ok"}`, GET /ready → session store + feed status | `crates/ai-sentinel-api/src/routes/health.rs` | No |
| 2.3 | `routes/check.rs`: POST /check → deserialize CheckRequest, run pipeline (passthrough layers for now), return CheckResponse | `crates/ai-sentinel-api/src/routes/check.rs` | No |
| 2.4 | `middleware/auth.rs`: extract Bearer token or x-api-key header, hash API key, validate against config — reject 401 if invalid | `crates/ai-sentinel-api/src/middleware/auth.rs` | No |

**Gate:** `cargo build --release` succeeds; `python scripts/verify_build.py --health` → 200.

---

### Wave 3 — L0 Telemetry + L7 Audit (Build Steps 5–6)
**Goal:** Observability and tamper-evident audit active on all calls.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | L0 TelemetryAccumulator (attached to LayerContext), TelemetryRecord (all fields from Section 2 of build doc), TelemetryWriter (async tokio::spawn, verbosity levels, stdout/file backends) | `crates/ai-sentinel-layers/src/l0_telemetry.rs` | No |
| 3.2 | L7 AuditRecord, SHA-256 hash chain (hash = SHA-256(record_id + prev_hash + timestamp + payload_hash)), genesis prev_hash=all-zeros, async write buffer | `crates/ai-sentinel-layers/src/l7_audit.rs` | No |
| 3.3 | Wire L0 wrapper and L7 into Pipeline; add GET /admin/audit/verify route (walks chain, returns first failure) | `crates/ai-sentinel-api/src/routes/admin.rs` | No |

**Gate:** `cargo check` passes; audit records written per call; /admin/audit/verify returns clean.

---

### Wave 4 — L1 Sanitization + L2.1/L2.2 Auth/Trust (Build Steps 7–8)
**Goal:** Input sanitization and identity/trust layers operational.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | L1: compiled RegexSet for injection patterns, token estimation (word-count heuristic or tiktoken-rs), Presidio HTTP call with 10ms timeout, regex PII fallback, PII_STRIPPED mutation vs PII_CRITICAL reject | `crates/ai-sentinel-layers/src/l1_sanitization.rs` | No |
| 4.2 | L2.1: JWT Bearer validation (jsonwebtoken, HS256/RS256), SHA-256 API key hash comparison against config list | `crates/ai-sentinel-layers/src/l2_auth.rs` | No |
| 4.3 | L2.2: HMAC-SHA256 trust token validation, 60-second sliding window replay check (store seen tokens with expiry) | `crates/ai-sentinel-layers/src/l2_trust.rs` | No |

**Gate:** `cargo check` passes; injection test payload rejected with PROMPT_INJECTION.

---

### Wave 5 — Feed Worker + L2.3/L2.4 + L4 + L5 (Build Steps 9–10)
**Goal:** Live threat intel feed operational; tool authz and rate limiting active.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | `ai-sentinel-feed`: SignatureSet struct (regex patterns, CVE IDs, tool patterns), Arc<RwLock<SignatureSet>>, FeedWorker background tokio task (configurable poll interval), atomic pointer swap | `crates/ai-sentinel-feed/src/signature_set.rs`, `worker.rs` | No |
| 5.2 | Feed sources: CrowdSec CTI (REST), NVD (REST, API key), OWASP LLM Top 10 (static bundled), custom JSON (file path or URL) | `crates/ai-sentinel-feed/src/sources/` | No |
| 5.3 | L2.3: match request payload/caller against active SignatureSet | `crates/ai-sentinel-layers/src/l2_threat.rs` | No |
| 5.4 | L2.4: intercept MCP subprocess env, strip all vars not in whitelist (PATH, HOME, USER, LANG, LC_ALL, TERM, SHELL, TMPDIR) | `crates/ai-sentinel-layers/src/l2_mcp.rs` | No |
| 5.5 | L4: load RBAC roles from JSON config, allowed_tools per role, destructive action gate (deny drop/delete/truncate/format unless override), CVE-mapped tool patterns, forbidden_args regex | `crates/ai-sentinel-layers/src/l4_tools.rs` | No |
| 5.6 | L5: token bucket per session (configurable max_actions_per_hour), daily cost accumulator (compare to AI_SENTINEL_RATE_MAX_COST_PER_DAY), e-stop flag (checked first) | `crates/ai-sentinel-layers/src/l5_sandbox.rs` | No |

**Gate:** `cargo check` passes; feed hot-swap test: load signature → match → swap new set → zero restart.

---

### Wave 6 — L3/L6 Stubs + Redis/Postgres Backends (Build Steps 11–12)
**Goal:** Stubs close the layer interface; production storage backends available.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 6.1 | L3 stub: implements Layer trait, applies_to=false, check()=Ok(Pass) | `crates/ai-sentinel-layers/src/l3_intent.rs` | No |
| 6.2 | L6 stub: implements Layer trait, applies_to=false, check()=Ok(Pass), update /ready to reflect stub status | `crates/ai-sentinel-layers/src/l6_output.rs` | No |
| 6.3 | Postgres backend: sqlx with runtime-tokio-native-tls, 3 migrations (sessions table, audit table, telemetry table), CRUD impls for SessionStore + AuditStore | `crates/ai-sentinel-store/src/postgres.rs` | No |
| 6.4 | Redis backend: deadpool-redis, session get/set/delete with TTL, store backend trait impl | `crates/ai-sentinel-store/src/redis.rs` | No |

**Gate:** `cargo check` passes; /ready reports all layers (L3/L6 as stubs).

---

### Wave 7 — Admin Routes + Prometheus + OpenAPI (Build Step 13)
**Goal:** Full operational surface: admin control, metrics, API docs.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 7.1 | Admin routes (admin token required): POST /admin/feed/refresh, GET /admin/signatures (feed stats), GET /admin/audit/verify (chain walk), POST /admin/estop, POST /admin/estop/lift | `crates/ai-sentinel-api/src/routes/admin.rs` | No |
| 7.2 | Prometheus metrics via prometheus-client: ai_sentinel_requests_total (by direction/status/layer), ai_sentinel_latency_ms (histogram), ai_sentinel_layer_faults_total, ai_sentinel_pii_stripped_total, ai_sentinel_rate_limit_total, ai_sentinel_feed_last_update (gauge), ai_sentinel_audit_chain_length, ai_sentinel_cost_usd_total, ai_sentinel_estop_active (gauge), ai_sentinel_trust_replay_attempts | `crates/ai-sentinel-api/src/metrics.rs` | No |
| 7.3 | OpenAPI 3.1 via utoipa: annotate all handlers, generate spec, GET /openapi.json (no auth), GET /docs (Scalar browser, no auth) | `crates/ai-sentinel-api/src/openapi.rs` | No |

**Gate:** `cargo check` passes; GET /metrics returns Prometheus text; GET /openapi.json returns valid JSON.

---

### Wave 8 — Dockerfile + docker-compose (Build Step 14)
**Goal:** Production-ready container image and compose stack.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 8.1 | Multi-stage Dockerfile: Stage 1 (rust:1.75-slim builder, cargo build --release, strip binary), Stage 2 (debian:bookworm-slim or scratch, copy binary, USER 65534:65534, EXPOSE 8080) — target <50MB | `Dockerfile` | No |
| 8.2 | docker-compose.yml: 4 services (agentsec builds from ., presidio-analyzer from MCR, postgres:16-alpine, redis:7-alpine), Traefik labels for ai-sentinel.on-nex.us, env_file: ./infra/env, volumes for postgres data + config mount, healthchecks | `docker-compose.yml` | No |
| 8.3 | config/default.toml (all Phase 1 layers enabled, memory store), config/minimal.toml (L0+L1+L7 only), config/enterprise.toml (all layers, Postgres, OTel) | `config/` | No |
| 8.4 | infra/env template with all AI_SENTINEL_ variables documented (placeholder values for secrets) | `infra/env` | No |

**Gate:** `python scripts/deploy_containers.py --up` starts all 4 services; agentsec /health returns 200 from container.

---

### Wave 9 — Integration Tests + Verification (Build Step 15)
**Goal:** All integration tests pass; 14-point checklist green.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 9.1 | `check_ingress.rs`: (1) injection payload → PROMPT_INJECTION, (2) clean payload → pass all layers, (3) PII payload → PII_STRIPPED mutation | `tests/integration/check_ingress.rs` | No |
| 9.2 | `check_egress.rs`: (1) SSRF URL in payload → SSRF_URL (L6 stub: skip for now, document expected behavior), (2) clean egress → pass | `tests/integration/check_egress.rs` | No |
| 9.3 | `feed_hotswap.rs`: (1) load signature → match threat → (2) hot-swap to new SignatureSet without restart → (3) new signature active, old removed | `tests/integration/feed_hotswap.rs` | No |
| 9.4 | `session_rate_limit.rs`: send 1000 requests same session → all pass → 1001st → RATE_LIMIT | `tests/integration/session_rate_limit.rs` | No |
| 9.5 | `audit_chain_integrity.rs`: (1) GET /admin/audit/verify on clean log → ok, (2) tamper record in store, (3) GET /admin/audit/verify → returns first failure record_id | `tests/integration/audit_chain_integrity.rs` | No |
| 9.6 | Run `python scripts/verify_build.py --checklist` — all 14 items must pass | Verification | No |

**Gate:** `cargo test` zero failures; all 14 checklist items green.

---

## Success Criteria

- [ ] `python scripts/deploy_build.py --release` succeeds (zero errors)
- [ ] GET /health returns 200
- [ ] All 4 containers start and are running
- [ ] All 5 integration test files pass with zero failures
- [ ] Prompt injection rejected by L1
- [ ] Clean payload passes all layers
- [ ] Unauthorized tool rejected by L4
- [ ] 1001st request rejected by L5
- [ ] Feed hot-swap with zero container restart
- [ ] /admin/audit/verify returns clean chain
- [ ] /admin/audit/verify returns broken chain after tamper
- [ ] GET /metrics returns Prometheus data
- [ ] Docker runs as uid 65534
- [ ] docker-compose up reaches ai-sentinel.on-nex.us

---

## Technical Specifics

### Service Names (docker-compose)
```
agentsec        → builds from .
presidio        → mcr.microsoft.com/presidio-analyzer:latest
postgres        → postgres:16-alpine
redis           → redis:7-alpine
```

### Ports
```
agentsec:   8080 (internal) → :443 via Traefik
presidio:   3000 (internal)
postgres:   5432 (internal)
redis:      6379 (internal)
```

### Key Commands
```bash
python scripts/deploy_build.py --release
python scripts/deploy_containers.py --up
python scripts/verify_build.py --checklist
```

### Cargo workspace path on VM
```
/opt/ai-sentinel/
```

---

## Deferred (Out of Scope for Phase 1)

- L3 full implementation (embedding model, pgvector, cosine similarity, drift threshold)
- L6 full implementation (SSRF URL scanner, exfiltration pattern matching, egress PII scan)
- Info flow taint tracking
- Ed25519 signed manifests
- P2P mutual auth between agents
- Behavioral drift webhooks
- Admin UI
- n8n alerting workflows
- Python SDK
- Multi-tenant SaaS
