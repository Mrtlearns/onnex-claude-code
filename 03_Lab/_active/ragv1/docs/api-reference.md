# RAGv1 API Reference

## Authentication

All endpoints (except `/v1/health`) require a Bearer token in the `Authorization` header:

```bash
Authorization: Bearer <api-key>
```

API keys are project-scoped. Get your API key from the API Keys page in the RAGv1 UI.

## Base URL

```
https://ragv1.poc.playsap.us/functions/v1/ragv1-api
```

Or for local testing:
```
http://localhost:8080/functions/v1/ragv1-api
```

## Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (missing required field) |
| 401 | Unauthorized (invalid API key) |
| 404 | Not Found (resource doesn't exist) |
| 500 | Internal Server Error |
| 502 | Bad Gateway (edge function error) |

---

## Health Check

**GET** `/v1/health`

No authentication required.

### Response

```json
{
  "status": "ok",
  "version": "1.0"
}
```

### Example

```bash
curl https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/health
```

---

## Projects

### List Projects

**GET** `/v1/projects`

Lists all projects owned by the authenticated user.

### Response

```json
{
  "projects": [
    {
      "id": 1,
      "name": "Legal Contracts",
      "description": "Q&A on contract templates",
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-01T10:00:00Z"
    }
  ]
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/projects
```

---

### Get Project Detail

**GET** `/v1/projects/:id`

### Response

```json
{
  "id": 1,
  "name": "Legal Contracts",
  "description": "Q&A on contract templates",
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-01T10:00:00Z"
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/projects/1
```

---

### Update Project

**PATCH** `/v1/projects/:id`

### Request

```json
{
  "name": "Updated Project Name",
  "description": "Updated description"
}
```

### Response

```json
{
  "id": 1,
  "name": "Updated Project Name",
  "description": "Updated description",
  "updated_at": "2026-04-07T12:00:00Z"
}
```

### Example

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/projects/1
```

---

## Settings

### Get RAG Settings

**GET** `/v1/settings`

Returns RAG configuration for this project (embedding model, retrieval strategy, etc).

### Response

```json
{
  "project_id": 1,
  "enable_entity_extraction": true,
  "enable_relation_extraction": true,
  "enable_reranking": true,
  "chunking_strategy": "standard",
  "chunk_token_size": 1000,
  "enable_deep_extract": false,
  "enable_chunk_context": false,
  "custom_metadata_schema": null,
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-01T10:00:00Z"
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/settings
```

---

### Update RAG Settings

**PATCH** `/v1/settings`

### Request

```json
{
  "enable_entity_extraction": false,
  "enable_reranking": true,
  "chunk_token_size": 2000
}
```

### Response

```json
{
  "project_id": 1,
  "enable_entity_extraction": false,
  "enable_relation_extraction": true,
  "enable_reranking": true,
  "chunking_strategy": "standard",
  "chunk_token_size": 2000,
  "enable_deep_extract": false,
  "enable_chunk_context": false,
  "custom_metadata_schema": null,
  "updated_at": "2026-04-07T12:00:00Z"
}
```

### Example

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"chunk_token_size":2000}' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/settings
```

---

## Documents

### List Documents

**GET** `/v1/documents`

Lists all documents in this project.

### Response

```json
{
  "documents": [
    {
      "id": 1,
      "name": "contract-2026.pdf",
      "status": "processed",
      "mime_type": "application/pdf",
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-01T10:15:00Z"
    }
  ]
}
```

**Status values:** `pending`, `processing`, `processed`, `error`

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/documents
```

---

### Trigger Document Processing

**POST** `/v1/documents`

Manually triggers chunking, embedding, and entity extraction for a document.

### Request

```json
{
  "document_id": 1
}
```

### Response

```json
{
  "status": "processing_started",
  "document_id": 1
}
```

### Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"document_id":1}' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/documents
```

---

## Semantic Search

### Query Documents

**POST** `/v1/query`

Semantic search across all documents in this project using hybrid (BM25 + vector + RRF) retrieval.

### Request

```json
{
  "query": "What are the payment terms?",
  "match_count": 8,
  "threshold": 0.3
}
```

- `query` (required): Search query
- `match_count` (optional, default 8): Number of chunks to return
- `threshold` (optional, default 0.3): Minimum similarity score (0-1)

### Response

```json
{
  "chunks": [
    {
      "id": 1,
      "content": "Payment shall be made within 30 days of invoice date...",
      "similarity": 0.87,
      "metadata": {
        "document_id": 1,
        "page": 2,
        "source": "contract-2026.pdf"
      }
    }
  ]
}
```

### Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query":"payment terms","match_count":10}' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/query
```

---

## Chat

### List Chat Sessions

**GET** `/v1/chat/sessions`

Lists all chat sessions in this project.

### Response

```json
{
  "sessions": [
    {
      "id": 1,
      "title": "Contract Q&A",
      "created_at": "2026-04-01T10:00:00Z",
      "updated_at": "2026-04-01T12:00:00Z"
    }
  ]
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/chat/sessions
```

---

### Send Chat Message

**POST** `/v1/chat`

Sends a message and returns a non-streaming JSON response (collects SSE stream and returns full response).

### Request

```json
{
  "session_id": 1,
  "message": "What are the key payment terms?",
  "retrieval_mode": "hybrid"
}
```

- `session_id` (required): Chat session ID
- `message` (required): User message
- `retrieval_mode` (optional, default "hybrid"): `"hybrid"`, `"vector"`, `"bm25"`, or `"graph"`

### Response

```json
{
  "response": "According to the contract, payment shall be made within 30 days of invoice date, with a 2% early payment discount available.",
  "session_id": 1
}
```

### Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": 1,
    "message": "What are the payment terms?",
    "retrieval_mode": "hybrid"
  }' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/chat
```

---

## Evaluation

### Trigger Evaluation

**POST** `/v1/eval`

Runs RAG evaluation (faithfulness, relevance, groundedness) on a retrieval event.

### Request

```json
{
  "retrieval_event_id": 1
}
```

### Response

```json
{
  "faithfulness_score": 0.92,
  "relevance_score": 0.88,
  "groundedness_score": 0.95,
  "faithfulness_reason": "Response is well-supported by retrieved chunks",
  "relevance_reason": "All content relates directly to the query",
  "groundedness_reason": "All claims are grounded in source material",
  "eval_cost_usd": 0.0032,
  "created_at": "2026-04-07T12:00:00Z"
}
```

### Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retrieval_event_id":1}' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/eval
```

---

### List Evaluation Results

**GET** `/v1/eval/results`

Lists all evaluation results for this project (max 200 most recent).

### Response

```json
{
  "results": [
    {
      "id": 1,
      "retrieval_event_id": 1,
      "faithfulness_score": 0.92,
      "relevance_score": 0.88,
      "groundedness_score": 0.95,
      "faithfulness_reason": "Response is well-supported...",
      "relevance_reason": "All content relates...",
      "groundedness_reason": "All claims are grounded...",
      "eval_cost_usd": 0.0032,
      "created_at": "2026-04-07T12:00:00Z"
    }
  ]
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/eval/results
```

---

## Organizations

### List Organizations

**GET** `/v1/orgs`

Lists organizations the authenticated user owns or belongs to.

### Response

```json
{
  "organizations": [
    {
      "id": 1,
      "name": "Acme Corp",
      "slug": "acme-corp",
      "created_at": "2026-03-15T10:00:00Z"
    }
  ]
}
```

### Example

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/orgs
```

---

### Create Organization

**POST** `/v1/orgs`

Creates a new organization owned by the authenticated user.

### Request

```json
{
  "name": "Acme Corp",
  "slug": "acme-corp"
}
```

- `name` (required): Organization name
- `slug` (required): URL-friendly slug (alphanumeric, hyphens)

### Response

```json
{
  "id": 1,
  "name": "Acme Corp",
  "slug": "acme-corp",
  "created_at": "2026-04-07T12:00:00Z"
}
```

### Example

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Acme Corp",
    "slug": "acme-corp"
  }' \
  https://ragv1.poc.playsap.us/functions/v1/ragv1-api/v1/orgs
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Description of what went wrong"
}
```

### Common Errors

| Scenario | Status | Message |
|----------|--------|---------|
| Missing API key | 401 | `Unauthorized` |
| Invalid API key | 401 | `Unauthorized` |
| Project not found | 404 | `Project not found` |
| Document not found | 404 | `Document not found` |
| Missing required field | 400 | `<field> is required` |
| Edge function error | 502 | `<operation> failed: <details>` |

---

## Rate Limiting

Currently no rate limits. This may change in production.

---

## Changelog

### v1.0 (2026-04-07)

- Initial release
- All project, settings, document, chat, eval, and org endpoints live
- Hybrid search with BM25 + vector + RRF
- Agentic chat with ReAct loop
- RAG evaluation (faithfulness, relevance, groundedness)
