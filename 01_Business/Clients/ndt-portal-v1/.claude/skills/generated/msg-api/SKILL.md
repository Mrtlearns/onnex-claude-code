---
name: msg-api
description: "Skill for the Msg-api area of ndt-portal-v1. 17 symbols across 8 files."
---

# Msg-api

17 symbols | 8 files | Cohesion: 66%

## When to Use

- Working with code in `msg-api/`
- Understanding how download_attachment, info, close_pool work
- Modifying msg-api-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `msg-api/msg_api_server.py` | download_attachment, _format_result, upload_msg, upload_batch |
| `files/extracted/msg_api_server.py` | download_attachment, format_result, upload_msg_file, upload_batch |
| `msg-api/msg_extractor.py` | _decoration_check, _safe_dirname, extract_single_msg, MSGExtractor |
| `files/deploy_step_progress.py` | info |
| `pipeline/shared/db.py` | close_pool |
| `pipeline/sanitize/sanitize_server.py` | lifespan |
| `pipeline/comply/comply_server.py` | lifespan |
| `pipeline/gateway/gateway_server.py` | lifespan |

## Entry Points

Start here when exploring this area:

- **`download_attachment`** (Function) — `msg-api/msg_api_server.py:185`
- **`info`** (Function) — `files/deploy_step_progress.py:550`
- **`close_pool`** (Function) — `pipeline/shared/db.py:17`
- **`lifespan`** (Function) — `pipeline/sanitize/sanitize_server.py:36`
- **`lifespan`** (Function) — `pipeline/comply/comply_server.py:52`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `MSGExtractor` | Class | `msg-api/msg_extractor.py` | 50 |
| `download_attachment` | Function | `msg-api/msg_api_server.py` | 185 |
| `info` | Function | `files/deploy_step_progress.py` | 550 |
| `close_pool` | Function | `pipeline/shared/db.py` | 17 |
| `lifespan` | Function | `pipeline/sanitize/sanitize_server.py` | 36 |
| `lifespan` | Function | `pipeline/comply/comply_server.py` | 52 |
| `lifespan` | Function | `pipeline/gateway/gateway_server.py` | 133 |
| `download_attachment` | Function | `files/extracted/msg_api_server.py` | 159 |
| `extract_single_msg` | Function | `msg-api/msg_extractor.py` | 56 |
| `format_result` | Function | `files/extracted/msg_api_server.py` | 52 |
| `upload_msg_file` | Function | `files/extracted/msg_api_server.py` | 104 |
| `upload_batch` | Function | `files/extracted/msg_api_server.py` | 193 |
| `upload_msg` | Function | `msg-api/msg_api_server.py` | 117 |
| `upload_batch` | Function | `msg-api/msg_api_server.py` | 152 |
| `_decoration_check` | Function | `msg-api/msg_extractor.py` | 30 |
| `_safe_dirname` | Function | `msg-api/msg_extractor.py` | 44 |
| `_format_result` | Function | `msg-api/msg_api_server.py` | 51 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Upload_msg → CamelCaseKeys` | cross_community | 4 |
| `Upload_msg_file → CamelCaseKeys` | cross_community | 4 |
| `Upload_batch → CamelCaseKeys` | cross_community | 4 |
| `Upload_batch → CamelCaseKeys` | cross_community | 4 |
| `Upload_msg → _safe_dirname` | cross_community | 3 |
| `Upload_msg → _decoration_check` | cross_community | 3 |
| `Upload_msg_file → _safe_dirname` | intra_community | 3 |
| `Upload_msg_file → _decoration_check` | intra_community | 3 |
| `Lifespan → DrawingNumberRecognizer` | cross_community | 3 |
| `Lifespan → PartNumberRecognizer` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Comply | 3 calls |
| Providers | 2 calls |
| Sanitize | 1 calls |

## How to Explore

1. `gitnexus_context({name: "download_attachment"})` — see callers and callees
2. `gitnexus_query({query: "msg-api"})` — find related execution flows
3. Read key files listed above for implementation details
