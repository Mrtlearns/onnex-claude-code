---
name: sanitize
description: "Skill for the Sanitize area of ndt-portal-v1. 21 symbols across 5 files."
---

# Sanitize

21 symbols | 5 files | Cohesion: 86%

## When to Use

- Working with code in `pipeline/`
- Understanding how build_analyzer, entity_abbrev, derive_token work
- Modifying sanitize-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `pipeline/sanitize/presidio_engine.py` | DrawingNumberRecognizer, PartNumberRecognizer, CAGECodeRecognizer, ContractNumberRecognizer, CertIDRecognizer (+3) |
| `pipeline/sanitize/vault.py` | entity_abbrev, derive_token, encrypt, decrypt, role_can_reveal |
| `pipeline/sanitize/sanitize_server.py` | _tokenize_text, _store_vault_entries, sanitize, _restore_tokens, reidentify |
| `pipeline/shared/models.py` | SanitizeResponse, ReidentifyResponse |
| `pipeline/shared/config.py` | vault_key |

## Entry Points

Start here when exploring this area:

- **`build_analyzer`** (Function) — `pipeline/sanitize/presidio_engine.py:154`
- **`entity_abbrev`** (Function) — `pipeline/sanitize/vault.py:43`
- **`derive_token`** (Function) — `pipeline/sanitize/vault.py:47`
- **`encrypt`** (Function) — `pipeline/sanitize/vault.py:64`
- **`sanitize`** (Function) — `pipeline/sanitize/sanitize_server.py:161`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DrawingNumberRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 20 |
| `PartNumberRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 39 |
| `CAGECodeRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 59 |
| `ContractNumberRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 76 |
| `CertIDRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 97 |
| `ProjectCodeRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 117 |
| `EmailHeaderRecognizer` | Class | `pipeline/sanitize/presidio_engine.py` | 136 |
| `SanitizeResponse` | Class | `pipeline/shared/models.py` | 53 |
| `ReidentifyResponse` | Class | `pipeline/shared/models.py` | 67 |
| `build_analyzer` | Function | `pipeline/sanitize/presidio_engine.py` | 154 |
| `entity_abbrev` | Function | `pipeline/sanitize/vault.py` | 43 |
| `derive_token` | Function | `pipeline/sanitize/vault.py` | 47 |
| `encrypt` | Function | `pipeline/sanitize/vault.py` | 64 |
| `sanitize` | Function | `pipeline/sanitize/sanitize_server.py` | 161 |
| `vault_key` | Function | `pipeline/shared/config.py` | 8 |
| `decrypt` | Function | `pipeline/sanitize/vault.py` | 76 |
| `role_can_reveal` | Function | `pipeline/sanitize/vault.py` | 99 |
| `reidentify` | Function | `pipeline/sanitize/sanitize_server.py` | 205 |
| `_tokenize_text` | Function | `pipeline/sanitize/sanitize_server.py` | 50 |
| `_store_vault_entries` | Function | `pipeline/sanitize/sanitize_server.py` | 96 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Sanitize → CamelCaseKeys` | cross_community | 6 |
| `Sanitize → Encrypt` | intra_community | 3 |
| `Reidentify → Role_can_reveal` | intra_community | 3 |
| `Reidentify → Decrypt` | intra_community | 3 |
| `Lifespan → DrawingNumberRecognizer` | cross_community | 3 |
| `Lifespan → PartNumberRecognizer` | cross_community | 3 |
| `Lifespan → CAGECodeRecognizer` | cross_community | 3 |
| `Lifespan → ContractNumberRecognizer` | cross_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Comply | 2 calls |
| Providers | 1 calls |

## How to Explore

1. `gitnexus_context({name: "build_analyzer"})` — see callers and callees
2. `gitnexus_query({query: "sanitize"})` — find related execution flows
3. Read key files listed above for implementation details
