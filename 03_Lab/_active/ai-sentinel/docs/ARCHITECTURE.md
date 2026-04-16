# AI-Sentinel — Architecture & Developer Reference

> **Version:** 1.0 (2026-03-26)
> **Status:** Production-deployed on `10.10.110.36`
> **Public URL:** `https://ai-sentinel.on-nex.us`
> **Stack:** Rust/Axum · Docker Compose · Python FastAPI (test harness)

---

## Table of Contents

1. [What Is AI-Sentinel](#1-what-is-ai-sentinel)
2. [System Topology](#2-system-topology)
3. [Pipeline Overview](#3-pipeline-overview)
4. [Layer Reference (L0–L7)](#4-layer-reference-l0l7)
5. [API Reference](#5-api-reference)
6. [Infrastructure Services](#6-infrastructure-services)
7. [Sentinel-Tester: Test Harness](#7-sentinel-tester-test-harness)
8. [Monitoring Stack](#8-monitoring-stack)
9. [Configuration System](#9-configuration-system)
10. [Session Store](#10-session-store)
11. [Threat Intelligence Feed](#11-threat-intelligence-feed)
12. [Python SDK](#12-python-sdk)
13. [Performance Characteristics](#13-performance-characteristics)
14. [Deployment Topology](#14-deployment-topology)
15. [Known Gaps & Roadmap](#15-known-gaps--roadmap)

---

## 1. What Is AI-Sentinel

AI-Sentinel is a security sidecar for AI workloads. Every request sent to or received from an AI model passes through it for multi-layer inspection before the payload is allowed to continue. If a threat is detected at any layer, execution halts immediately and a structured rejection is returned.

**Core properties:**
- **Inline** — sits in the critical path, not async/out-of-band
- **Fail-fast** — first layer to reject short-circuits the remaining pipeline
- **Bidirectional** — inspects both ingress (user → model) and egress (model → user)
- **Stateful** — session tracking enables rate limiting, cost caps, and drift detection
- **Observable** — every decision logged, Prometheus metrics, hash-chained audit log
- **Configurable** — vertical-specific profiles (NDT, MSP, PI Law)

---

## 2. System Topology

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EXTERNAL INTERNET                                                          │
│                                                                             │
│   Browser / SDK / n8n / Temporal                                            │
│         │                                                                   │
│         │  HTTPS :443                                                       │
│         ▼                                                                   │
│   ┌────────────────────────────────┐                                        │
│   │  Traefik Reverse Proxy         │  on-nex.us proxy VM                   │
│   │  ai-sentinel.on-nex.us → :8080 │  Let's Encrypt TLS                   │
│   └────────────────┬───────────────┘                                        │
│                    │                                                        │
└────────────────────┼────────────────────────────────────────────────────────┘
                     │  HTTP  (via host route / static file provider)
                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  VM: 10.10.110.36 — ai-sentinel host                                        │
│                                                                             │
│  Docker Network: sentinel-net (bridge)                                      │
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                  │
│  │  agentsec    │    │  presidio    │    │  postgres    │                  │
│  │  :8080       │───▶│  :3000       │    │  :5432       │                  │
│  │  (Rust/Axum) │    │  (PII NER)   │    │  (sessions)  │                  │
│  └──────┬───────┘    └──────────────┘    └──────────────┘                  │
│         │                                                                   │
│         │            ┌──────────────┐    ┌──────────────┐                  │
│         └───────────▶│  redis       │    │  prometheus  │                  │
│                      │  :6379       │    │  :9090       │                  │
│                      │  (cache)     │    │  (metrics)   │                  │
│                      └──────────────┘    └──────┬───────┘                  │
│                                                 │                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────▼───────┐                  │
│  │  sentinel-   │    │  grafana     │◀───│  (scrapes    │                  │
│  │  tester      │    │  :3001       │    │   agentsec)  │                  │
│  │  :8090       │    │  (dashboards)│    └──────────────┘                  │
│  └──────────────┘    └──────────────┘                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  Direct access (homelab / VPN):
    http://10.10.110.36:8080   — agentsec API
    http://10.10.110.36:8090   — sentinel-tester
    http://10.10.110.36:9090   — Prometheus
    http://10.10.110.36:3001   — Grafana

  Public access (via Traefik):
    https://ai-sentinel.on-nex.us/        — agentsec API + /ui dashboard
    https://ai-sentinel.on-nex.us/grafana — Grafana (path-routed)
```

---

## 3. Pipeline Overview

Every `POST /check` request passes through all applicable layers in sequence. The pipeline short-circuits on the first rejection.

```
                 ┌──────────────────────────────────────────────────┐
                 │             POST /check                           │
                 │  { direction, payload, caller_context,           │
                 │    session_id, tool_manifest }                   │
                 └───────────────────┬──────────────────────────────┘
                                     │
                 ╔═══════════════════▼══════════════════════╗
                 ║  L0 · TELEMETRY (both directions)         ║
                 ║  Instrument metrics, never rejects        ║
                 ╚═══════════════════╤══════════════════════╝
                                     │
              ┌──────────────────────┼───────────────────────────┐
              │ INGRESS              │                EGRESS      │
              │ (user → model)       │          (model → user)    │
              ▼                      │                            ▼
    ╔══════════════════════╗         │         ╔══════════════════════════╗
    ║  L1 · SANITIZATION   ║         │         ║  L6 · OUTPUT INSPECTION  ║
    ║  Injection regex      ║         │         ║  SSRF + exfil + PII      ║
    ║  PII strip (mutate)   ║         │         ║  egress                  ║
    ║  Token budget         ║         │         ╚══════════╤═══════════════╝
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L2.1 · AUTH          ║         │                    │
    ║  API key / JWT        ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L2.2 · TRUST CHAIN   ║         │                    │
    ║  HMAC + replay guard  ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L2.3 · THREAT FEED  ║         │                    │
    ║  Live signature match ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L2.4 · MCP FILTER   ║         │                    │
    ║  Env var sanitize     ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L3 · INTENT GUARD   ║         │                    │
    ║  Session drift detect ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L4 · TOOL AUTH      ║         │                    │
    ║  RBAC + destructive   ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
    ╔══════════▼═══════════╗         │                    │
    ║  L5 · SANDBOX        ║         │                    │
    ║  E-stop + rate + cost ║         │                    │
    ╚══════════╤═══════════╝         │                    │
               │                    │                    │
               └────────────────────┘                    │
                                     │                    │
                 ╔═══════════════════▼══════════════════╗ │
                 ║  L7 · AUDIT CHAIN (both directions)  ║◀┘
                 ║  SHA-256 hash-chained tamper log      ║
                 ╚═══════════════════╤══════════════════╝
                                     │
                 ┌───────────────────▼──────────────────────────────┐
                 │           CheckResponse                           │
                 │  status: "pass" | "reject"                       │
                 │  reject: { layer, code, reason, severity }       │
                 │  payload: (mutated if PII stripped)              │
                 │  latency_ms, layers_ran                          │
                 └──────────────────────────────────────────────────┘
```

### Decision Matrix

| Layer | Direction | Can Reject | Can Mutate | Can Pass |
|-------|-----------|:----------:|:----------:|:--------:|
| L0 Telemetry | Both | — | — | ✓ |
| L1 Sanitization | Ingress | ✓ | ✓ | ✓ |
| L2.1 Auth | Ingress | ✓ | — | ✓ |
| L2.2 Trust Chain | Ingress | ✓ | — | ✓ |
| L2.3 Threat Feed | Ingress | ✓ | — | ✓ |
| L2.4 MCP Filter | Ingress | — | ✓ | ✓ |
| L3 Intent Guard | Ingress | ✓ | — | ✓ |
| L4 Tool Auth | Ingress | ✓ | — | ✓ |
| L5 Sandbox | Ingress | ✓ | — | ✓ |
| L6 Output | Egress | ✓ | ✓ | ✓ |
| L7 Audit | Both | — | — | ✓ |

---

## 4. Layer Reference (L0–L7)

### L0 · Telemetry

**File:** `crates/ai-sentinel-layers/src/l0_telemetry.rs`
**Direction:** Both
**Can Reject:** No

Instruments every request and response with structured telemetry. Never blocks or modifies payload.

**Collects:**
- Request timestamp, direction, caller_id, session_id
- Layer execution time per-layer
- Token counts (`prompt_tokens`, `completion_tokens`)
- Cost attribution (`cost_usd`)
- Final decision (pass/reject), layer that rejected, rejection code

**Telemetry Backends (configurable):**
```
stdout → JSON lines (default)
file   → rotating JSONL file
```

**Config keys:**
```toml
telemetry_level   = "standard"   # off | minimal | standard | full | debug
telemetry_backend = "stdout"
telemetry_pii_redact = true       # strip PII before logging
```

---

### L1 · Sanitization & Token Budget

**File:** `crates/ai-sentinel-layers/src/l1_sanitization.rs`
**Direction:** Ingress only

The primary defence against prompt injection and PII leakage in user input.

#### 1.1 Prompt Injection Detection

Regex-based pattern set (fail-fast, in order):

| Pattern | Example trigger | Code |
|---------|----------------|------|
| `(?i)ignore\s+all\s+previous\s+instructions` | "Ignore all previous instructions and..." | `PROMPT_INJECTION` |
| `(?i)(jailbreak\|bypass\|override)\s+(your\s+)?(safety\|filter\|guardrail\|restriction)` | "Jailbreak your safety filters" | `PROMPT_INJECTION` |
| `(?i)act\s+as\s+(if\s+you\s+(are\|were)\s+)?(a\s+)?(?:evil\|uncensored\|unfiltered\|dan)` | "Act as DAN" | `PROMPT_INJECTION` |
| `(?i)<\|im_start\|>system` | Multi-model injection format | `PROMPT_INJECTION` |
| `(?i)\[INST\].*ignore.*\[/INST\]` | Llama prompt injection | `PROMPT_INJECTION` |
| *(~7 additional patterns)* | Various LLM attack vectors | `PROMPT_INJECTION` |

**Severity:** `high`

#### 1.2 PII Stripping (Mutate, Never Reject)

L1 **strips** PII and returns `LayerResult::Mutate` — the pipeline continues with the redacted payload. Final response status is **"pass"** with the sanitized content.

| PII Type | Pattern | Replacement |
|----------|---------|-------------|
| SSN | `\b\d{3}-\d{2}-\d{4}\b` | `[REDACTED_SSN]` |
| Phone | `\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b` | `[REDACTED_PHONE]` |
| Email | RFC 5322 pattern | `[REDACTED_EMAIL]` |
| Visa card | `4[0-9]{12}(?:[0-9]{3})?` | `[REDACTED_CARD]` |
| Mastercard | `5[1-5][0-9]{14}` | `[REDACTED_CARD]` |

**Optional Presidio integration** (if `presidio_url` configured):
- Calls `POST /analyze` with 10ms timeout
- On success: NER-based detection supplements regex (catches names, addresses, etc.)
- On timeout/error: falls back to regex-only (fail-open)

#### 1.3 Token Budget

Estimates token count as `payload_bytes / 4`. Rejects if over `rate_max_tokens_per_request` (default 100,000).

**Code:** `TOKEN_BUDGET_EXCEEDED` / **Severity:** `medium`

```
┌─────────────────────────────────────────────────────┐
│  L1 Decision Tree                                    │
│                                                      │
│  Payload ──▶ Injection regex scan                   │
│                    │                                 │
│              Match? ──YES──▶ REJECT (PROMPT_INJ)    │
│                    │                                 │
│                    NO                                │
│                    │                                 │
│              Contains PII? ──YES──▶ Strip + MUTATE  │
│                    │                                 │
│                    NO                                │
│                    │                                 │
│              Token estimate > budget?                │
│              ──YES──▶ REJECT (TOKEN_BUDGET)          │
│                    │                                 │
│                    NO                                │
│                    │                                 │
│                  PASS                                │
└─────────────────────────────────────────────────────┘
```

---

### L2.1 · Identity Authentication

**File:** `crates/ai-sentinel-layers/src/l2_auth.rs`
**Direction:** Ingress only

Verifies the caller identity before allowing the request further into the pipeline.

**Methods:**
- **API Key** — SHA-256 hash of key compared against `config.api_keys`
- **JWT** — HS256 validation with expiry check (`exp` claim)
- **Dev mode** — If no credentials configured, all callers pass (local testing only)

**Code:** `AUTH_FAILED` / **Severity:** `high`

**Caller context fields used:**
```json
"caller_context": {
  "caller_id": "my-app",
  "api_key_hash": "sha256_hex_of_key",
  "trust_token": "agent_id:timestamp:hmac"
}
```

---

### L2.2 · Trust Chain Verification

**File:** `crates/ai-sentinel-layers/src/l2_trust.rs`
**Direction:** Ingress only

Agent-to-agent mutual authentication with replay protection. Used when one AI agent calls another.

**Token Format:**
```
agent_id:unix_timestamp:hmac_hex
```
HMAC-SHA256 is computed over `agent_id:timestamp` using a shared secret.

**Validation:**
1. Parse token into 3 components
2. Verify HMAC matches
3. Check timestamp within ±60 second window
4. Check `(agent_id:timestamp)` not in per-session replay cache
5. Add to replay cache with 60s TTL

```
Token: "agent-a:1711234567:a3f9c2..."
          │           │          └─ HMAC-SHA256("agent-a:1711234567")
          │           └─ Unix timestamp (must be within ±60s of now)
          └─ Agent identifier
```

**Codes:**
- `TRUST_TOKEN_INVALID` — HMAC mismatch / parse error (severity: `high`)
- `TRUST_REPLAY` — token already seen within window (severity: `high`)

---

### L2.3 · Threat Intelligence Matching

**File:** `crates/ai-sentinel-layers/src/l2_threat.rs`
**Direction:** Ingress only

Matches payload content against a live threat signature feed. Signatures are hot-swapped at runtime with zero downtime.

**Signature Sources:**
- OWASP LLM Top 10 (always loaded)
- CrowdSec CTI (optional, API key required)
- NVD CVE database (optional, API key required)
- Custom patterns (optional, file path or URL)

**Matching:** RegexSet (multi-pattern parallel match, O(n) on pattern count not text length)

**Code:** `THREAT_SIGNATURE_MATCH` / **Severity:** `critical`

See [Section 11](#11-threat-intelligence-feed) for the full feed architecture.

---

### L2.4 · MCP Environment Filter

**File:** `crates/ai-sentinel-layers/src/l2_mcp.rs`
**Direction:** Ingress only
**Can Reject:** No — always mutates or passes

Sanitizes subprocess environment variables before MCP (Model Context Protocol) calls. Prevents credential exfiltration via environment injection attacks.

**Allowed variables (allowlist):**
```
PATH · HOME · USER · LANG · LC_ALL · TERM · SHELL · TMPDIR
```

Any other environment variable in the request is stripped before the payload continues. Returns `LayerResult::Mutate` if anything was removed.

**Why this matters:**
- `LD_PRELOAD` → shared library injection
- `PYTHONHOME` / `PYTHONPATH` → Python interpreter hijack
- `AWS_*` / `GOOGLE_*` → cloud credential exfiltration via subprocess

---

### L3 · Semantic Intent Guard

**File:** `crates/ai-sentinel-layers/src/l3_intent.rs`
**Direction:** Ingress only

Detects topic drift within a session — the "gradually shift to jailbreak" attack pattern.

**Algorithm: Hash-Projection Embeddings**

Pure Rust, deterministic, no model download. Each request is embedded into a 256-dimensional vector:

```
For each word in payload:
  seed = FNV-1a hash of word
  For each of 256 dimensions:
    bit = hash_bit(seed, dimension) using LCG mixing
    vector[dimension] += (bit == 1) ? +1 : -1
Normalize to unit vector (L2)
```

**Drift Detection:**
```
Session start: baseline = embedding of first request
Each request:  similarity = cosine(embedding, baseline)
               if similarity < l3_drift_threshold → REJECT
```

**Current threshold:** `-0.1` (very permissive — only catches strongly anti-correlated content)

**Code:** `INTENT_DRIFT` / **Severity:** `high`

> **Note:** Hash-projection embeddings are a lightweight approximation. The current threshold catches extreme pivots only. See [Section 15](#15-known-gaps--roadmap) for the Phase 2 upgrade to real sentence embeddings.

---

### L4 · Tool & Action Authorization

**File:** `crates/ai-sentinel-layers/src/l4_tools.rs`
**Direction:** Ingress only

Four-stage authorization gate for AI tool calls. Only applies when `tool_manifest` is present in the request.

**ToolManifest structure:**
```json
{
  "tool_name": "query_database",
  "tool_args": { "table": "users", "limit": 100 },
  "allowed_tools": ["query_database", "get_record"],
  "role": "analyst"
}
```

**Check sequence (fail-fast):**

```
1. CVE Tool Patterns
   tool_name matches NVD-sourced CVE pattern?
   → REJECT: TOOL_CVE (critical)

2. Destructive Action Gate
   tool_name contains any of:
   drop · delete · truncate · format · wipe · destroy · purge · rm
   AND role does not have destructive_override: true
   → REJECT: DESTRUCTIVE_TOOL_DENIED (high)

3. RBAC Allowed Tools
   tool_name not in role.allowed_tools (or wildcard "*")
   → REJECT: TOOL_NOT_AUTHORIZED (medium)

4. Forbidden Arguments
   tool_args match per-tool regex pattern
   (e.g., --recursive flag on rm-family tools)
   → REJECT: FORBIDDEN_ARGS (medium)
```

**Examples:**

| tool_name | tool_args | Result |
|-----------|-----------|--------|
| `query_database` | `{table: "users"}` | Pass (if in allowed_tools) |
| `drop_database_prod` | `{force: true}` | REJECT — `drop` keyword |
| `rm_and_wipe_files` | `{path: "/data"}` | REJECT — `rm` + `wipe` keywords |
| `truncate_db_table` | `{table: "logs"}` | REJECT — `truncate` keyword |
| `purge_cache` | `{}` | REJECT — `purge` keyword |

---

### L5 · Execution Sandbox

**File:** `crates/ai-sentinel-layers/src/l5_sandbox.rs`
**Direction:** Ingress only

Rate limiting, cost accounting, and emergency stop. All checks are **session-scoped** — requires `session_id` in the request.

**E-Stop (fastest path):**
- Atomic boolean, checked before any session lookup
- Blocks **all** requests globally (not session-scoped)
- Triggered via `POST /admin/estop`
- Lifted via `POST /admin/estop/lift`
- **Code:** `ESTOP` / **Severity:** `critical`

**Rate Limiting:**
- Token bucket per session: `max_actions_per_hour` (default 1,000)
- Increments on each request passing L5
- Session state persisted to store (memory/Redis/Postgres)
- **Code:** `RATE_LIMIT` / **Severity:** `medium`

**Cost Cap:**
- Per-session daily cost accumulator
- Triggered when `caller_context.cost_usd + session.cost_usd_today > max_cost_per_day` (default $100)
- Requires `cost_usd` in caller_context **and** `session_id` in request
- **Code:** `COST_CAP` / **Severity:** `high`

```
Single request with cost_usd = 101.0 + session_id → REJECT immediately
```

---

### L6 · Output Inspection

**File:** `crates/ai-sentinel-layers/src/l6_output.rs`
**Direction:** Egress only

Guards against the model outputting dangerous content: SSRF-triggerable URLs, exfiltrated secrets, and PII.

#### 6.1 SSRF Prevention

Scans all URLs in egress payload. Rejects if any URL resolves to a private or cloud-metadata address.

**Private ranges blocked:**

| Range | Description |
|-------|-------------|
| `10.0.0.0/8` | RFC-1918 private |
| `172.16.0.0/12` | RFC-1918 private |
| `192.168.0.0/16` | RFC-1918 private |
| `127.0.0.0/8` | Loopback |
| `0.0.0.0/8` | This network |
| `::1` | IPv6 loopback |
| `fe80::/10` | IPv6 link-local |
| `169.254.169.254` | AWS IMDS |
| `169.254.170.2` | Azure IMDS |
| `metadata.google.internal` | GCP metadata |

**Code:** `SSRF_URL` / **Severity:** `critical`

#### 6.2 Exfiltration Pattern Detection

| Pattern | Detects | Code |
|---------|---------|------|
| `[A-Za-z0-9+/]{100,}` | Large base64 blob | `EXFILTRATION_PATTERN` |
| `-----BEGIN (PGP\|RSA) PRIVATE KEY` | Private key blocks | `EXFILTRATION_PATTERN` |
| `-----BEGIN CERTIFICATE` | Certificate exfil | `EXFILTRATION_PATTERN` |
| `INSERT INTO\|CREATE TABLE` | SQL dump | `EXFILTRATION_PATTERN` |
| `AKIA[0-9A-Z]{16}` | AWS access key | `EXFILTRATION_PATTERN` |
| `eyJ[A-Za-z0-9+/]+\.[...]\.[...]` | JWT token | `EXFILTRATION_PATTERN` |
| `(password\|api_key\|secret\|access_token)\s*[:=]\s*\S{8,}` | Credential pairs | `EXFILTRATION_PATTERN` |

**Severity:** `high`

#### 6.3 Egress PII Stripping

Same patterns as L1, applied to model output. Returns `LayerResult::Mutate`. Optional Presidio integration with 20ms timeout.

---

### L7 · Audit Chain

**File:** `crates/ai-sentinel-layers/src/l7_audit.rs`
**Direction:** Both

Tamper-evident audit log. Every request produces an audit record chained to the previous via SHA-256 hash.

**Hash chain formula:**
```
record_hash = SHA256(
  record_id
  + prev_hash            # genesis = 0x000...000
  + timestamp_iso
  + SHA256(payload_json)
)
```

**Audit Record:**
```json
{
  "record_id": "uuid",
  "prev_hash": "sha256_hex",
  "timestamp": "2026-03-26T12:00:00Z",
  "payload_hash": "sha256_hex",
  "record_hash": "sha256_hex",
  "direction": "ingress",
  "decision": "reject",
  "layer": "l1",
  "code": "PROMPT_INJECTION",
  "caller_id": "my-app",
  "session_id": "uuid"
}
```

**Integrity verification:**
```
GET /admin/audit/verify
→ { "valid": true, "record_count": 1234 }
→ { "valid": false, "first_broken_id": "uuid", "record_count": 1234 }
```

The sequential lock on `last_hash` ensures strictly ordered records even under concurrent load.

---

## 5. API Reference

### POST /check

The primary security gate. All AI traffic passes through this endpoint.

**Request:**
```json
{
  "direction": "ingress",
  "payload": {
    "content": "What is the capital of France?"
  },
  "session_id": "optional-uuid",
  "caller_context": {
    "caller_id": "my-app",
    "caller_type": "sdk",
    "api_key_hash": "sha256_hex",
    "trust_token": "agent_id:timestamp:hmac",
    "model": "claude-opus-4-6",
    "provider": "anthropic",
    "prompt_tokens": 15,
    "completion_tokens": 0,
    "cost_usd": 0.0003
  },
  "tool_manifest": {
    "tool_name": "query_db",
    "tool_args": { "table": "users" },
    "allowed_tools": ["query_db"],
    "role": "analyst"
  }
}
```

**Response (pass):**
```json
{
  "status": "pass",
  "request_id": "uuid",
  "session_id": "uuid",
  "payload": { "content": "What is the capital of France?" },
  "reject": null,
  "latency_ms": 8,
  "layers_ran": ["l0", "l1", "l2.1", "l2.2", "l2.3", "l2.4", "l3", "l4", "l5", "l7"]
}
```

**Response (reject):**
```json
{
  "status": "reject",
  "request_id": "uuid",
  "session_id": null,
  "payload": null,
  "reject": {
    "layer": "l1",
    "code": "PROMPT_INJECTION",
    "reason": "Pattern matched: ignore all previous instructions",
    "severity": "high"
  },
  "latency_ms": 3,
  "layers_ran": ["l0", "l1"]
}
```

**Response (mutated — PII stripped):**
```json
{
  "status": "pass",
  "request_id": "uuid",
  "payload": { "content": "My SSN is [REDACTED_SSN]" },
  "reject": null,
  "latency_ms": 12
}
```

---

### Rejection Codes Reference

| Code | Layer | Severity | Description |
|------|-------|----------|-------------|
| `PROMPT_INJECTION` | L1 | high | Injection regex matched |
| `TOKEN_BUDGET_EXCEEDED` | L1 | medium | Payload too large |
| `AUTH_FAILED` | L2.1 | high | Invalid API key or JWT |
| `TRUST_TOKEN_INVALID` | L2.2 | high | HMAC mismatch |
| `TRUST_REPLAY` | L2.2 | high | Token reused within 60s |
| `THREAT_SIGNATURE_MATCH` | L2.3 | critical | Live threat feed hit |
| `INTENT_DRIFT` | L3 | high | Topic drift in session |
| `TOOL_CVE` | L4 | critical | Tool matches CVE pattern |
| `DESTRUCTIVE_TOOL_DENIED` | L4 | high | Destructive keyword in tool_name |
| `TOOL_NOT_AUTHORIZED` | L4 | medium | Tool not in RBAC allowed list |
| `FORBIDDEN_ARGS` | L4 | medium | Forbidden argument pattern |
| `ESTOP` | L5 | critical | Emergency stop active |
| `RATE_LIMIT` | L5 | medium | Session rate limit exceeded |
| `COST_CAP` | L5 | high | Daily cost cap exceeded |
| `SSRF_URL` | L6 | critical | Private/metadata URL in egress |
| `EXFILTRATION_PATTERN` | L6 | high | Secret/credential in egress |

---

### Admin Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/admin/estop` | Bearer admin_token | Trigger global emergency stop |
| `POST` | `/admin/estop/lift` | Bearer admin_token | Resume after e-stop |
| `POST` | `/admin/feed/refresh` | Bearer admin_token | Trigger async threat feed refresh |
| `GET` | `/admin/signatures` | Bearer admin_token | Current signature set stats |
| `GET` | `/admin/audit/verify` | Bearer admin_token | Verify audit hash chain |

### Monitoring Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness probe (200 = alive) |
| `GET` | `/ready` | Readiness + feed/layer status |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/ui` | Admin dashboard (HTML) |
| `GET` | `/openapi.json` | OpenAPI 3.1 spec |
| `GET` | `/docs` | Scalar API explorer |

---

## 6. Infrastructure Services

### Directory Structure

```
ai-sentinel/
├── Dockerfile                    Rust multi-stage build
├── Cargo.toml                    Workspace definition
├── docker-compose.yml            All 7 services
├── config/
│   ├── default.toml              Base configuration
│   ├── enterprise.toml           Enterprise overrides
│   ├── minimal.toml              Lightweight testing config
│   └── profiles/
│       ├── msp.toml              Managed Service Provider profile
│       ├── ndt.toml              Non-Destructive Testing profile
│       └── pi-law.toml           Personal Injury Law profile
├── infra/
│   ├── env                       Docker env vars (not committed)
│   ├── prometheus.yml            Scrape config
│   └── grafana/
│       ├── provisioning/         Datasource + dashboard provisioning
│       └── dashboards/           Pre-built Grafana JSON dashboards
├── crates/
│   ├── ai-sentinel-api/          HTTP server (Axum + routes + static UI)
│   ├── ai-sentinel-core/         Core types, pipeline executor, layer trait
│   ├── ai-sentinel-layers/       All 8 layer implementations
│   ├── ai-sentinel-feed/         Threat intelligence worker
│   └── ai-sentinel-store/        Session store (memory/Postgres/Redis)
├── sdk/python/                   Python SDK
├── sentinel-tester/              Test harness container
└── tests/                        Rust integration tests
```

### Docker Compose Services

```
┌────────────────────────────────────────────────────────────────────────┐
│  docker-compose.yml — 7 services on sentinel-net bridge                │
│                                                                         │
│  ┌──────────────────┬──────────┬────────────────────────────────────┐  │
│  │ Service          │ Port     │ Notes                               │  │
│  ├──────────────────┼──────────┼────────────────────────────────────┤  │
│  │ agentsec         │ 8080     │ Main API; Rust binary, UID 65534   │  │
│  │ presidio         │ 3000     │ Microsoft PII analyzer (internal)  │  │
│  │ postgres         │ 5432     │ Session store; Alpine 16           │  │
│  │ redis            │ 6379     │ Cache / distributed sessions       │  │
│  │ prometheus       │ 9090     │ Metrics scrape; 15s interval       │  │
│  │ grafana          │ 3001     │ Dashboards; anon read access       │  │
│  │ sentinel-tester  │ 8090     │ Python FastAPI test harness        │  │
│  └──────────────────┴──────────┴────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

### Dockerfile (agentsec)

Multi-stage build for minimal runtime image:

```
Stage 1: Build
  FROM rust:latest
  + libssl-dev, pkg-config
  + cargo build --release
  + strip binary

Stage 2: Runtime
  FROM debian:bookworm-slim
  + ca-certificates
  + Copy stripped binary
  + Non-root user: UID 65534 (nobody)
  + EXPOSE 8080
  + CMD ["./ai-sentinel"]
```

### Environment Variables

Key variables loaded from `./infra/env`:

```bash
# Core
AI_SENTINEL_HOST=0.0.0.0
AI_SENTINEL_PORT=8080
AI_SENTINEL_LOG_LEVEL=info

# Store
AI_SENTINEL_STORE_BACKEND=memory     # memory | postgres | redis
AI_SENTINEL_DB_PASSWORD=sentinel_dev
AI_SENTINEL_PRESIDIO_URL=http://presidio:3000

# Feed sources (optional)
AI_SENTINEL_CROWDSEC_API_KEY=
AI_SENTINEL_NVD_API_KEY=

# Admin
AI_SENTINEL_ADMIN_TOKEN=
AI_SENTINEL_GRAFANA_PASSWORD=admin
```

---

## 7. Sentinel-Tester: Test Harness

The `sentinel-tester` is a standalone FastAPI container that:
- Provides a browser UI (second tab in the admin dashboard)
- Runs a 22-case test suite covering all security layers
- Supports auto-mode continuous fuzzing with server-side execution
- Streams live results via SSE (continues when browser tab switches)
- Exposes JSON export and bulk clear controls

### Architecture

```
Browser (ui.html — "Tester" tab)
         │
         │  SSE EventSource  →  GET /api/stream
         │  fetch JSON       →  GET/POST/DELETE /api/*
         ▼
sentinel-tester :8090 (FastAPI)
         │
         │  httpx AsyncClient
         ▼
agentsec :8080  POST /check
```

### Sentinel-Tester API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/run` | Start a test run (accepts `TestConfig`) |
| `POST` | `/api/stop` | Signal stop to background runner |
| `GET` | `/api/stream` | SSE stream — replays buffer + live events |
| `GET` | `/api/results` | Full result buffer as JSON array |
| `DELETE` | `/api/results` | Clear buffer, reset counters, cancel run |
| `GET` | `/api/export` | Download `sentinel-test-results.json` |
| `GET` | `/api/status` | `{running, elapsed_s, passed, failed, ...}` |

### Run Modes

**Single Pass:** Fires all 22 test cases once, sequentially. Reports pass/fail per case. Duration: ~30–45 seconds.

**Auto Mode:** Continuous weighted sampling until duration expires or stop is clicked. Runs server-side — survives browser tab switches.

```python
TestConfig:
  mode            "single" | "auto"
  rate            1–20 req/s
  violation_pct   0–100 (% of auto requests that are violations)
  duration_min    1–60
  concurrency     1–10
  severity_filter ["low", "medium", "high", "critical"]
```

### BackgroundRunner

```
BackgroundRunner
  ├── asyncio.Task          Background test loop
  ├── asyncio.Event         Stop flag
  ├── List[TestResult]      Result buffer (replayed on SSE reconnect)
  ├── Set[asyncio.Queue]    SSE subscriber fan-out
  └── asyncio.Lock          Shared state protection

_run_single():
  For each TestCase in TEST_CASES:
    If severity in filter: fire, record, publish

_run_auto():
  While elapsed < duration AND not stop:
    Roll random 0–99
    If roll < violation_pct: pick random VIOLATION case
    Else: pick random CLEAN case
    Fire, record, publish
    Sleep(1/rate)

_fire(tc):
  t0 = monotonic()
  POST /check with tc.payload
  actual = response["status"]
  actual_layer = response["reject"]["layer"] if rejected
  latency_ms = (monotonic() - t0) * 1000
  outcome = "pass" if actual == expected else "fail"
  return TestResult(...)
```

### 22 Test Cases

```
┌────────┬───────────────────────────────────────┬───────────┬──────────┬─────────────┐
│ ID     │ Name                                  │ Direction │ Expected │ Layer       │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│ pi-001 │ Prompt Injection — Ignore Instruct.   │ ingress   │ reject   │ L1          │
│ pi-002 │ Prompt Injection — Jailbreak Safety   │ ingress   │ reject   │ L1          │
│ pi-003 │ Prompt Injection — Act As DAN         │ ingress   │ reject   │ L1          │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│ pii-001│ PII — SSN (Stripped, Not Blocked)     │ ingress   │ pass     │ L1 (mutate) │
│ pii-002│ PII — Credit Card (Stripped)          │ ingress   │ pass     │ L1 (mutate) │
│ pii-003│ PII — Email (Stripped)                │ ingress   │ pass     │ L1 (mutate) │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│ inj-001│ SQL Injection (L1 Gap — Passes)       │ ingress   │ pass     │ none (gap)  │
│ inj-002│ Command Injection (L1 Gap — Passes)   │ ingress   │ pass     │ none (gap)  │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│tool-001│ Destructive Tool — rm Files           │ ingress   │ reject   │ L4          │
│tool-002│ Destructive Tool — truncate Table     │ ingress   │ reject   │ L4          │
│tool-003│ Destructive Tool — drop Database      │ ingress   │ reject   │ L4          │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│ssrf-001│ SSRF — Private IP (RFC-1918)          │ egress    │ reject   │ L6          │
│ssrf-002│ SSRF — Localhost                      │ egress    │ reject   │ L6          │
│ssrf-003│ SSRF — AWS Cloud Metadata             │ egress    │ reject   │ L6          │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│exfil-01│ Exfiltration — AWS IAM Key            │ egress    │ reject   │ L6          │
│exfil-02│ Exfiltration — PGP Private Key        │ egress    │ reject   │ L6          │
│exfil-03│ Exfiltration — JWT Token              │ egress    │ reject   │ L6          │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│drift-01│ Intent Drift (L3 Gap — Permissive)    │ ingress   │ pass     │ none (gap)  │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│cost-001│ Daily Cost Cap Exceeded               │ ingress   │ reject   │ L5          │
├────────┼───────────────────────────────────────┼───────────┼──────────┼─────────────┤
│clean-01│ Clean Ingress — Geography             │ ingress   │ pass     │ none        │
│clean-02│ Clean Egress — Geography              │ egress    │ pass     │ none        │
│clean-03│ Clean Ingress — Medical               │ ingress   │ pass     │ none        │
└────────┴───────────────────────────────────────┴───────────┴──────────┴─────────────┘
```

### Dashboard UI (Tester Tab)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  [ Dashboard ]  [ Tester ]                                                │
├──────────────────────────────────────────────────────────────────────────┤
│  CONFIGURATION                                                            │
│                                                                           │
│  Request Rate   [━━━━●━━━━━━━━━━━] 5 req/s                               │
│  Violation %    [━━━━━━━━●━━━━━━━] 60%                                    │
│  Concurrency    [━●━━━━━━━━━━━━━━] 1                                      │
│  Severity  [✓]Low  [✓]Medium  [✓]High  [✓]Critical                        │
│                                                                           │
│  Auto Mode Duration  [━━━━●━━━━━━━━━━] 5 min                             │
│                                                                           │
│  [▶ RUN SINGLE PASS]  [▶ START AUTO]  [■ STOP]                           │
│  [🗑 CLEAR]  [⬇ EXPORT JSON]                                               │
├──────────────────────────────────────────────────────────────────────────┤
│  STATUS  ● Running  Sent: 42  Passed: 38  Failed: 4  14.2s               │
├──────────────────────────────────────────────────────────────────────────┤
│  LIVE RESULTS (newest first)                                              │
│  ┌────────────────────┬──────────┬────────────────────┬───────┬───────┐  │
│  │ Test               │ Expected │ Actual             │ Result│  ms   │  │
│  ├────────────────────┼──────────┼────────────────────┼───────┼───────┤  │
│  │ Prompt Injection 1 │ REJECT   │ REJECT (l1)        │  ✅   │   3   │  │
│  │ Clean Ingress      │ PASS     │ PASS               │  ✅   │   8   │  │
│  │ SSRF Private IP    │ REJECT   │ REJECT (l6)        │  ✅   │   5   │  │
│  │ Cost Cap           │ REJECT   │ REJECT (l5)        │  ✅   │   2   │  │
│  └────────────────────┴──────────┴────────────────────┴───────┴───────┘  │
└──────────────────────────────────────────────────────────────────────────┘

  Green row = outcome matched expected
  Red row   = mismatch (unexpected pass or unexpected reject)
  Max 500 rows in DOM; Export JSON for full history
```

---

## 8. Monitoring Stack

### Prometheus Metrics

Scraped from `agentsec:8080/metrics` every 15 seconds.

| Metric | Type | Description |
|--------|------|-------------|
| `ai_sentinel_requests_total` | Counter | Total requests by direction and status |
| `ai_sentinel_layer_faults_total` | Counter | Layer errors by layer name |
| `ai_sentinel_pii_stripped_total` | Counter | PII entities stripped by type |
| `ai_sentinel_rate_limit_total` | Counter | Rate limit hits by session |
| `ai_sentinel_trust_replay_attempts` | Counter | Replay attack attempts |
| `ai_sentinel_latency_ms` | Histogram | Request latency distribution |

### Grafana Dashboard

Available at `http://10.10.110.36:3001` (or `/grafana` path via Traefik).

**Panels:**
- Request rate (req/s over time)
- Rejection breakdown by layer and code
- P50 / P95 / P99 latency
- PII strip rate
- Rate limit events
- Layer fault rate
- Presidio health (response time)

### Health Endpoints

```bash
# Liveness
GET /health
→ { "service": "ai-sentinel", "status": "ok" }

# Readiness (includes layer states)
GET /ready
→ {
    "status": "ok",
    "layers": { "l0": "ok", "l1": "ok", ... },
    "threat_feed": { "injection_patterns": 47, "cve_patterns": 12 },
    "audit_records": 8231,
    "e_stop": false
  }
```

---

## 9. Configuration System

Configuration is loaded in order (later sources override earlier):
1. `config/default.toml` — base defaults
2. `config/{profile}.toml` — vertical profile (if `AI_SENTINEL_CONFIG_PROFILE` set)
3. Environment variables (`AI_SENTINEL_*` prefix, uppercase snake_case)
4. `config_override` in individual requests (per-request fine-tuning)

### Key Configuration Values

```toml
# HTTP server
host = "0.0.0.0"
port = 8080

# Layer enables (all default true)
layer_l0_enabled = true
layer_l1_enabled = true
layer_l2_auth_enabled = true
layer_l2_trust_enabled = true
layer_l2_threat_enabled = true
layer_l2_mcp_enabled = true
layer_l3_enabled = true
layer_l4_enabled = true
layer_l5_enabled = true
layer_l6_enabled = true
layer_l7_enabled = true

# Telemetry
telemetry_level = "standard"      # off|minimal|standard|full|debug
telemetry_pii_redact = true

# Store
store_backend = "memory"           # memory|postgres|redis
database_url = ""
redis_url = ""

# Rate limits
rate_max_actions_per_hour = 1000
rate_max_cost_per_day = 100.0
rate_max_tokens_per_request = 100000

# L1 Presidio (optional)
presidio_url = "http://presidio:3000"

# L3 Intent Drift
l3_drift_threshold = -0.1          # -1.0 to 1.0; lower = more permissive
l3_baseline_window = 5             # requests before baseline established
l3_drift_webhook = ""              # optional URL to POST on drift

# L4 Tool Auth
l4_rbac_path = ""                  # path to roles JSON file

# Threat Feed
feed_interval_secs = 3600
crowdsec_api_key = ""
nvd_api_key = ""
custom_feed_path = ""

# Admin
admin_token = ""                   # required for /admin/* endpoints
```

### Vertical Profiles

**NDT (Non-Destructive Testing):**
- Strict tool authorization (measurement instrument APIs only)
- Extended rate limits (batch inspection jobs)
- Cost tracking per project

**MSP (Managed Service Provider):**
- Multi-tenant isolation via session namespacing
- Strict RBAC — tools scoped per customer tier
- Audit export hooks

**PI Law (Personal Injury Law):**
- HIPAA-aligned PII stripping (SSN, phone, DOB, medical record numbers)
- Extended L6 egress PII
- Strict egress for client communications

---

## 10. Session Store

Sessions provide persistent state for L3 (drift), L5 (rate/cost), and L2.2 (replay detection). A request without `session_id` is stateless — L3 and L5 are effectively no-ops.

### Session State

```rust
SessionState {
  session_id: String,
  caller_id: String,
  action_count: u64,                     // L5 rate: incremented per request
  cost_usd_today: f64,                   // L5 cost: accumulated daily
  tokens_today: u64,
  created_at, updated_at: DateTime<Utc>,
  e_stop: bool,                          // per-session override
  seen_trust_tokens: HashMap<String, i64>, // L2.2 replay cache
  embedding_baseline: Option<Vec<f32>>,  // L3 drift (Phase 2)
}
```

### Store Implementations

| Backend | Use Case | Notes |
|---------|----------|-------|
| `memory` | Development, single-instance | DashMap, 24h TTL, lost on restart |
| `postgres` | Production, persistence | sqlx, survives restart |
| `redis` | Distributed, horizontal scale | Deadpool, shared across instances |

---

## 11. Threat Intelligence Feed

The feed worker runs in the background, fetching fresh signatures on a configurable interval.

```
┌──────────────────────────────────────────────────────────────┐
│  Feed Worker (background task)                                │
│                                                               │
│  ┌────────────┐  ┌───────────────┐  ┌──────────┐  ┌───────┐ │
│  │ OWASP LLM  │  │  CrowdSec CTI │  │  NVD CVE │  │Custom │ │
│  │ Top 10     │  │  (API key)    │  │ (API key)│  │ Feed  │ │
│  │ (bundled)  │  │               │  │          │  │       │ │
│  └──────┬─────┘  └──────┬────────┘  └────┬─────┘  └───┬───┘ │
│         │               │                │             │     │
│         └───────────────┴────────────────┴─────────────┘     │
│                                 │                             │
│                    ┌────────────▼────────────┐                │
│                    │  SignatureSet (compiled) │                │
│                    │  injection_patterns: 47  │                │
│                    │  cve_tool_patterns: 12   │                │
│                    │  cve_ids: [...]          │                │
│                    └────────────┬────────────┘                │
│                                 │ atomic swap                 │
│                    ┌────────────▼────────────┐                │
│                    │  LiveSignatures          │                │
│                    │  Arc<RwLock<Arc<Set>>>   │                │
│                    │  readers never block     │                │
│                    └─────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
                              ▲
                              │ read (lock-free)
                    ┌─────────┴─────────┐
                    │  L2.3 / L4        │
                    │  per-request check │
                    └───────────────────┘
```

**Hot-swap mechanism:**
- New `SignatureSet` compiled from all sources
- Wrapped in `Arc`
- `RwLock::write()` held only for the pointer swap (~1μs)
- All in-flight L2.3/L4 checks continue reading old set
- Zero request interruption during refresh

---

## 12. Python SDK

Located at `sdk/python/ai_sentinel_sdk/`.

**Core interface:**

```python
from ai_sentinel_sdk import SentinelClient, Direction

client = SentinelClient(base_url="http://localhost:8080")

# Ingress check
result = client.check(
    direction=Direction.INGRESS,
    payload={"content": "What is the capital of France?"},
    caller_context={"caller_id": "my-app", "caller_type": "sdk"},
    session_id="user-session-123"
)

if result.status == "reject":
    print(f"Blocked at {result.reject.layer}: {result.reject.code}")
else:
    # Use result.payload (may be mutated)
    forward_to_model(result.payload)
```

**Async variant:**
```python
async with AsyncSentinelClient(base_url="http://localhost:8080") as client:
    result = await client.check(...)
```

---

## 13. Performance Characteristics

Load tested on VM `10.10.110.36` (specs: 4 vCPU, 16 GB RAM).

### Throughput vs Concurrency

```
Clean Ingress (Presidio in path):

  Concurrency  │  RPS    │  p50    │  p95    │  p99    │  CPU (agentsec) │  CPU (presidio)
  ─────────────┼─────────┼─────────┼─────────┼─────────┼─────────────────┼────────────────
       1        │   52    │  18ms   │  24ms   │  31ms   │      ~0%        │     40%
       5        │  280    │  16ms   │  22ms   │  35ms   │      ~0%        │     85%
      10        │  396    │  19ms   │  38ms   │  48ms   │      ~0%        │    101%
      25        │  312    │  48ms   │  95ms   │  142ms  │      ~0%        │    101% (queued)
      50        │  289    │  98ms   │  185ms  │  267ms  │      ~0%        │    101% (queued)
     100        │  274    │  195ms  │  380ms  │  520ms  │      ~0%        │    101% (queued)
     200        │  248    │  394ms  │  743ms  │  998ms  │      ~0%        │    101% (queued)

Violation/Reject (Presidio NOT in path — rejected at L1 regex):

  Concurrency  │  RPS    │  p50    │  p95    │  p99
  ─────────────┼─────────┼─────────┼─────────┼─────────
       1        │   78    │  12ms   │  16ms   │  19ms
      25        │  398    │  11ms   │  18ms   │  25ms
     100        │  522    │  12ms   │  19ms   │  27ms
```

### Bottleneck Analysis

```
agentsec binary:  ~0% CPU, 49 MiB RAM (at full load)
presidio:        101% CPU, 811 MiB RAM (Python NLP, the bottleneck)

Throughput sweet spot: c=5 to c=10
  → 280–396 req/s, p50 ≤ 19ms, p99 ≤ 50ms

Above c=10: Presidio queue backs up → latency spike
Violations are faster because L1 regex rejects BEFORE calling Presidio
```

### Peak Throughput

- **Clean ingress:** 396 req/s @ c=10
- **Violation reject:** 522 req/s @ c=100 (bypasses Presidio)
- **Mixed workload:** ~380 req/s @ c=25

### Latency Budget (clean ingress, c=10)

```
L0 Telemetry:      < 0.1ms (async write)
L1 Injection scan:   0.2ms (regex)
L1 Presidio call:  14-18ms (HTTP round-trip to container — dominant)
L1 PII regex:        0.1ms
L2.1 Auth:           0.1ms (hash compare)
L2.2 Trust:          0.2ms (HMAC verify)
L2.3 Threat:         0.3ms (RegexSet)
L2.4 MCP:            0.1ms
L3 Intent:           0.5ms (hash-projection)
L4 Tools:            0.1ms (if no tool_manifest)
L5 Sandbox:          0.2ms (session lookup)
L7 Audit:            0.3ms (SHA-256)
─────────────────────────────
Total p50:          ~19ms   (Presidio dominates)
```

---

## 14. Deployment Topology

### Current State (2026-03-26)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Proxmox Homelab                                                           │
│                                                                            │
│  ┌──────────────────────────────┐   ┌────────────────────────────────┐    │
│  │  Proxy VM (on-nex.us)        │   │  VM: 10.10.110.36              │    │
│  │                              │   │  ai-sentinel host               │    │
│  │  Traefik                     │   │                                 │    │
│  │  - ai-sentinel.on-nex.us     │   │  Docker Compose:               │    │
│  │    → file provider           │   │  - agentsec       :8080        │    │
│  │    → http://10.10.110.36:8080│   │  - presidio       :3000        │    │
│  │                              │   │  - postgres       :5432        │    │
│  │  Let's Encrypt TLS           │   │  - redis          :6379        │    │
│  └──────────────────────────────┘   │  - prometheus     :9090        │    │
│                                     │  - grafana        :3001        │    │
│  ┌──────────────────────────────┐   │  - sentinel-tester:8090        │    │
│  │  GitLab (self-hosted)        │   └────────────────────────────────┘    │
│  │  CI/CD for deploys           │                                         │
│  └──────────────────────────────┘                                         │
└────────────────────────────────────────────────────────────────────────────┘
```

### Traefik Routing (file provider)

The Docker labels in `docker-compose.yml` are only functional if Traefik runs on the same Docker host. Since Traefik is on the proxy VM, the correct routing is via a **file provider** config on the proxy VM:

```yaml
# /etc/traefik/dynamic/ai-sentinel.yml

http:
  routers:
    ai-sentinel:
      rule: "Host(`ai-sentinel.on-nex.us`)"
      entryPoints:
        - websecure
      tls:
        certResolver: letsencrypt
      service: ai-sentinel

  services:
    ai-sentinel:
      loadBalancer:
        servers:
          - url: "http://10.10.110.36:8080"
```

> The Docker labels in `docker-compose.yml` can be removed or left (they are inert for this topology).

### Deploy Commands

```bash
# SSH into VM
ssh root@10.10.110.36

# First deploy
cd /opt/ai-sentinel
git pull
docker compose build
docker compose up -d

# Update (no-downtime rolling)
docker compose build agentsec
docker compose up -d --no-deps agentsec

# Rebuild test harness only
docker compose build sentinel-tester
docker compose up -d --no-deps sentinel-tester

# View logs
docker compose logs -f agentsec
docker compose logs -f sentinel-tester

# Check all container health
docker compose ps

# Emergency stop (stops all AI traffic without killing containers)
curl -X POST http://localhost:8080/admin/estop \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Lift e-stop
curl -X POST http://localhost:8080/admin/estop/lift \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Access URLs

| Resource | URL | Notes |
|----------|-----|-------|
| Admin Dashboard | `https://ai-sentinel.on-nex.us/ui` | Public via Traefik |
| API (check endpoint) | `https://ai-sentinel.on-nex.us/check` | Public via Traefik |
| API Docs (Scalar) | `https://ai-sentinel.on-nex.us/docs` | Public via Traefik |
| OpenAPI spec | `https://ai-sentinel.on-nex.us/openapi.json` | Public |
| Grafana | `http://10.10.110.36:3001` | LAN/VPN only |
| Prometheus | `http://10.10.110.36:9090` | LAN/VPN only |
| Sentinel-Tester | `http://10.10.110.36:8090` | LAN/VPN only |
| Tester UI | `https://ai-sentinel.on-nex.us/ui` → "Tester" tab | Via dashboard |

---

## 15. Known Gaps & Roadmap

### Current Gaps

| Gap | Layer | Impact | Phase 2 Fix |
|-----|-------|--------|-------------|
| SQL injection not detected | L1 | Medium — passes through | Add SQL pattern set to L1 or new L2.x |
| Command injection not detected | L1 | Medium — passes through | Add shell metachar patterns |
| L3 drift too permissive | L3 | High — crypto-fraud pivot passes | Real sentence embeddings + threshold 0.7 |
| Presidio is bottleneck | L1/L6 | 101% CPU limits throughput | Optional async Presidio or faster PII lib |
| Traefik labels unused | infra | Low — cosmetic | Remove from compose or move Traefik to same host |

### Phase 2 Priorities

1. **L3 Real Embeddings**
   - Replace hash-projection with SentenceTransformers (`all-MiniLM-L6-v2`)
   - Threshold: `0.7` (cosine similarity)
   - Expected: catches semantic jailbreaks (cryptocurrency laundering, fraud pivots)
   - Implementation: Python microservice or ONNX runtime in Rust

2. **SQL/Command Injection Patterns**
   - Add to L1 injection regex set:
     - `(?i)(union\s+select|insert\s+into|drop\s+table|';--)` for SQL
     - `(?i)(\$\(|`|\|\s*(bash|sh|zsh)|;\s*rm\s+-rf)` for command injection

3. **Presidio Scaling**
   - Scale presidio horizontally (`presidio-analyzer` replicas)
   - Or replace with `pii-detect-rs` (Rust NER, ~3ms vs 15ms)
   - Or move Presidio to async path (non-blocking, scan in background)

4. **Telemetry Backend**
   - Add Datadog/Splunk/OpenTelemetry exporters
   - Currently stdout JSON only

5. **Multi-Tenant Sessions**
   - Namespace sessions by `caller_id` prefix
   - Tenant-scoped rate limits and cost caps

6. **CI/CD Pipeline**
   - GitLab CI: build → test → deploy to `10.10.110.36`
   - Integration test suite (`tests/`) wired to CI
   - Sentinel-tester single-pass run as CI smoke test

---

## Appendix: Crate Dependency Graph

```
ai-sentinel (workspace root)
├── ai-sentinel-api          HTTP server, routing, static UI
│   ├── ai-sentinel-core     Pipeline executor, layer trait, types
│   │   ├── ai-sentinel-layers  L0–L7 implementations
│   │   │   ├── ai-sentinel-feed    Threat intel worker
│   │   │   └── ai-sentinel-store   Session backends
│   │   └── (external: axum, tokio, serde, sha2, hmac, regex, dashmap)
│   └── (external: tower, tower-http, utoipa for OpenAPI)
└── (integration tests)
```

---

*Documentation generated 2026-03-26. Reflects current production state on `10.10.110.36`.*
