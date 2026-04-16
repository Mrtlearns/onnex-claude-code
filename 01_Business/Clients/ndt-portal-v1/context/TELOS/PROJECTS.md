# Projects

## Active

### ndtv1 — NDT Portal v1
- **Status:** Active development — pipeline + renderer in progress
- **Services:** ndtv1-comply (ITAR-aware), ndtv1-sanitize, ndtv1-gateway
- **Stack:** Next.js 14 App Router, R3F/drei, FastAPI, Temporal, PostgreSQL/pgvector, Hasura, Anthropic SDK + Ollama fallback, n8n
- **Key specs:** Renderer Design Spec v1.0, Universal Two-Stage LLM Pipeline spec
- **Next Actions:**
  - [ ] Complete Stage 1 classifier (part type + geometry primitives)
  - [ ] Build Stage 2 RT analysis with dynamic code-specific prompts
  - [ ] Implement R3F component tree per Renderer Design Spec
  - [ ] Wire ndtv1-comply ITAR classification layer
  - [ ] Connect n8n email ingestion workflows
  - [ ] Set up ShareCRM integration for client portal