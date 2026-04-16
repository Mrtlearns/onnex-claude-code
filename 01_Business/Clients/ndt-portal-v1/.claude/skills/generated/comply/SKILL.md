---
name: comply
description: "Skill for the Comply area of ndt-portal-v1. 22 symbols across 9 files."
---

# Comply

22 symbols | 9 files | Cohesion: 76%

## When to Use

- Working with code in `pipeline/`
- Understanding how scan_text, classify, score work
- Modifying comply-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `pipeline/comply/comply_server.py` | _load_db_keywords, _load_defense_cages, _persist, classify, get_document (+3) |
| `pipeline/comply/title_block.py` | TitleBlockData, extract_from_pdf, extract_from_image_text |
| `pipeline/shared/models.py` | ClassifyResponse, GatewayReidentifyResponse |
| `pipeline/comply/keyword_scanner.py` | KeywordHit, scan_text |
| `pipeline/comply/compliance_engine.py` | ComplianceResult, score |
| `pipeline/gateway/gateway_server.py` | reidentify, get_request |
| `pipeline/shared/db.py` | get_pool |
| `pipeline/sanitize/sanitize_server.py` | get_job |
| `frontend/e2e/pages/QuotesPage.ts` | search |

## Entry Points

Start here when exploring this area:

- **`scan_text`** (Function) — `pipeline/comply/keyword_scanner.py:122`
- **`classify`** (Function) — `pipeline/comply/comply_server.py:237`
- **`score`** (Function) — `pipeline/comply/compliance_engine.py:41`
- **`get_pool`** (Function) — `pipeline/shared/db.py:9`
- **`get_job`** (Function) — `pipeline/sanitize/sanitize_server.py:235`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ClassifyResponse` | Class | `pipeline/shared/models.py` | 31 |
| `KeywordHit` | Class | `pipeline/comply/keyword_scanner.py` | 114 |
| `ComplianceResult` | Class | `pipeline/comply/compliance_engine.py` | 31 |
| `GatewayReidentifyResponse` | Class | `pipeline/shared/models.py` | 107 |
| `TitleBlockData` | Class | `pipeline/comply/title_block.py` | 40 |
| `scan_text` | Function | `pipeline/comply/keyword_scanner.py` | 122 |
| `classify` | Function | `pipeline/comply/comply_server.py` | 237 |
| `score` | Function | `pipeline/comply/compliance_engine.py` | 41 |
| `get_pool` | Function | `pipeline/shared/db.py` | 9 |
| `get_job` | Function | `pipeline/sanitize/sanitize_server.py` | 235 |
| `get_document` | Function | `pipeline/comply/comply_server.py` | 282 |
| `review_queue` | Function | `pipeline/comply/comply_server.py` | 294 |
| `reidentify` | Function | `pipeline/gateway/gateway_server.py` | 295 |
| `get_request` | Function | `pipeline/gateway/gateway_server.py` | 336 |
| `extract_from_pdf` | Function | `pipeline/comply/title_block.py` | 48 |
| `extract_from_image_text` | Function | `pipeline/comply/title_block.py` | 100 |
| `pdf_to_image` | Function | `pipeline/comply/comply_server.py` | 169 |
| `search` | Method | `frontend/e2e/pages/QuotesPage.ts` | 31 |
| `_load_db_keywords` | Function | `pipeline/comply/comply_server.py` | 64 |
| `_load_defense_cages` | Function | `pipeline/comply/comply_server.py` | 71 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Classify → TitleBlockData` | cross_community | 4 |
| `Classify → Search` | cross_community | 4 |
| `Analyze → Get_pool` | cross_community | 3 |
| `Reidentify → CamelCaseKeys` | cross_community | 3 |
| `Pdf_to_image → CamelCaseKeys` | cross_community | 3 |
| `Score → CamelCaseKeys` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Providers | 3 calls |

## How to Explore

1. `gitnexus_context({name: "scan_text"})` — see callers and callees
2. `gitnexus_query({query: "comply"})` — find related execution flows
3. Read key files listed above for implementation details
