# Gap Analysis: RAG Platform vs. Roko AI Agent RAG

> Audit date: 2026-03-22 (updated)

---

## Features at Parity

- Multi-project management with per-project settings
- Document upload, chunking, and embedding pipeline
- Entity extraction and relation extraction from documents
- Knowledge graph visualization (force-directed canvas)
- Multiple retrieval modes (mix, relation_only, global, human_in_the_loop)
- Configurable chunking strategies (standard, contextual, semantic, page_based, ai_smart, pro_contextual)
- Chat with streaming SSE responses
- Cost tracking and budget controls (spending caps, per-project spend)
- API documentation page
- Configurable system prompts and conversation memory windows

---

## Critical Gaps

### 1. Approximate Embeddings — Chat-Based Semantic Fingerprinting (not a real embedding model)

**Roko**: Uses proper embedding models (OpenAI `text-embedding-3-small` or similar) via `pgvector`.  
**Us**: Use chat-based semantic fingerprinting — an LLM extracts 30 concept-weight pairs, which are deterministically hashed into 768-dim vectors via `conceptsToVector()`. Fallback: `textToHashVector()` uses character trigram hashing.

**Status**: Functional. Vector search produces meaningful (but not optimal) results. Significantly better than the previous random-float approach, but still lower quality than a dedicated embedding model.

**Fix**: Use a real embedding API endpoint (e.g., OpenAI `/v1/embeddings` or Google `text-embedding-004`). Requires adding an API key since the Lovable AI Gateway only supports `/v1/chat/completions`.

### 2. No Multi-Vector Embeddings

**Roko**: Stores separate embeddings for content, summaries, and hypothetical questions per chunk, enabling richer retrieval.  
**Us**: Store only one embedding per chunk.

**Fix**: Generate content embedding + summary embedding + hypothetical question embedding per chunk.

### 3. No RAG Evaluation / Benchmarking Dashboard

**Roko**: Has a full evaluation dashboard showing precision, recall, and relevance scores for different RAG method configurations. This is a major differentiator.  
**Us**: No evaluation system at all.

**Fix**: Add an Evaluation page where users can run test queries against different retrieval modes and see scored results (relevance, faithfulness, context precision).

### 4. No Agentic RAG Implementation

**Roko**: Uses LangGraph for multi-step agentic retrieval with tool use — the agent can reformulate queries, do multi-hop reasoning, and call external tools.  
**Us**: Have `agentic_enabled` and `agentic_max_rounds` settings in the DB, but the chat edge function has **zero** agentic logic. It does a single retrieval pass.

**Fix**: Implement iterative retrieval in the chat function — if initial context is insufficient, reformulate the query and retrieve again, up to `agentic_max_rounds`.

### 5. No Multi-Query RAG

**Roko**: Has Multi-Query RAG that uses LLMs to generate multiple query variations, retrieves for each, then merges results.  
**Us**: Single query → single retrieval.

**Fix**: Before embedding search, generate 3–5 query variations, retrieve for each, deduplicate and rank.

### 6. No Hybrid Search (Keyword + Semantic)

**Roko**: Has Hybrid Meta RAG combining semantic search with keyword/metadata filtering.  
**Us**: Only vector similarity (via `match_chunks` RPC) or graph-based. No full-text search integration.

**Fix**: Add PostgreSQL full-text search on `document_chunks.content` and combine scores with vector similarity using Reciprocal Rank Fusion (RRF).

### 7. No Query Routing

**Roko**: Routes queries to the best retrieval strategy automatically based on query type.  
**Us**: User manually selects retrieval mode.

**Fix**: Add an `auto` retrieval mode that uses an LLM classifier to pick the best strategy per query.

### 8. Human-in-the-Loop Not Implemented

**Us**: Have `human_in_the_loop` as a retrieval mode option in the UI and DB settings, but the chat function treats it the same as other modes — there's no UI to show candidate chunks for manual selection before generating an answer.

**Fix**: When mode is `human_in_the_loop`, return chunks to the UI first, let user select/deselect, then send selected chunks back for answer generation.

### 9. No Document Processing for PDF/DOCX

**Roko**: Handles PDFs and complex document formats with OCR/vision.  
**Us**: `process-document` just calls `fileData.text()` — this only works for plain text files. PDFs and DOCX will return garbage or empty strings.

**Fix**: Add PDF parsing (e.g., `pdf-parse` or vision-based extraction) and DOCX extraction in the edge function.

### 10. No Chunk-Level Summary Generation

**Roko**: Generates summaries per chunk for better retrieval context.  
**Us**: Store raw chunk content only.

**Fix**: After chunking, generate a one-sentence summary per chunk via LLM, store alongside content.

---

## Moderate Gaps

### 11. No Re-ranking

After initial retrieval, no cross-encoder or LLM-based re-ranking of chunks before sending to the LLM.

### 12. No Source Citations in Chat UI

The LLM is prompted to use `[Source N]` notation, but the chat UI renders plain text with no clickable source references or chunk previews.

### 13. No Conversation Export

No way to export chat sessions as PDF or Markdown.

### 14. No Batch Document Processing

Documents are processed one at a time. No queue or batch upload progress indicator.

### 15. No Document Preview

No way to view the original uploaded document content alongside its extracted chunks.

---

## Priority Recommendations (ordered by impact)

| Priority | Gap | Impact |
|----------|-----|--------|
| 1 | Add PDF/DOCX parsing | Currently only plain text works |
| 2 | Upgrade to real embedding model | Chat-based approximation works but is suboptimal |
| 3 | Implement agentic retrieval loop | Settings exist but do nothing |
| 4 | Add evaluation dashboard | Key differentiator; enables quality measurement |
| 5 | Add hybrid search (full-text + vector) | Significant recall improvement |
| 6 | Implement human-in-the-loop chunk selection UI | Mode exists but isn't wired up |
| 7 | Add multi-query expansion | Retrieval quality improvement |
| 8 | Add re-ranking step | Cheap quality win |

---

## Summary

The platform has solid UI scaffolding and database design. The embedding system now uses chat-based semantic fingerprinting, which produces functional (but not optimal) vector search results. The core remaining issues are: no PDF support, several advertised features (agentic, human-in-the-loop) that aren't implemented, and the embedding quality gap vs. real embedding models. The Roko demo's main advantages are real embeddings, multi-vector storage, 9 specialized retrieval strategies, agentic orchestration via LangGraph, and an evaluation/benchmarking dashboard.
