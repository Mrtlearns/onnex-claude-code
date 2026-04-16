# AI-Sentinel — Requirements

---

## v1.0 — AgentSec Core Build (Phase 1)

### L0 — Telemetry Envelope

- [ ] REQ-001: System shall record request_id, session_id, direction, caller, model, provider, tokens, cost at pipeline entry (async, zero hot-path latency)
- [ ] REQ-002: System shall record decision, reject_layer, code, latency_ms, layers_ran, per_layer_ms at pipeline exit
- [ ] REQ-003: System shall support verbosity levels: off, minimal, standard, full, debug
- [ ] REQ-004: System shall support telemetry backends: stdout, file, Postgres, OpenTelemetry, multi
- [ ] REQ-005: L0 shall write asynchronously after response is sent — never block the hot path

### L1 — Input Sanitization

- [ ] REQ-010: System shall detect prompt injection attempts via compiled RegexSet and reject with PROMPT_INJECTION
- [ ] REQ-011: System shall enforce per-request token budget and reject with TOKEN_BUDGET_EXCEEDED
- [ ] REQ-012: System shall call Presidio sidecar for PII detection with 10ms timeout
- [ ] REQ-013: System shall fall back to regex PII detection when Presidio unavailable
- [ ] REQ-014: System shall strip PII and return mutated payload (PII_STRIPPED) rather than rejecting when configured
- [ ] REQ-015: System shall reject critical PII with PII_CRITICAL when strip is not configured
- [ ] REQ-016: L1 shall apply to ingress direction only

### L2 — Identity & Trust

- [ ] REQ-020: System shall validate JWT Bearer tokens (L2.1)
- [ ] REQ-021: System shall validate SHA-256 API key hashes (L2.1)
- [ ] REQ-022: System shall validate HMAC-SHA256 trust tokens for agent-to-agent calls (L2.2)
- [ ] REQ-023: System shall enforce 60-second replay protection window on trust tokens (L2.2)
- [ ] REQ-024: System shall maintain a live SignatureSet in Arc<RwLock<>> for threat intel matching (L2.3)
- [ ] REQ-025: System shall poll CrowdSec CTI, NVD, OWASP LLM Top 10, and custom JSON feeds on configurable interval (L2.3)
- [ ] REQ-026: SignatureSet hot-swap shall complete in microseconds with zero service restart (L2.3)
- [ ] REQ-027: System shall strip all environment variables except PATH, HOME, USER, LANG, LC_ALL, TERM, SHELL, TMPDIR before MCP subprocess execution (L2.4)
- [ ] REQ-028: L2 shall apply to ingress direction only

### L3 — Semantic Intent Guard (stub)

- [ ] REQ-030: L3 stub shall implement Layer trait with applies_to=false and check()=Ok(Pass)
- [ ] REQ-031: /ready endpoint shall accurately reflect L3 stub status

### L4 — Tool & Action Authorization

- [ ] REQ-040: System shall enforce RBAC allowed-tools list from JSON config per role
- [ ] REQ-041: System shall deny-by-default tools matching destructive patterns (drop, delete, truncate, format) unless destructive_override=true
- [ ] REQ-042: System shall reject tools matching CVE-mapped patterns from L2.3 SignatureSet
- [ ] REQ-043: System shall enforce forbidden_args patterns per tool definition
- [ ] REQ-044: L4 shall apply to ingress direction when tool_manifest is present

### L5 — Execution Sandbox

- [ ] REQ-050: System shall enforce token bucket rate limiting (deterministic, not sliding window)
- [ ] REQ-051: System shall enforce daily cost cap and reject with COST_CAP when exceeded
- [ ] REQ-052: System shall support emergency stop (e-stop) via POST /admin/estop and POST /admin/estop/lift
- [ ] REQ-053: L5 shall apply to ingress direction only

### L6 — Output Inspection (stub)

