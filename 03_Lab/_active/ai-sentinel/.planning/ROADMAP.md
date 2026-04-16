# AI-Sentinel — Roadmap

---

## Phase 1 — AgentSec Core Build

**Goal:** Fully operational 8-layer AI security sidecar in Rust, deployed to ai-sentinel.on-nex.us. All L0–L7 layers functional (L3/L6 as interface-complete stubs). All integration tests passing.

**Milestone:** v1.0
**Build target:** 10.10.111.36 (ai-sentinel-build)

Success criteria:
- [ ] `python scripts/deploy_build.py --release` succeeds (zero errors)
- [ ] GET /health returns 200
- [ ] All 4 containers start and are running (agentsec, presidio-analyzer, postgres, redis)
- [ ] All 5 integration test files pass with zero failures
- [ ] Prompt injection attempt rejected by L1
- [ ] Clean payload passes all layers end-to-end
- [ ] Unauthorized tool rejected by L4
- [ ] 1001st request rejected by L5 rate limiter
- [ ] SignatureSet hot-swap completes with zero container restart
- [ ] GET /admin/audit/verify returns clean chain on unmodified log
- [ ] GET /admin/audit/verify returns broken chain after record tamper
- [ ] GET /metrics returns valid Prometheus data
- [ ] Docker container runs as uid 65534 (non-root)
- [ ] docker-compose up reaches ai-sentinel.on-nex.us via Traefik TLS

**Wave sequence:** 0 (pre-build) → 1 (scaffold) → 2 (API binary) → 3 (L0+L7) → 4 (L1+L2.1/2.2) → 5 (feed+L2.3/2.4+L4+L5) → 6 (stubs+storage) → 7 (admin+metrics+docs) → 8 (Docker) → 9 (tests)

---

## Phase 2 — Semantic Intent + Egress Inspection

**Goal:** Upgrade L3 and L6 from stubs to full implementations. Activate behavioral drift detection and complete egress inspection pipeline.

**Milestone:** v2.0

Success criteria:
- [ ] L3 full: embedding model loaded, cosine similarity computed against session baseline
- [ ] L3 rejects INTENT_DRIFT on salami-slicing attack pattern
- [ ] L6 full: SSRF scanner rejects private IP and cloud metadata URLs
- [ ] L6 full: exfiltration pattern detection active on egress
- [ ] L6 full: egress PII scan redacts before delivery
- [ ] Info flow taint tracking active
- [ ] Behavioral drift webhook fires on configurable threshold
- [ ] All existing Phase 1 integration tests still pass
- [ ] New Phase 2 integration tests pass

---

## Phase 3 — SDK + SaaS + Multi-tenant

**Goal:** Package AI-Sentinel as an independently deployable product with Python SDK and multi-tenant SaaS option.

**Milestone:** v3.0

Success criteria:
- [ ] Python SDK published (pip installable) for embedding guard tiers in third-party apps
- [ ] Multi-tenant deployment isolates policy and audit data per tenant
- [ ] White-label config supported for Onnex client deployments
- [ ] Public API documentation complete
- [ ] Billing integration functional
