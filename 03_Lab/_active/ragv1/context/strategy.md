# Strategy — RAGv1

> Current strategic priorities for the RAGv1 lab experiment.
> **Onnex-wide strategy lives in [TELOS/STRATEGIES.md](TELOS/STRATEGIES.md).**

---

## Project

RAGv1 — Multi-tenant RAG pipeline lab experiment. Originated in Lovable, self-hosted and extended under Onnex lab. Goal: prove out RAG patterns as a foundation for the Onnex AI-OS document intelligence module.

---

## Current Focus Period

Q2 2026 (April–June)

---

## Strategic Priorities

1. **Replace fake embeddings with a real embedding model.** The current approach (LLM-based concept hashing) produces plausible but semantically weak vectors. Switching to Google `text-embedding-004` gives real semantic search and makes all retrieval experiments valid.

2. **Add document format support.** Plain-text-only ingestion is a hard blocker for real-world testing. PDF and DOCX are the dominant formats in every target vertical (PI law, NDT, MSP). Without them, the lab results don't translate to production.

3. **Implement hybrid search (BM25 + vector + RRF).** Vector-only retrieval misses keyword-exact matches. Hybrid is the current gold standard for RAG retrieval quality. Implementing it here validates the approach before building it into AI-OS.

4. **Add a RAG evaluation dashboard.** Without measurable precision/recall/faithfulness metrics, there's no way to compare retrieval strategies objectively. The eval dashboard turns this from a demo into a lab.

5. **Validate the full stack end-to-end with real documents.** Upload real PDFs, chat with them, measure retrieval quality. That's the lab outcome we need before considering graduation to Onnex internal tooling.

---

## What Success Looks Like

- All 5 RAG patterns proven in a working system: real embeddings, PDF parsing, hybrid search, agentic retrieval, eval dashboard
- Retrieval quality measurably better than fake-embedding baseline
- System handles real PDF/DOCX uploads end-to-end
- Findings documented — inform AI-OS document intelligence module design
- Lab experiment graduated or archived by end of Q2 2026

---

## Links to TELOS

| This project serves... | TELOS reference |
|------------------------|----------------|
| Onnex AI-OS mission — intelligence for SMEs | M0 |
| RAGv1 lab goal — prove RAG patterns | G1 |
| Strategy: build reusable AI-OS components via lab experiments | S# |

---

_Update as priorities shift. Keep TELOS/STRATEGIES.md for the long-horizon view._
