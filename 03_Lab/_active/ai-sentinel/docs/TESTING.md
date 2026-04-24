# AI-Sentinel — Testing Mode

Implements the **Onnex Armory HTTP Interface Contract v1.0**. Exposes `/chat`, `/sentinel/mode`, `/sentinel/policy`, `/sentinel/traces`, `/healthz`, `/readyz` alongside a Testing page in the dashboard.

## Production-distribution separation

Testing mode lives in its own crate — `ai-sentinel-testmode` — and is only compiled into the API binary when the `testmode` cargo feature is enabled.

```bash
# Dev / staging build (default)
cargo build --release --workspace

# Production build — zero testmode bytes in the binary
cargo build --release --workspace -p ai-sentinel-api --no-default-features
```

In the Dockerfile, pass an optional `FEATURES` build-arg; default is `testmode` for the internal homelab deploy.

## Runtime wiring

Three new environment variables (`infra/env` on the VM):

| Var | Default | Purpose |
|-----|---------|---------|
| `AI_SENTINEL_UPSTREAM_URL` | `https://openrouter.ai/api` | OpenAI-compatible `/v1/chat/completions` base URL |
| `AI_SENTINEL_UPSTREAM_API_KEY` | (unset) | Bearer token for the upstream (sent as `Authorization: Bearer ...`) |
| `AI_SENTINEL_UPSTREAM_MODEL` | `google/gemini-flash-1.5-8b` | Default model slug |

Live-mode calls fail clean with `verdict: ERROR` if the upstream URL is unreachable or the API key is rejected. Simulated mode works without any upstream configuration.

## Contract summary

Five verdicts: `ALLOW`, `BLOCK`, `SANITIZE`, `ERROR`, `BYPASS`. Every response carries `X-Sentinel-*` headers; envelope body (contract §5.4) is returned when the caller sends `Accept: application/vnd.onnex-sentinel+json`.

Three global modes via `POST /sentinel/mode`:
- `full` — normal ingress + egress enforcement (default)
- `observe` — rules evaluated + reported, nothing blocked or mutated
- `bypass` — inspection entirely skipped (everything returns verdict `BYPASS`)

Per-request bypass: `X-Sentinel-Bypass: true` + admin Bearer token honors the header for that one request (contract §4.1).

## Quick smoke tests

```bash
export TOKEN=$(grep ^AI_SENTINEL_ADMIN_TOKEN= /opt/ai-sentinel/.env | cut -d= -f2-)

# ALLOW
curl -s -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is your return policy?","upstream_mode":"simulated"}'

# BLOCK
curl -s -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please solve my homework","upstream_mode":"simulated"}'

# BYPASS
curl -s -X POST http://localhost:8080/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Sentinel-Bypass: true" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please solve my homework","upstream_mode":"simulated"}'

# Mode toggle
curl -s -X POST http://localhost:8080/sentinel/mode \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"observe"}'
```

The full scripted smoke test lives at `scripts/smoke_phase6.sh` and exercises every verdict path.

## Dashboard Testing page

`https://ai-sentinel.on-nex.us/dashboard#/testing` — four panels:

1. **Sentinel Mode** — radio-style buttons for full / observe / bypass; shows `since` timestamp
2. **Prompt Tester** — textarea + upstream-mode selector + optional model override → renders the full envelope JSON below
3. **Before / After** — same prompt twice in parallel (one bypassed, one enforced) → side-by-side diff
4. **Recent Traces** — last 25 traces from the in-memory ring buffer with verdict chips, rule names, latencies

The Testing link appears in the sidebar when the binary has the `testmode` feature enabled; in production builds the sidebar entry is absent and the routes 404.

## Armory integration

Armory is a separate VM running the red-team test suite. To drive AI-Sentinel:

1. Set `TOKEN` to the admin Bearer token from `/opt/ai-sentinel/.env`
2. POST each test prompt to `https://ai-sentinel.on-nex.us/chat` with the envelope `Accept` header
3. Correlate responses via `X-Sentinel-Trace-Id` — Armory may supply its own ULID via the same header; AI-Sentinel reuses it when it looks valid
4. For baseline "what would the raw LLM have returned" runs, add `X-Sentinel-Bypass: true`. This requires the admin token to honor.

## Deferred for v1

- SSE / streaming responses (contract §7)
- Per-rule category + OWASP mappings on the envelope — rules currently report `category: "unknown"`; the next pass adds `category` + `owasp` fields to the YAML DSL and threads them through
- Full OpenAPI spec for testmode routes (the existing `/openapi.json` still documents only `/check`)
- Multi-tenant `X-Sentinel-Tenant` support
- IP allow-list for `X-Sentinel-Bypass` (admin-token gate is the v1 mechanism)
