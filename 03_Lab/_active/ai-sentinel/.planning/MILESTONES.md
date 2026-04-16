# AI-Sentinel — Milestones

---

## v1.0 — AgentSec Core Build (Current Target)

**Goal:** Full 8-layer security sidecar operational on ai-sentinel.on-nex.us. L3/L6 as stubs. All integration tests passing. Production-ready Docker image.

Deliverables:
- [ ] Python deploy scripts (deploy_build.py, deploy_containers.py, verify_build.py, _config.py)
- [ ] Workspace Cargo.toml + 5-crate structure (core, layers, feed, store, api)
- [ ] ai-sentinel-core: Layer trait, all types/enums, Pipeline runner, session trait, config
- [ ] ai-sentinel-store: memory (DashMap), Redis (deadpool), Postgres (sqlx) backends
- [ ] ai-sentinel-api: axum binary, /health, /ready, POST /check, admin routes, metrics, OpenAPI
- [ ] L0 telemetry envelope (async, verbosity levels, stdout/file/Postgres/OTel backends)
- [ ] L1 input sanitization (injection RegexSet + Presidio + fallback PII)
- [ ] L2.1 auth (JWT + API key hash)
- [ ] L2.2 trust chain (HMAC-SHA256 + 60s replay protection)
- [ ] L2.3 threat intel feed (CrowdSec + NVD + OWASP + custom, hot-swap)
- [ ] L2.4 MCP env filter
- [ ] L3 stub (applies_to=false)
- [ ] L4 tool authorization (RBAC + destructive gate + CVE patterns + forbidden args)
- [ ] L5 execution sandbox (token bucket + cost cap + e-stop)
- [ ] L6 stub (applies_to=false)
- [ ] L7 audit hash chain (SHA-256, tamper-evident, verify endpoint)
- [ ] Prometheus metrics (10 metric types)
- [ ] OpenAPI 3.1 spec + Scalar browser
- [ ] Multi-stage Dockerfile (<50MB, uid 65534)
- [ ] docker-compose.yml (4 services + Traefik labels)
- [ ] config/default.toml, minimal.toml, enterprise.toml
- [ ] 5 integration test files — all passing
- [ ] 14-point verification checklist — all green

---

## v2.0 — Semantic Intent + Egress Inspection

**Goal:** Activate L3 (behavioral drift via embeddings) and L6 (SSRF + exfiltration + egress PII).

Deliverables:
- [ ] L3 full: embedding model integration + pgvector baseline + cosine similarity + drift threshold
- [ ] L6 full: SSRF URL scanner (private IPs + cloud metadata) + exfiltration patterns + egress PII scan
- [ ] Info flow taint tracking
- [ ] Ed25519 signed manifests
- [ ] P2P mutual auth
- [ ] Behavioral drift webhooks
- [ ] Phase 2 integration tests

---

## v3.0 — SDK + SaaS + Multi-tenant

**Goal:** Packageable product — Python SDK, multi-tenant SaaS, white-label, billing.

Deliverables:
- [ ] Python SDK (pip installable)
- [ ] Multi-tenant deployment isolation
- [ ] White-label config support
- [ ] Public API documentation
- [ ] Billing integration
- [ ] Onnex client deployment playbook
