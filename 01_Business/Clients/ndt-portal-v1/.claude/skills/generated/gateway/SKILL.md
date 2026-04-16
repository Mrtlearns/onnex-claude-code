---
name: gateway
description: "Skill for the Gateway area of ndt-portal-v1. 9 symbols across 4 files."
---

# Gateway

9 symbols | 4 files | Cohesion: 73%

## When to Use

- Working with code in `pipeline/`
- Understanding how scan_prompt, resolve_routing, redact_image work
- Modifying gateway-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `pipeline/gateway/gateway_server.py` | redact_image, get_llm_config, get_provider_config, analyze |
| `pipeline/shared/models.py` | ImagePayload, AnalyzeResponse |
| `pipeline/gateway/second_pass.py` | ResidualPIIError, scan_prompt |
| `pipeline/gateway/llm_router.py` | resolve_routing |

## Entry Points

Start here when exploring this area:

- **`scan_prompt`** (Function) — `pipeline/gateway/second_pass.py:44`
- **`resolve_routing`** (Function) — `pipeline/gateway/llm_router.py:29`
- **`redact_image`** (Function) — `pipeline/gateway/gateway_server.py:38`
- **`get_llm_config`** (Function) — `pipeline/gateway/gateway_server.py:64`
- **`get_provider_config`** (Function) — `pipeline/gateway/gateway_server.py:108`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ImagePayload` | Class | `pipeline/shared/models.py` | 74 |
| `AnalyzeResponse` | Class | `pipeline/shared/models.py` | 91 |
| `ResidualPIIError` | Class | `pipeline/gateway/second_pass.py` | 37 |
| `scan_prompt` | Function | `pipeline/gateway/second_pass.py` | 44 |
| `resolve_routing` | Function | `pipeline/gateway/llm_router.py` | 29 |
| `redact_image` | Function | `pipeline/gateway/gateway_server.py` | 38 |
| `get_llm_config` | Function | `pipeline/gateway/gateway_server.py` | 64 |
| `get_provider_config` | Function | `pipeline/gateway/gateway_server.py` | 108 |
| `analyze` | Function | `pipeline/gateway/gateway_server.py` | 151 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Analyze → CamelCaseKeys` | cross_community | 4 |
| `Analyze → ResidualPIIError` | intra_community | 3 |
| `Analyze → Get_pool` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Comply | 3 calls |
| Providers | 3 calls |

## How to Explore

1. `gitnexus_context({name: "scan_prompt"})` — see callers and callees
2. `gitnexus_query({query: "gateway"})` — find related execution flows
3. Read key files listed above for implementation details
