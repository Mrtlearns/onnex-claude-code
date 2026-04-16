# Current Data

> Metrics, data points, and current state for this project.

---

## Key Metrics

| Metric | Current Value | Target | Notes |
| ------ | ------------- | ------ | ----- |
| Embedding quality | ✅ Real (gemini-embedding-001, 1536-dim) | Real (Google text-embedding-004) | Implemented in ragv1-process-document |
| PDF/DOCX support | ✅ Full (pdf-parse + mammoth) | Full | Implemented in ragv1-process-document |
| Retrieval strategy | ✅ Hybrid (BM25 + vector + RRF) | Hybrid | match_chunks_hybrid() implemented |
| Agentic retrieval | ✅ ReAct loop (multi-round, sufficiency check) | Multi-round with query reformulation | ragv1-chat Bug 6 fixed, runReActLoop() implemented |
| Re-ranking | ✅ LLM relevance scoring (parallel Gemini) | Post-retrieval re-ranking | rerankChunks() + enable_reranking toggle |
| RAG eval coverage | ✅ Faithfulness/Relevance/Groundedness | Precision / Recall / Faithfulness | ragv1-eval edge function + Evaluation.tsx Metrics tab |
| Multi-vector embeddings | None | Content + summary + hypothetical Q | One embedding per chunk |

## Current State

**As of 2026-04-06 (Sprint 6 complete — pending server deploy):**

- ✅ Real embeddings: `gemini-embedding-001` at 1536-dim, already in ragv1-process-document
- ✅ PDF/DOCX parsing: pdf-parse + mammoth in ragv1-process-document
- ✅ Hybrid search: `match_chunks_hybrid()` RPC with BM25+vector+RRF
- ✅ ReAct agentic loop: `runReActLoop()` in ragv1-chat — iterative retrieve→sufficiency check→reformulate
- ✅ Re-ranking: `rerankChunks()` in ragv1-chat — parallel LLM relevance scoring, topK selection
- ✅ RAG evaluation: `ragv1-eval` edge function, `eval_results` table, Evaluation.tsx with Run + Metrics tabs
- ✅ Bug 1 fixed: HMAC-SHA256 replaces broken AES-GCM (non-deterministic IV) in API key lookup
- ✅ Bug 2 fixed: `c.metadata` not `c.global_metadata` in match_chunks response mapping
- ✅ Bug 4 fixed: HITL mode normalizes to `mix` (no silent empty response)
- ✅ Bug 6 fixed: agentic settings fetched from `project_rag_settings` not `projects` join
- ✅ 89 unit tests passing (Vitest)
- ✅ E2E Playwright smoke tests created
- ⬜ **PENDING**: Apply 3 migrations + deploy 3 edge functions on poc-backend server

## Active work (server deploy — MrT action required)
```bash
# Run on poc-backend (inside Docker network):
supabase db push --db-url "postgresql://supabase_admin:<password>@supabase-db:5432/postgres"
supabase functions deploy ragv1-chat ragv1-api ragv1-eval
supabase secrets set API_KEY_HMAC_SECRET=$(openssl rand -hex 32)
```

## Data Sources

- Gap analysis: `docs/gap-analysis.md`
- Edge functions: `supabase/functions/ragv1-*/index.ts`
- DB schema: `supabase/migrations/`
- Unit tests: `src/test/sprint6.test.ts`
- E2E tests: `e2e/rag-pipeline.spec.ts`

---

_Update regularly — stale data limits Claude's usefulness as an analytical partner._
