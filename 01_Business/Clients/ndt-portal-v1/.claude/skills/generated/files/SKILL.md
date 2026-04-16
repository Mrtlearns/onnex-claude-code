---
name: files
description: "Skill for the Files area of ndt-portal-v1. 9 symbols across 2 files."
---

# Files

9 symbols | 2 files | Cohesion: 94%

## When to Use

- Working with code in `files/`
- Understanding how ssh_exec, section, ok work
- Modifying files-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `files/deploy_step_progress.py` | ssh_exec, section, ok, fail, main |
| `files/e2e_test.py` | run, jpost, jget, http_code |

## Entry Points

Start here when exploring this area:

- **`ssh_exec`** (Function) — `files/deploy_step_progress.py:533`
- **`section`** (Function) — `files/deploy_step_progress.py:542`
- **`ok`** (Function) — `files/deploy_step_progress.py:548`
- **`fail`** (Function) — `files/deploy_step_progress.py:549`
- **`main`** (Function) — `files/deploy_step_progress.py:553`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `ssh_exec` | Function | `files/deploy_step_progress.py` | 533 |
| `section` | Function | `files/deploy_step_progress.py` | 542 |
| `ok` | Function | `files/deploy_step_progress.py` | 548 |
| `fail` | Function | `files/deploy_step_progress.py` | 549 |
| `main` | Function | `files/deploy_step_progress.py` | 553 |
| `run` | Function | `files/e2e_test.py` | 9 |
| `jpost` | Function | `files/e2e_test.py` | 22 |
| `jget` | Function | `files/e2e_test.py` | 41 |
| `http_code` | Function | `files/e2e_test.py` | 49 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Msg-api | 1 calls |

## How to Explore

1. `gitnexus_context({name: "ssh_exec"})` — see callers and callees
2. `gitnexus_query({query: "files"})` — find related execution flows
3. Read key files listed above for implementation details
