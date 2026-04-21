---
gsd_state_version: 1.0
milestone: v4.0
milestone_name: gateway-mvp
status: "Phase 4 Planned — Gateway MVP"
last_updated: "2026-04-20"
last_activity: "2026-04-20 — Phase 4 planned: network-layer MITM proxy, 5-wave plan, 5 new crates"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 4
  completed_plans: 3
---

# AI-Sentinel — State

## Current Position

**All 3 phases complete.** AI-Sentinel v3.0 is fully operational.

- **L0-L7** 8-layer pipeline running in production on `10.10.110.36`
- **Python SDK** installable (`pip install -e .` from `sdk/python/`)
- **White-label config profiles** for PI-law, NDT, MSP verticals
- **All 22 integration tests** pass
- **Stack** 4 containers, all healthy, live at `https://ai-sentinel.on-nex.us`

---

## Phase Table

| Phase | Name | Status | Done |
|-------|------|--------|------|
| 1 | AgentSec Core Build | **Complete** | 100% |
| 2 | Semantic Intent + Egress Inspection | **Complete** | 100% |
| 3 | SDK + SaaS + Multi-tenant | **Complete** | 100% |
| 4 | Gateway MVP (Network MITM Proxy) | **Build Verified** | 98% |

---

## Phase 4 Gates (must resolve before shipping to real devices)

- [ ] CA custody: YubiHSM or air-gapped root CA in place
- [ ] Device audit: enumerate tools that bypass `HTTP_PROXY` in Onnex stack
- [ ] fail_open override: per-deployment justification documented before any `fail_open = true`

---

## Locked Decisions

| Decision | Value |
|----------|-------|
| Language | Rust (stable ≥1.75) |
| HTTP framework | axum |
| Session store (default) | memory (DashMap) |
| Session store (prod) | Redis (deadpool) + Postgres (sqlx) |
| Auth | JWT Bearer + SHA-256 API key hash |
| Trust chain | HMAC-SHA256, 60s replay protection |
| PII detection | Presidio sidecar + regex fallback |
| Threat intel | CrowdSec CTI + NVD + OWASP LLM Top 10 + custom JSON |
| Feed update | Atomic hot-swap (Arc<RwLock<SignatureSet>>), zero restart |
| Audit | SHA-256 hash chain, tamper-evident |
| Deploy | 4-container docker-compose, non-root uid 65534 |
| Env prefix | AI_SENTINEL_ |
| Build VM | 10.10.110.36 (ai-sentinel-build), Ubuntu 24.04 |
| Live URL | https://ai-sentinel.on-nex.us |
| Direction wire format | lowercase ("ingress" / "egress") |
| CheckStatus wire format | lowercase ("pass" / "reject") |
| L3 threshold default | -0.1 (hash-projection; use 0.7+ for real embeddings) |
| L6 SSRF patterns | 13 (RFC-1918 + cloud metadata) |
| L6 exfil patterns | 10 (AWS keys, PGP, JWTs, SQL dumps, credentials) |
| SDK language | Python (httpx + pydantic) |
| SDK classes | SentinelClient, AsyncSentinelClient, SessionContext, PolicyBuilder |
| White-label profiles | pi-law.toml, ndt.toml, msp.toml |

---

## Final Verification (Phase 3)

- ✅ All 22 integration tests pass (0 failures)
- ✅ `GET /health` → `{"status":"ok"}`
- ✅ `GET /ready` → all layers active, 14 patterns
- ✅ All 4 containers healthy (agentsec, presidio, postgres, redis)
- ✅ Container uid 65534 (non-root)
- ✅ Ingress injection → REJECT (l1/PROMPT_INJECTION/high)
- ✅ Clean ingress → PASS
- ✅ Egress SSRF → REJECT (l6/SSRF_URL/critical)
- ✅ Egress exfil (AWS key) → REJECT (l6/EXFILTRATION_PATTERN/high)
- ✅ Audit chain verifies clean
- ✅ Prometheus metrics live
- ✅ Python SDK: 5/5 unit tests pass
- ✅ Python SDK live smoke test: all 3 session queries pass
- ✅ White-label profiles: pi-law, ndt, msp created

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
| 2026-04-20 | Phase 4 code complete: ai-sentinel-classifier, ai-sentinel-proxy, gateway.toml, Dockerfile.gateway, docker-compose.gateway.yml, test_gateway.sh |
