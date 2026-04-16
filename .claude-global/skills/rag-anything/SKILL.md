# Skill: RAG-Anything

Universal RAG (Retrieval Augmented Generation) framework supporting any document format.
Repo: https://github.com/HKUDS/RAG-Anything

---

## What It Does

RAG-Anything builds RAG pipelines over any document type: PDFs, Word, Excel, PPT,
images, audio, video, HTML, code files. Handles multi-modal content natively.

Key advantages over basic RAG:
- Multi-modal: processes images and tables inside PDFs
- Any format: not just text files
- Structured extraction: tables, figures, equations preserved
- Chunk-aware retrieval: context-preserving chunking strategies

---

## When to Apply

- TRIGGER: User wants to build a knowledge base over client documents
- TRIGGER: User wants to query a corpus of PDFs, reports, or mixed documents
- TRIGGER: "RAG", "document search", "query my documents", "knowledge base"
- TRIGGER: Upgrading the ragv1 lab experiment to production

---

## Setup

```bash
# WSL / Ubuntu (preferred — GPU access via RTX 3090)
wsl
pip install rag-anything
# or from source:
git clone https://github.com/HKUDS/RAG-Anything /mnt/d/Code/Claude/.claude-global/tools/rag-anything
cd /mnt/d/Code/Claude/.claude-global/tools/rag-anything
pip install -r requirements.txt
```

Requires:
- Python 3.10+
- `ANTHROPIC_API_KEY` or OpenAI key for embeddings/LLM
- (Optional) pgvector for production storage — already available in Onnex stack

---

## Core Operations

```python
from rag_anything import RAGAnything

rag = RAGAnything(
    llm_model="claude-sonnet-4-6",
    embedding_model="text-embedding-3-small",
    vector_store="pgvector",  # use existing Onnex pgvector instance
)

# Ingest documents
rag.ingest("path/to/documents/")

# Query
result = rag.query("What are the key findings in the Q4 report?")
print(result.answer)
print(result.sources)
```

---

## Onnex Integration

- Vector store: connect to existing PostgreSQL/pgvector (already in stack)
- Document sources: client PDFs, NDT reports, law firm case files
- Ingestion pipeline: Firecrawl (web) → RAG-Anything → pgvector
- Query interface: expose via n8n workflow or Hasura endpoint

---

## Upgrade Path from ragv1

```
03_Lab/_active/ragv1/ → review current implementation
→ migrate to RAG-Anything as drop-in replacement
→ graduate to 01_Business/Onnex/rag-engine/
```

---

## Status
NEEDS CONFIGURATION — API keys + pgvector connection string. See configuration prompt.
