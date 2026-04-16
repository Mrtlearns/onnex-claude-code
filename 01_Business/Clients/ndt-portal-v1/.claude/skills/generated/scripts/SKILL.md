---
name: scripts
description: "Skill for the Scripts area of ndt-portal-v1. 26 symbols across 4 files."
---

# Scripts

26 symbols | 4 files | Cohesion: 74%

## When to Use

- Working with code in `scripts/`
- Understanding how soql_query, split_multivalue, parse_date work
- Modifying scripts-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `scripts/sf_sync.py` | soql_query, split_multivalue, parse_date, sync_accounts, sync_jobs (+10) |
| `scripts/patch_wf5_payloads.py` | patch_node_004, patch_node_012, patch_node_015, patch_node_018, patch_nodes |
| `scripts/deploy_analytics.py` | upload_tree, run, main, sftp_write, _ctx |
| `frontend/src/components/settings/RtMachineProfilesTab.tsx` | split |

## Entry Points

Start here when exploring this area:

- **`soql_query`** (Function) — `scripts/sf_sync.py:53`
- **`split_multivalue`** (Function) — `scripts/sf_sync.py:79`
- **`parse_date`** (Function) — `scripts/sf_sync.py:87`
- **`sync_accounts`** (Function) — `scripts/sf_sync.py:151`
- **`sync_jobs`** (Function) — `scripts/sf_sync.py:203`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `soql_query` | Function | `scripts/sf_sync.py` | 53 |
| `split_multivalue` | Function | `scripts/sf_sync.py` | 79 |
| `parse_date` | Function | `scripts/sf_sync.py` | 87 |
| `sync_accounts` | Function | `scripts/sf_sync.py` | 151 |
| `sync_jobs` | Function | `scripts/sf_sync.py` | 203 |
| `sync_quotes` | Function | `scripts/sf_sync.py` | 287 |
| `sync_quote_lines` | Function | `scripts/sf_sync.py` | 351 |
| `sync_products` | Function | `scripts/sf_sync.py` | 402 |
| `get_sf_token` | Function | `scripts/sf_sync.py` | 34 |
| `get_db` | Function | `scripts/sf_sync.py` | 69 |
| `get_last_sync` | Function | `scripts/sf_sync.py` | 95 |
| `job_start` | Function | `scripts/sf_sync.py` | 110 |
| `job_success` | Function | `scripts/sf_sync.py` | 119 |
| `job_error` | Function | `scripts/sf_sync.py` | 131 |
| `main` | Function | `scripts/sf_sync.py` | 433 |
| `patch_node_004` | Function | `scripts/patch_wf5_payloads.py` | 35 |
| `patch_node_012` | Function | `scripts/patch_wf5_payloads.py` | 71 |
| `patch_node_015` | Function | `scripts/patch_wf5_payloads.py` | 102 |
| `patch_node_018` | Function | `scripts/patch_wf5_payloads.py` | 153 |
| `patch_nodes` | Function | `scripts/patch_wf5_payloads.py` | 183 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Main → CamelCaseKeys` | cross_community | 4 |
| `Patch_nodes → CamelCaseKeys` | cross_community | 4 |
| `Sync_jobs → CamelCaseKeys` | cross_community | 4 |
| `Sync_quotes → CamelCaseKeys` | cross_community | 4 |
| `Sync_accounts → CamelCaseKeys` | cross_community | 4 |
| `Sync_products → CamelCaseKeys` | cross_community | 4 |
| `Sync_quote_lines → CamelCaseKeys` | cross_community | 4 |
| `Main → _ctx` | intra_community | 3 |
| `Sync_jobs → Split` | intra_community | 3 |
| `Sync_quotes → Split` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Providers | 9 calls |

## How to Explore

1. `gitnexus_context({name: "soql_query"})` — see callers and callees
2. `gitnexus_query({query: "scripts"})` — find related execution flows
3. Read key files listed above for implementation details
