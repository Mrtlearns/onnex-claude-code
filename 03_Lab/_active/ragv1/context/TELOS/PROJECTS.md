# Projects

## Active Projects

### RAGv1
- **Status:** Active — lab experiment
- **Client / Vertical:** Lab / Internal
- **Goal:** Prove out RAG patterns (real embeddings, hybrid search, PDF parsing, agentic retrieval) as foundation for Onnex AI-OS document intelligence module
- **Business Model:** Lab → potential Onnex internal tool or productized client feature
- **Timeline:** 2026-04-03 onwards
- **Stack:** React 18 + TypeScript + Vite + Supabase (Postgres/pgvector, Auth, Storage, Edge Functions) + shadcn/ui
- **Source:** Lovable-generated, extended under Onnex lab
- **Infra:** poc-backend — schema: poc_ragv1 | bucket: poc-ragv1-docs | url: https://ragv1.poc.playsap.us
- **Next Actions:**
  - [ ] Replace fake embeddings with real embedding API (OpenAI text-embedding-3-small or Google text-embedding-004)
  - [ ] Add PDF/DOCX parsing in process-document edge function
  - [ ] Configure self-hosted Supabase on poc-backend (migrate from Lovable Supabase cloud)
  - [ ] Implement hybrid search (BM25 + vector + RRF)
  - [ ] Add RAG evaluation dashboard

## Onnex Platform Projects (always active)

### AI-OS Platform
- **Status:** Ongoing — infrastructure and framework
- **Stack:** Next.js, FastAPI, PostgreSQL/pgvector, Temporal, Hasura, n8n, Docker

### Agency-OS
- **Status:** Ongoing — internal Onnex operations
- **Framework:** 8 Figure Agency 13-system framework mapped to ATOM/QDOAA
