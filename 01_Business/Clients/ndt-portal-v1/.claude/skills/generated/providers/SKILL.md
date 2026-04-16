---
name: providers
description: "Skill for the Providers area of ndt-portal-v1. 13 symbols across 8 files."
---

# Providers

13 symbols | 8 files | Cohesion: 63%

## When to Use

- Working with code in `pipeline/`
- Understanding how patch_nodes, patch_connections, ollama_url work
- Modifying providers-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `pipeline/shared/config.py` | ollama_url, presidio_analyzer_url, presidio_image_redactor_url, anthropic_api_key |
| `scripts/patch_wf5_preproc.py` | patch_nodes, patch_connections |
| `pipeline/gateway/providers/anthropic_provider.py` | get_client, call |
| `pipeline/gateway/providers/openrouter_provider.py` | call |
| `pipeline/gateway/providers/openai_provider.py` | call |
| `pipeline/gateway/providers/ollama_provider.py` | call |
| `pipeline/gateway/providers/gemini_provider.py` | call |
| `frontend/src/lib/api.ts` | get |

## Entry Points

Start here when exploring this area:

- **`patch_nodes`** (Function) — `scripts/patch_wf5_preproc.py:163`
- **`patch_connections`** (Function) — `scripts/patch_wf5_preproc.py:216`
- **`ollama_url`** (Function) — `pipeline/shared/config.py:21`
- **`presidio_analyzer_url`** (Function) — `pipeline/shared/config.py:25`
- **`presidio_image_redactor_url`** (Function) — `pipeline/shared/config.py:29`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `patch_nodes` | Function | `scripts/patch_wf5_preproc.py` | 163 |
| `patch_connections` | Function | `scripts/patch_wf5_preproc.py` | 216 |
| `ollama_url` | Function | `pipeline/shared/config.py` | 21 |
| `presidio_analyzer_url` | Function | `pipeline/shared/config.py` | 25 |
| `presidio_image_redactor_url` | Function | `pipeline/shared/config.py` | 29 |
| `call` | Function | `pipeline/gateway/providers/openrouter_provider.py` | 15 |
| `call` | Function | `pipeline/gateway/providers/openai_provider.py` | 11 |
| `call` | Function | `pipeline/gateway/providers/ollama_provider.py` | 21 |
| `call` | Function | `pipeline/gateway/providers/gemini_provider.py` | 11 |
| `anthropic_api_key` | Function | `pipeline/shared/config.py` | 17 |
| `get_client` | Function | `pipeline/gateway/providers/anthropic_provider.py` | 14 |
| `call` | Function | `pipeline/gateway/providers/anthropic_provider.py` | 21 |
| `get` | Method | `frontend/src/lib/api.ts` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Sanitize → CamelCaseKeys` | cross_community | 6 |
| `Analyze → CamelCaseKeys` | cross_community | 4 |
| `Main → CamelCaseKeys` | cross_community | 4 |
| `Upload_msg → CamelCaseKeys` | cross_community | 4 |
| `Upload_msg_file → CamelCaseKeys` | cross_community | 4 |
| `Upload_batch → CamelCaseKeys` | cross_community | 4 |
| `Upload_batch → CamelCaseKeys` | cross_community | 4 |
| `Patch_nodes → CamelCaseKeys` | cross_community | 4 |
| `Sync_jobs → CamelCaseKeys` | cross_community | 4 |
| `Call → CamelCaseKeys` | cross_community | 4 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Cluster_45 | 1 calls |

## How to Explore

1. `gitnexus_context({name: "patch_nodes"})` — see callers and callees
2. `gitnexus_query({query: "providers"})` — find related execution flows
3. Read key files listed above for implementation details