- [ ] REQ-060: L6 stub shall implement Layer trait with applies_to=false and check()=Ok(Pass)
- [ ] REQ-061: /ready endpoint shall accurately reflect L6 stub status

### L7 — Audit Hash Chain

- [ ] REQ-070: System shall produce a SHA-256 hash-chained audit log (hash = SHA-256(record_id + prev_hash + timestamp + payload_hash))
- [ ] REQ-071: Genesis record shall use all-zeros prev_hash
- [ ] REQ-072: System shall expose GET /admin/audit/verify that walks the chain and returns the first integrity failure
- [ ] REQ-073: L7 shall write asynchronously — never block the hot path
- [ ] REQ-074: L7 shall apply to both ingress and egress directions

### Pipeline & Core

- [ ] REQ-080: Layer fault (Err) shall fail-open: log, increment ai_sentinel_layer_faults_total, pass — never crash pipeline
- [ ] REQ-081: System shall short-circuit on first Reject result and skip remaining layers
- [ ] REQ-082: System shall apply Mutate by replacing payload and continuing pipeline
- [ ] REQ-083: Session state shall be optional — callers omitting session_id receive stateless checks

### API & Operations

- [ ] REQ-090: GET /health shall return 200 with no auth required
- [ ] REQ-091: GET /ready shall return session store + feed status
- [ ] REQ-092: GET /metrics shall return Prometheus metrics
- [ ] REQ-093: POST /admin/feed/refresh shall trigger immediate feed pull (admin token required)
- [ ] REQ-094: GET /admin/signatures shall return feed stats (admin token required)
- [ ] REQ-095: GET /openapi.json shall return OpenAPI 3.1 spec (no auth)
- [ ] REQ-096: GET /docs shall serve Scalar API browser (no auth)

### Storage Backends

- [ ] REQ-100: Memory backend (DashMap) shall be the default with TTL eviction
- [ ] REQ-101: Redis backend (deadpool-redis) shall support session TTL
- [ ] REQ-102: Postgres backend (sqlx) shall provide 3 tables: sessions, audit, telemetry with migrations

### Deployment

- [ ] REQ-110: Docker image shall be multi-stage, <50MB, run as uid 65534 (non-root)
- [ ] REQ-111: docker-compose.yml shall define 4 services: agentsec, presidio-analyzer, postgres:16-alpine, redis:7-alpine
- [ ] REQ-112: All secrets shall be sourced from environment variables prefixed AI_SENTINEL_
- [ ] REQ-113: Service shall be reachable at ai-sentinel.on-nex.us via Traefik TLS

### Verification

- [ ] REQ-120: All 5 integration test files must pass with zero failures
- [ ] REQ-121: All 14 items in the Phase 1 verification checklist must pass

---

## v2.0 — Semantic Intent + Egress Inspection (Phase 2)

- [ ] REQ-200: L3 full: embedding model + cosine similarity against session baseline for behavioral drift detection
- [ ] REQ-201: L3 shall reject with INTENT_DRIFT when cosine similarity exceeds configurable threshold
- [ ] REQ-202: L6 full: SSRF protection — scan URLs for private IP ranges and cloud metadata endpoints
- [ ] REQ-203: L6 full: exfiltration pattern detection on egress payloads
- [ ] REQ-204: L6 full: egress PII scan before delivery to caller
- [ ] REQ-205: Info flow taint tracking
- [ ] REQ-206: Ed25519 signed manifests
- [ ] REQ-207: P2P mutual auth between agents
- [ ] REQ-208: Behavioral drift webhooks

---

## v3.0 — SDK + SaaS + Multi-tenant (Phase 3)

- [ ] REQ-300: Python SDK for embedding AI-Sentinel guard in third-party applications
- [ ] REQ-301: Multi-tenant SaaS deployment with isolated policy and audit data per tenant
- [ ] REQ-302: Public API documentation covering all endpoints and policy config schema
- [ ] REQ-303: White-label support for Onnex client deployments
- [ ] REQ-304: Billing integration
