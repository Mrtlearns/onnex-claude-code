# AI-Sentinel Integration Guide

---

## Python SDK

```bash
pip install -e ./sdk/python
# or when published: pip install ai-sentinel-sdk
```

### Basic usage

```python
from ai_sentinel_sdk import SentinelClient

with SentinelClient(base_url="http://ai-sentinel:8080", caller_id="my-app") as sentinel:
    # Guard an LLM input — raises ValueError if blocked
    resp = sentinel.check_input({"content": "What is the capital of France?"})

    # Guard an LLM output — returns mutated payload if PII was stripped
    resp = sentinel.check_output({"content": "The capital is Paris."})
    safe_output = resp.payload or original_output
```

### Session-aware multi-turn

```python
from ai_sentinel_sdk import SentinelClient
from ai_sentinel_sdk.session import SessionContext

with SentinelClient(base_url="http://ai-sentinel:8080") as sentinel:
    with SessionContext(sentinel, session_id="chat-user-123") as session:
        session.check_input({"content": turn1})   # Establishes L3 baseline
        session.check_input({"content": turn2})   # Checked against baseline
        session.check_output({"content": reply})  # Egress PII scan
```

### Async

```python
from ai_sentinel_sdk import AsyncSentinelClient
from ai_sentinel_sdk.session import AsyncSessionContext

async with AsyncSentinelClient(base_url="http://ai-sentinel:8080") as sentinel:
    async with AsyncSessionContext(sentinel) as session:
        await session.check_input({"content": "Hello"})
```

### Per-request policy override

```python
from ai_sentinel_sdk.policy import PolicyBuilder

policy = PolicyBuilder().max_tokens(2048).drift_threshold(-0.2).build()
sentinel.check_input(prompt, config_override=policy)
```

---

## n8n Integration

Use the **HTTP Request** node:

```
Method: POST
URL: http://ai-sentinel:8080/check
Headers: Content-Type: application/json
Body (JSON):
{
  "direction": "ingress",
  "payload": {{ $json.prompt }},
  "session_id": "{{ $json.session_id }}",
  "caller_context": {
    "caller_id": "n8n-workflow",
    "caller_type": "n8n"
  }
}
```

Add an **IF** node after:
- Condition: `{{ $json.status }}` equals `reject`
- True branch: return error to caller
- False branch: pass payload to LLM node

---

## Claude Code Integration

Add to your CLAUDE.md or system prompt wrapper:

```python
import anthropic
from ai_sentinel_sdk import SentinelClient

sentinel = SentinelClient(base_url="http://localhost:8080", caller_id="claude-code")
client = anthropic.Anthropic()

def safe_completion(prompt: str, session_id: str = None) -> str:
    # Guard input
    sentinel.check_input({"content": prompt}, session_id=session_id)

    # Call Claude
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}]
    )
    output = response.content[0].text

    # Guard output
    result = sentinel.check_output({"content": output}, session_id=session_id)
    return result.payload["content"] if result.payload else output
```

---

## Docker Compose (sidecar pattern)

```yaml
services:
  your-app:
    image: your-app:latest
    environment:
      AI_SENTINEL_URL: http://ai-sentinel:8080
    depends_on:
      ai-sentinel:
        condition: service_healthy

  ai-sentinel:
    image: ai-sentinel:latest
    env_file: infra/env
    ports:
      - "8080:8080"
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 3
```

---

## Direct HTTP (curl)

```bash
# Ingress check
curl -X POST http://localhost:8080/check \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "ingress",
    "payload": {"content": "What is the capital of France?"},
    "caller_context": {"caller_id": "curl-test", "caller_type": "unknown"}
  }'

# Egress check
curl -X POST http://localhost:8080/check \
  -H "Content-Type: application/json" \
  -d '{
    "direction": "egress",
    "payload": {"content": "The capital of France is Paris."},
    "caller_context": {"caller_id": "curl-test", "caller_type": "unknown"}
  }'
```

---

## White-label Profiles

Load a vertical profile by setting the `AI_SENTINEL_PROFILE` env var:

```bash
# PI law firm
export AI_SENTINEL_PROFILE=pi-law
export AI_SENTINEL_CONFIG_DIR=/opt/ai-sentinel/config/profiles

# NDT industrial
export AI_SENTINEL_PROFILE=ndt

# MSP
export AI_SENTINEL_PROFILE=msp
```

Profiles are in `config/profiles/` — copy and customize for your client.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_SENTINEL_HOST` | `0.0.0.0` | Bind address |
| `AI_SENTINEL_PORT` | `8080` | Bind port |
| `AI_SENTINEL_LOG_LEVEL` | `info` | Log level |
| `AI_SENTINEL_JWT_SECRET` | — | JWT signing secret |
| `AI_SENTINEL_API_KEYS` | — | Comma-separated SHA-256 API key hashes |
| `AI_SENTINEL_ADMIN_TOKEN` | — | Admin API bearer token |
| `AI_SENTINEL_TRUST_SECRET` | — | HMAC trust token secret |
| `AI_SENTINEL_PRESIDIO_URL` | — | Presidio analyzer URL |
| `AI_SENTINEL_RATE_MAX_ACTIONS_PER_HOUR` | `1000` | Per-session action limit |
| `AI_SENTINEL_RATE_MAX_COST_PER_DAY` | `100.0` | Per-session daily cost cap (USD) |
| `AI_SENTINEL_RATE_MAX_TOKENS_PER_REQUEST` | `100000` | Per-request token budget (0=unlimited) |
| `AI_SENTINEL_L3_DRIFT_THRESHOLD` | `-0.1` | Intent drift cosine threshold |
| `AI_SENTINEL_L3_BASELINE_WINDOW` | `5` | Baseline rolling window size |
| `AI_SENTINEL_L3_DRIFT_WEBHOOK` | — | Webhook URL for drift events |
| `AI_SENTINEL_DATABASE_URL` | — | Postgres URL (for postgres backend) |
| `AI_SENTINEL_REDIS_URL` | — | Redis URL (for redis backend) |
| `AI_SENTINEL_FEED_INTERVAL_SECS` | `3600` | Threat feed refresh interval |
| `AI_SENTINEL_CROWDSEC_API_KEY` | — | CrowdSec CTI API key |
| `AI_SENTINEL_NVD_API_KEY` | — | NVD API key |
| `AI_SENTINEL_CUSTOM_FEED_PATH` | — | Path/URL to custom JSON feed |
