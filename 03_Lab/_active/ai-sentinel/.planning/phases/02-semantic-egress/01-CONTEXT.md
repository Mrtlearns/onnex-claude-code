# Phase 2 — Semantic Intent + Egress Inspection: Context

**Status:** Not started — depends on Phase 1 complete
**Milestone:** v2.0

---

## What This Phase Builds

Upgrades L3 and L6 from interface-complete stubs to full implementations. Activates behavioral drift detection (L3) and the complete egress inspection pipeline (L6). Also covers Phase 2 roadmap items from the build doc.

---

## Scope

### L3 — Semantic Intent Guard (Full)
- Embedding model integration (local or API-based — TBD at phase planning)
- pgvector baseline: store session-level embedding history
- Cosine similarity drift detection against baseline
- Configurable drift threshold (AI_SENTINEL_L3_DRIFT_THRESHOLD)
- INTENT_DRIFT rejection on salami-slicing attack patterns
- Behavioral drift webhooks on threshold breach

### L6 — Output Inspection (Full)
- SSRF protection: scan URLs in egress payload for private IP ranges (10.x, 172.16-31.x, 192.168.x) and cloud metadata endpoints (169.254.169.254, etc.)
- Exfiltration pattern detection: regex + heuristic matching on response content
- Egress PII scan via Presidio before delivery to caller
- SSRF_URL, EXFILTRATION_PATTERN, PII_EGRESS rejection codes

### Phase 2 Roadmap Items
- Info flow taint tracking
- Ed25519 signed manifests
- P2P mutual auth between agents
- Behavioral drift webhooks

---

## Key Decisions Required Before Planning

- [ ] Embedding model: local (fastembed-rs / candle) or API (OpenAI/Claude embeddings)?
- [ ] pgvector: add to existing Postgres service or separate vector store?
- [ ] Drift threshold: per-session configurable or global?
- [ ] Exfiltration patterns: static ruleset or feed-driven?
- [ ] P2P mutual auth: TLS client certs or application-layer HMAC?

---

## Run This Next (after Phase 1 complete)

```
/gsd:discuss-phase 2
```
