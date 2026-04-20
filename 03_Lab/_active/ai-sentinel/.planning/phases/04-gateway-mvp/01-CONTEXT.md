# Phase 4 — Gateway MVP: Context

**Source:** `.planning/plans/here-is-a-draft-memoized-music.md` + council analysis (2026-04-20)
**Status:** Planned

---

## What This Phase Is

Phase 4 evolves AI-Sentinel from an explicit-call sidecar (`POST /check`) into a **network-layer MITM proxy** that intercepts all LLM traffic transparently — regardless of which app originated it. No app-level changes required on managed devices.

The existing L0–L7 pipeline (Phases 1–3) is reused wholesale. Phase 4 adds the proxy transport and classifier that feed requests into it.

---

## Key Architectural Decisions (from council)

| Decision | Resolved |
|----------|---------|
| Explicit proxy (Phase 4) vs transparent interception | Explicit proxy (`HTTP_PROXY`) — transparent mode is Phase 6 |
| `hudsucker` vs hand-rolled CONNECT | `hudsucker` — MIT, actively maintained |
| fail_open default | `fail_open = false` — security default; override documented per deployment |
| CA custody | YubiHSM or air-gapped machine required before any device receives root cert — **hard gate** |
| Sidecar fate | Stays in production — gateway calls same pipeline internally |

---

## Scope Boundaries

**In Phase 4:**
- Rust MITM proxy (explicit proxy mode, port 8080)
- TLS termination + leaf cert generation (Onnex CA via `rcgen`)
- 5-signal LLM traffic classifier (SNI, URL path, payload shape, IP/ASN)
- `ai-sentinel-types` crate (shared wire types)
- `ai-sentinel-feed` crate (provider signatures, hot-reload)
- `ai-sentinel-classifier` crate
- `ai-sentinel-proxy` binary
- `ai-sentinel-store` crate (session keyed by `blake3(5-tuple)`)
- Containerize: `Dockerfile.gateway` + `docker-compose.gateway.yml`
- Integration smoke tests (curl-through-proxy)

**Not in Phase 4:**
- eBPF / WFP / Network Extension agents (Phase 6–8)
- iptables transparent interception (Phase 6)
- YAML rules engine (Phase 5)
- L8 token optimizer (Phase 7)
- Ansible CA deployment playbooks (companion work, not blocking)
- Billing or multi-tenant (Phase 3 already done)

---

## Open Gates (must resolve before shipping to real devices)

1. **CA custody** — YubiHSM or air-gapped root CA storage confirmed
2. **Device trust store audit** — enumerate which tools bypass `HTTP_PROXY` (Electron, some Go binaries)
3. **fail_open override** — document per-deployment justification before any `fail_open = true` deployment
