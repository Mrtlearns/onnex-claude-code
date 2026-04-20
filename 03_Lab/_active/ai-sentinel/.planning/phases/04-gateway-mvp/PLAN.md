# Phase 4 — Gateway MVP: Plan

**Created:** 2026-04-20
**Status:** Ready
**Milestone:** v4.0

---

## Scope

Evolve AI-Sentinel from an explicit-call sidecar into a network-layer MITM proxy that intercepts LLM traffic transparently at the TLS level. Ships as explicit proxy mode (HTTP_PROXY) on port 8080. The existing L0–L7 pipeline (Phases 1–3) is reused — Phase 4 adds the proxy transport, LLM traffic classifier, and gateway configuration layer on top of it.

---

## Waves

### Wave 1: Workspace Restructure + Shared Types
**Goal:** New crates scaffolded; shared types defined; workspace compiles clean.

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 1.1 | Add Phase 4 crates to `Cargo.toml` workspace members | `Cargo.toml` | No |
| 1.2 | Scaffold `ai-sentinel-types` crate — stub `lib.rs` only | `crates/ai-sentinel-types/src/lib.rs`, `Cargo.toml` | No |
| 1.3 | Implement `Direction`, `CallerType`, `CallerContext` | `crates/ai-sentinel-types/src/direction.rs`, `request.rs` | No |
| 1.4 | Implement `CheckRequest`, `CheckResponse`, `Decision`, `Violation` | `crates/ai-sentinel-types/src/response.rs` | No |
| 1.5 | `cargo check --workspace` clean; `cargo clippy --workspace -- -D warnings` clean | — | No |

---

### Wave 2: Feed + Classifier
**Goal:** LLM traffic identification works — SNI + URL + payload + IP signals classify correctly.
**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 2.1 | Scaffold `ai-sentinel-feed` crate | `crates/ai-sentinel-feed/src/lib.rs`, `Cargo.toml` | No |
| 2.2 | Implement `SignatureSet` — `sni_patterns`, `url_path_patterns`, `allowed_cidrs` | `crates/ai-sentinel-feed/src/signature_set.rs` | No |
| 2.3 | Implement `endpoints.rs` — hardcoded Phase 4 provider list (Anthropic, OpenAI, Gemini, Groq) | `crates/ai-sentinel-feed/src/sources/endpoints.rs` | No |
| 2.4 | Parse feed from `config/gateway.toml` | `crates/ai-sentinel-feed/src/lib.rs` | No |
| 2.5 | Scaffold `ai-sentinel-classifier` crate | `crates/ai-sentinel-classifier/src/lib.rs`, `Cargo.toml` | No |
| 2.6 | Implement `classify(sni, url_path, body_sample, src_ip) -> ClassifyResult` — 5-signal cascade | `crates/ai-sentinel-classifier/src/classifier.rs` | No |
| 2.7 | Implement signal modules: `sni.rs`, `url_path.rs`, `payload_shape.rs`, `ip_asn.rs` | `crates/ai-sentinel-classifier/src/signals/` | No |
| 2.8 | Unit tests: 10+ LLM hosts classified correctly; 5+ non-LLM false-positive cases (GitHub, Stripe, npm) pass | `crates/ai-sentinel-classifier/tests/` | Yes (engineer) |

---

### Wave 3: Session Store (Gateway Session Key)
**Goal:** Gateway session identity uses network 5-tuple blake3 hash, not HTTP caller_id.
**Depends on:** Wave 1 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 3.1 | Extend `ai-sentinel-store` with `NetworkSession` keyed by `hex(blake3(src_ip \|\| dst_ip \|\| src_port \|\| dst_port \|\| conn_ts))` | `crates/ai-sentinel-store/src/session.rs` | No |
| 3.2 | Session lookup + creation API: `get_or_create(5-tuple) -> SessionHandle` | `crates/ai-sentinel-store/src/lib.rs` | No |

---

### Wave 4: Proxy Binary — CONNECT Handler + TLS MITM
**Goal:** Proxy accepts CONNECT, terminates TLS, classifies traffic, dispatches to pipeline or tunnels through.
**Depends on:** Waves 2 + 3 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 4.1 | Scaffold `ai-sentinel-proxy` binary crate | `crates/ai-sentinel-proxy/src/main.rs`, `Cargo.toml` | No |
| 4.2 | Implement `gateway.toml` config struct — bind addr, CA paths, allowed_providers, fail_open | `crates/ai-sentinel-proxy/src/config.rs`, `config/gateway.toml` | No |
| 4.3 | Implement CONNECT handler — accept TCP, parse CONNECT request, extract SNI | `crates/ai-sentinel-proxy/src/proxy.rs` | No |
| 4.4 | Implement `cert_gen.rs` — dynamic leaf cert per hostname via `rcgen` + Onnex CA; 24h cache | `crates/ai-sentinel-proxy/src/cert_gen.rs` | No |
| 4.5 | TLS MITM: terminate client TLS with leaf cert; establish fresh TLS to upstream | `crates/ai-sentinel-proxy/src/proxy.rs` | No |
| 4.6 | Non-LLM fast path: if classifier misses all signals → TCP tunnel without decryption | `crates/ai-sentinel-proxy/src/proxy.rs` | No |
| 4.7 | LLM path: read HTTP body → build `CheckRequest` → call pipeline → `Decision::Allow` forwards, `Decision::Reject` returns HTTP 451 with `audit_id` | `crates/ai-sentinel-proxy/src/proxy.rs` | No |
| 4.8 | Implement `upstream.rs` — re-encrypt + stream response back to client | `crates/ai-sentinel-proxy/src/upstream.rs` | No |

