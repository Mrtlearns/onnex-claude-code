# Phase 1 — AgentSec Core Build: Context

**Status:** Planned — ready to execute
**Milestone:** v1.0
**Build target:** 10.10.111.36 (ai-sentinel-build, Ubuntu 24.04)

---

## What This Phase Builds

The complete AI-Sentinel v1.0: a Rust/axum 8-layer AI security sidecar. All layers functional (L3/L6 as interface-complete stubs). Integration tests passing. Docker image deployed to ai-sentinel.on-nex.us.

---

## Tech Stack (All Locked)

| Component | Technology | Version/Notes |
|-----------|-----------|--------------|
| Language | Rust | stable ≥1.75, x86_64-unknown-linux-gnu |
| HTTP | axum | with tower middleware |
| Async | tokio | full features |
| Serialization | serde + serde_json | |
| Async traits | async-trait | |
| Error handling | thiserror + anyhow | |
| IDs | uuid | v4 |
| Logging | tracing + tracing-subscriber | |
| Hashing | sha2 + hmac | SHA-256 |
| JWT | jsonwebtoken | |
| Regex | regex + fancy-regex | compiled RegexSet |
| HTTP client | reqwest | TLS features |
| Scheduling | tokio-cron-scheduler | feed polling |
| Session store (mem) | dashmap | default backend |
| Session store (Redis) | deadpool-redis | production |
| Session store (PG) | sqlx | with migrate + postgres features |
| Metrics | prometheus-client | 10 metric types |
| OpenAPI | utoipa + utoipa-scalar | 3.1 spec + Scalar browser |
| Config | config crate | TOML + env override |
| Secret zeroization | zeroize | |
| Time | chrono | |
| OTel | opentelemetry + opentelemetry-otlp | |

---

## Crate Structure

```
ai-sentinel/
├── Cargo.toml                          # workspace
├── Cargo.lock
├── Dockerfile
├── docker-compose.yml
├── CLAUDE.md                           # (from build doc)
├── README.md
├── config/
│   ├── default.toml
│   ├── minimal.toml
│   └── enterprise.toml
├── crates/
│   ├── ai-sentinel-core/               # Layer trait, types, pipeline, session, config
│   │   └── src/
│   │       ├── error.rs
│   │       ├── types.rs                # CheckRequest, CheckResponse, Direction, CallerContext, ToolManifest, LayerResult, RejectDetail, Severity
│   │       ├── layer.rs                # Layer trait (async_trait)
│   │       ├── session.rs              # SessionHandle trait
│   │       ├── config.rs               # AppConfig, LayerConfig
│   │       ├── pipeline.rs             # Pipeline::new(), Pipeline::run()
│   │       └── lib.rs
│   ├── ai-sentinel-layers/             # L0–L7 implementations
│   │   └── src/
│   │       ├── l0_telemetry.rs
│   │       ├── l1_sanitization.rs
│   │       ├── l2_auth.rs
│   │       ├── l2_trust.rs
│   │       ├── l2_threat.rs
│   │       ├── l2_mcp.rs
│   │       ├── l3_intent.rs            # stub
│   │       ├── l4_tools.rs
│   │       ├── l5_sandbox.rs
│   │       ├── l6_output.rs            # stub
│   │       ├── l7_audit.rs
│   │       └── lib.rs
│   ├── ai-sentinel-feed/               # Threat intel worker
│   │   └── src/
│   │       ├── signature_set.rs        # SignatureSet + Arc<RwLock<>>
│   │       ├── worker.rs               # background tokio task
│   │       ├── sources/
│   │       │   ├── crowdsec.rs
│   │       │   ├── nvd.rs
│   │       │   ├── owasp.rs
│   │       │   └── custom.rs
│   │       └── lib.rs
│   ├── ai-sentinel-store/              # Session + audit backends
│   │   └── src/
│   │       ├── memory.rs               # DashMap, SessionState, TTL eviction
│   │       ├── redis.rs                # deadpool-redis
│   │       ├── postgres.rs             # sqlx, 3 tables + migrations
│   │       └── lib.rs
│   └── ai-sentinel-api/                # Binary
│       └── src/
│           ├── main.rs
│           ├── routes/
│           │   ├── health.rs
│           │   ├── check.rs
│           │   └── admin.rs
│           ├── middleware/
│           │   └── auth.rs
│           ├── metrics.rs
│           ├── openapi.rs
│           └── lib.rs
├── tests/
│   └── integration/
│       ├── check_ingress.rs
│       ├── check_egress.rs
│       ├── feed_hotswap.rs
│       ├── session_rate_limit.rs
│       └── audit_chain_integrity.rs
├── scripts/
│   ├── _config.py
│   ├── deploy_build.py
│   ├── deploy_containers.py
│   └── verify_build.py
└── infra/
    └── env                             # env template (secrets via env vars)
```

---

## Core Trait Contract

```rust
#[async_trait]
pub trait Layer: Send + Sync {
    fn id(&self) -> &'static str;
    fn name(&self) -> &'static str;
    fn applies_to(&self, direction: &Direction) -> bool;
    async fn check(&self, req: &CheckRequest, ctx: &mut LayerContext)
        -> Result<LayerResult, LayerError>;
}
```

