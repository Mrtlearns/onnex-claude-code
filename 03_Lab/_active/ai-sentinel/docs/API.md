# AI-Sentinel API Reference

**Base URL:** `http://localhost:8080` (or configured host:port)
**Wire format:** JSON. All enum values are lowercase (e.g. `"ingress"`, `"pass"`).

---

## POST /check

Primary endpoint. Runs all applicable pipeline layers for a request.

### Request

```json
{
  "direction": "ingress",
  "payload": { "content": "What is the capital of France?" },
  "session_id": "optional-session-uuid",
  "caller_context": {
    "caller_id": "my-agent",
    "caller_type": "sdk",
    "cost_usd": 0.001,
    "model": "claude-opus-4-6"
  },
  "tool_manifest": null,
  "config_override": null
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `direction` | `"ingress"` \| `"egress"` | ✅ | Request direction |
| `payload` | any JSON | ✅ | Payload to inspect |
| `session_id` | string | — | Session ID for stateful checks (L3, L5) |
| `caller_context.caller_id` | string | ✅ | Unique caller identifier |
| `caller_context.caller_type` | `"sdk"` \| `"n8n"` \| `"temporal"` \| `"unknown"` | — | Caller type |
| `caller_context.cost_usd` | float | — | Request cost for L5 daily cap |
| `tool_manifest` | object | — | Tool list for L4 RBAC checks |
| `config_override` | object | — | Per-request policy overrides |

### Response

```json
{
  "status": "pass",
  "reject": null,
  "payload": { "content": "What is the capital of France?" },
  "layers_ran": ["l1", "l2.1", "l2.2", "l2.3", "l2.4", "l3", "l4", "l5"],
  "latency_ms": 12,
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

On rejection:

```json
{
  "status": "reject",
  "reject": {
    "layer": "l1",
    "code": "PROMPT_INJECTION",
    "reason": "Prompt injection pattern detected",
    "severity": "high"
  },
  "payload": null,
  "layers_ran": ["l1"],
  "latency_ms": 3
}
```

### Rejection Codes

| Code | Layer | Severity | Trigger |
|------|-------|----------|---------|
| `PROMPT_INJECTION` | l1 | high | Injection pattern matched |
| `TOKEN_BUDGET_EXCEEDED` | l1 | medium | Token count > max_tokens_per_request |
| `AUTH_FAILED` | l2.1 | high | Invalid JWT or API key |
| `TRUST_TOKEN_INVALID` | l2.2 | high | HMAC verification failed |
| `TRUST_TOKEN_REPLAY` | l2.2 | high | Trust token reused within 60s |
| `THREAT_SIGNATURE_MATCH` | l2.3 | high | Payload matched threat intel feed |
| `INTENT_DRIFT` | l3 | high | Cosine similarity below threshold |
| `TOOL_NOT_ALLOWED` | l4 | high | Tool not in RBAC allowed list |
| `DESTRUCTIVE_ACTION` | l4 | critical | drop/delete/truncate/format detected |
| `RATE_LIMIT` | l5 | medium | Actions per hour exceeded |
| `COST_CAP` | l5 | high | Daily cost cap exceeded |
| `ESTOP` | l5 | critical | Emergency stop active |
| `SSRF_URL` | l6 | critical | Private IP or cloud metadata URL in egress |
| `EXFILTRATION_PATTERN` | l6 | high | Exfiltration pattern in egress payload |

---

## GET /health

Liveness check. Returns `200` when the process is alive.

```json
{ "service": "ai-sentinel", "status": "ok" }
```

---

## GET /ready

Readiness check. Returns layer status and feed statistics.

```json
{
  "status": "ready",
  "layers": ["l1", "l2.1", "l2.2", "l2.3", "l2.4", "l3", "l4", "l5", "l6", "l7"],
  "feed": { "pattern_count": 14, "cve_count": 0 },
  "audit": { "record_count": 42 },
  "e_stop": false
}
```

---

## GET /metrics

Prometheus metrics endpoint.

```
# HELP ai_sentinel_requests_total Total requests processed
ai_sentinel_requests_total 42

# HELP ai_sentinel_layer_faults_total Total layer faults (fail-open)
ai_sentinel_layer_faults_total 0

# HELP ai_sentinel_pii_stripped_total Requests where PII was stripped
ai_sentinel_pii_stripped_total 3

# HELP ai_sentinel_rate_limit_total Requests rejected by rate limiter
ai_sentinel_rate_limit_total 1

# HELP ai_sentinel_trust_replay_attempts Trust token replay attempts
ai_sentinel_trust_replay_attempts 0

# HELP ai_sentinel_latency_ms Request latency milliseconds
ai_sentinel_latency_ms_sum 504
```

---

## Admin Endpoints

All admin endpoints require `Authorization: Bearer <admin_token>`.

### POST /admin/estop

Activate emergency stop. All subsequent requests will return `ESTOP` rejection.

```json
{ "status": "estop_active" }
```

### POST /admin/estop/lift

Deactivate emergency stop.

```json
{ "status": "estop_lifted" }
```

### POST /admin/feed/refresh

Trigger immediate threat intel feed refresh (async, returns immediately).

```json
{ "status": "refresh_triggered" }
```

### GET /admin/signatures

Return current threat signature stats.

```json
{ "pattern_count": 14, "cve_count": 0 }
```

### GET /admin/audit/verify

Verify SHA-256 hash chain integrity.

```json
{ "status": "ok", "records_verified": 42 }
```

On tamper detection:

```json
{ "status": "integrity_failure", "first_bad_record_id": "req-abc123" }
```

---

## GET /openapi.json

OpenAPI 3.1 specification.

## GET /docs

Scalar API explorer UI.