---

### Wave 5: Config, Docker, Integration Tests
**Goal:** Gateway containerized and smoke tests pass end-to-end through the proxy.
**Depends on:** Wave 4 complete

| Task | Description | Files | Agent? |
|------|-------------|-------|--------|
| 5.1 | Write `config/gateway.toml` with all Phase 4 defaults | `config/gateway.toml` | No |
| 5.2 | Write `Dockerfile.gateway` — multi-stage, uid 65534, <80MB | `Dockerfile.gateway` | No |
| 5.3 | Write `docker-compose.gateway.yml` — gateway + redis; `network_mode: host`; cert volume mounts | `infra/docker-compose.gateway.yml` | No |
| 5.4 | Write `scripts/test_gateway.sh` — 4 smoke tests (LLM passthrough, injection blocked, non-LLM passthrough, classifier unit test) | `scripts/test_gateway.sh` | No |
| 5.5 | Integration test: curl through proxy → `api.anthropic.com` → valid response; pipeline log visible | `tests/integration/gateway/` | Yes (qa-tester) |
| 5.6 | Integration test: known injection payload → HTTP 451 with `audit_id` in body | `tests/integration/gateway/` | Yes (qa-tester) |
| 5.7 | Integration test: `curl --proxy` to `https://github.com` → 200, no decryption in gateway logs | `tests/integration/gateway/` | Yes (qa-tester) |
| 5.8 | `cargo test --workspace` passes; `cargo clippy --workspace -- -D warnings` clean | — | No |

---

## Success Criteria

- [ ] `HTTP_PROXY=http://gateway:8080` on one Onnex device routes all LLM traffic through gateway without app changes
- [ ] Known prompt injection payload blocked; appears in audit log with `audit_id`
- [ ] Non-LLM HTTPS traffic (GitHub, Stripe, npm) not decrypted; latency delta < 5ms
- [ ] Gateway container restarts within 5s on `pkill ai-sentinel-proxy` (Docker restart policy)
- [ ] Classifier unit tests: all LLM providers classified correctly; zero false positives on 5+ non-LLM hosts
- [ ] `cargo test --workspace` zero failures
- [ ] `cargo clippy --workspace -- -D warnings` zero warnings
- [ ] p99 proxy latency < 50ms (measured by `scripts/run_load_test.py`)
- [ ] Docker image uid = 65534 (non-root)
- [ ] `fail_open = false` default confirmed in `gateway.toml`

---

## Technical Specifics

### New Crate Dependencies

| Crate | Key deps |
|-------|----------|
| `ai-sentinel-types` | `serde`, `uuid`, `ipnet` |
| `ai-sentinel-feed` | `serde`, `toml`, `regex`, `ipnet`, `arc-swap` |
| `ai-sentinel-classifier` | `regex`, `arc-swap`, `ipnet` |
| `ai-sentinel-store` (extend) | `blake3` |
| `ai-sentinel-proxy` | `tokio`, `tokio-rustls`, `rcgen`, `rustls`, `hyper`, `hudsucker` |

### Key Config

```toml
# config/gateway.toml
[proxy]
bind_addr = "0.0.0.0:8080"
fail_open = false

[tls]
ca_cert = "/certs/onnex-intermediate.crt"
ca_key  = "/certs/onnex-intermediate.key"

[providers]
allowed_hosts = ["api.anthropic.com", "api.openai.com", "generativelanguage.googleapis.com", "api.groq.com"]
url_path_patterns = ["/v1/messages", "/v1/chat/completions", "/v1/generateContent"]
```

### Ports

| Service | Port |
|---------|------|
| Proxy (explicit) | 8080 |
| Existing sidecar API | 8080 (separate VM — no conflict) |

### Gate: CA Custody

**Do not ship to any real device until:** Onnex intermediate CA key is in YubiHSM or air-gapped storage. Cert volume mount in `docker-compose.gateway.yml` is read-only; key never in repo.

---

## Deferred (Out of Scope)

- eBPF / WFP / Network Extension endpoint agents (Phases 6–8)
- iptables transparent interception (Phase 6)
- YAML rules engine (Phase 5)
- L8 token optimizer (Phase 7)
- Ansible `onnex-ca-deploy.yml` — companion work, not blocking Phase 4
- Dynamic feed refresh from CrowdSec/NVD (Phase 5)
- IP/ASN lookup (Phase 5)
- Multi-tenant isolation (Phase 3 complete)