Stub pattern (L3, L6):
- `applies_to` returns `false`
- `check` returns `Ok(LayerResult::Pass)`

---

## Pipeline Behavior

- Layers iterated in order: L0 (wrap) → L1 → L2.1 → L2.2 → L2.3 → L4 → L5 → L7 (async)
- Skip layers where `applies_to(direction)` returns false
- Short-circuit on first `Reject` — skip remaining layers
- `Mutate` replaces payload and continues
- Layer `Err` → fail-open: log + increment fault counter + pass (never crash pipeline)
- L0 and L7 write async after response is sent

---

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /check | API key or JWT | Main security check (ingress or egress) |
| GET | /health | None | Liveness |
| GET | /ready | None | Readiness (session store + feed status) |
| GET | /metrics | None | Prometheus metrics |
| POST | /admin/feed/refresh | Admin token | Trigger immediate feed pull |
| GET | /admin/signatures | Admin token | Feed stats |
| GET | /admin/audit/verify | Admin token | Walk audit hash chain |
| POST | /admin/estop | Admin token | Emergency stop |
| POST | /admin/estop/lift | Admin token | Lift e-stop |
| GET | /openapi.json | None | OpenAPI 3.1 spec |
| GET | /docs | None | Scalar API browser |

---

## Environment Variables (Key)

All prefixed `AI_SENTINEL_`

| Variable | Purpose |
|----------|---------|
| HOST, PORT | Bind address (default 0.0.0.0:8080) |
| LOG_LEVEL | trace/debug/info/warn/error |
| JWT_SECRET | JWT validation secret |
| API_KEYS | Comma-separated SHA-256 hashed API keys |
| ADMIN_TOKEN | Admin endpoint auth token |
| TRUST_SECRET | HMAC secret for agent-to-agent trust tokens |
| STORE_BACKEND | memory / redis / postgres |
| DATABASE_URL | Postgres connection string |
| REDIS_URL | Redis connection string |
| TELEMETRY_LEVEL | off/minimal/standard/full/debug |
| TELEMETRY_BACKEND | stdout/file/postgres/otlp/multi |
| TELEMETRY_PII_REDACT | true/false — redact PII in telemetry |
| FEED_INTERVAL_SECS | Feed poll interval (default 3600) |
| CROWDSEC_API_KEY | CrowdSec CTI API key |
| NVD_API_KEY | NVD API key |
| RATE_MAX_ACTIONS_PER_HOUR | L5 rate limit |
| RATE_MAX_COST_PER_DAY | L5 daily cost cap (USD) |
| RATE_MAX_TOKENS_PER_REQUEST | L1 token budget |
| LAYER_L1_ENABLED through LAYER_L7_ENABLED | Layer toggles |

---

## Rejection Codes by Layer

| Layer | Codes |
|-------|-------|
| L1 | PROMPT_INJECTION, TOKEN_BUDGET_EXCEEDED, PII_CRITICAL / PII_STRIPPED (mutation) |
| L2.1 | AUTH_MISSING, AUTH_INVALID, AUTH_EXPIRED |
| L2.2 | TRUST_MISSING, TRUST_INVALID, TRUST_REPLAY |
| L2.3 | THREAT_SIGNATURE_MATCH |
| L2.4 | MCP_ENV_VIOLATION |
| L4 | TOOL_NOT_AUTHORIZED, DESTRUCTIVE_TOOL_DENIED, TOOL_CVE, FORBIDDEN_ARGS |
| L5 | RATE_LIMIT, COST_CAP, TOKEN_BUDGET, ESTOP |
| L6 | SSRF_URL, EXFILTRATION_PATTERN, PII_EGRESS |

---

## Docker Services

| Service | Image | Purpose |
|---------|-------|---------|
| agentsec | (built from Dockerfile) | Main binary |
| presidio-analyzer | mcr.microsoft.com/presidio-analyzer | PII detection sidecar |
| postgres | postgres:16-alpine | Audit + session persistence |
| redis | redis:7-alpine | Session cache |

---

## Deploy Scripts (Wave 0 deliverables)

```bash
python scripts/deploy_build.py              # upload + cargo check
python scripts/deploy_build.py --release    # upload + cargo build --release
python scripts/deploy_build.py --check-only # skip upload, cargo check only
python scripts/deploy_build.py --upload-only # upload without building

python scripts/deploy_containers.py --up    # docker compose up
python scripts/deploy_containers.py --up --build  # start with rebuild
python scripts/deploy_containers.py --status
python scripts/deploy_containers.py --logs

python scripts/verify_build.py --all-tests  # run integration tests
python scripts/verify_build.py --health     # hit /health endpoint
python scripts/verify_build.py --checklist  # run 14-point verification checklist
```

Do NOT run without human approval:
- `python scripts/deploy_containers.py --down`
- `git push`
- `rm -rf`

---

## Deferred (Phase 2+)

- L3 full implementation (embedding model + pgvector + cosine similarity)
- L6 full implementation (SSRF scanner + exfiltration patterns + egress PII)
- Info flow taint tracking
- Ed25519 signed manifests
- P2P mutual auth
- Behavioral drift webhooks
- Python SDK
- Multi-tenant SaaS
- Admin UI
- n8n alerting workflows
