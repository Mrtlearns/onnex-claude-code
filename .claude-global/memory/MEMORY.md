# Memory Index

> This file is the index of all persistent reference files in the memory system.
> Updated: 2026-04-01

## Feedback

- [Task completion format](feedback_task_completion_format.md) — Split To-Do into (Claude) / (MrT) sections, end with "Done MrT"
- [Execute autonomously](feedback_execute_dont_list.md) — If Claude can run it (SSH, deploy, scripts), do it. Don't list it as MrT action.

## Reference Files

| File | Purpose |
|------|---------|
| [reference_tool_selection.md](reference_tool_selection.md) | Windows MCP tool priority rules (Filesystem → Registry → HTTP → TCP → PowerShell) |
| [reference_mcp_tool_routing.md](reference_mcp_tool_routing.md) | Detailed MCP routing patterns, safe commands, blocked commands |
| [reference_provisioning_api.md](reference_provisioning_api.md) | claude-controller provisioning API (10.10.30.40:5000 / Tailscale 100.111.233.126:5000) |
| [reference_ai_os_vm.md](reference_ai_os_vm.md) | SSH access for AI-OS VM at 10.10.110.31 (user: mrt, paramiko pattern) |

## Memory Stack

Live memory lives in **mem0 + Chroma** (WSL Ubuntu).
- 43 facts across 4 scopes: global, ndtv1, pi_lawyer_os, workspace
- Recall tested: 8/8 pass (2026-03-31)
- Scripts: `scripts/` subdirectory — auto_capture.py, mem0_client.py, smart_search.py, evolve.py

## Test Artifacts (historical)

- `smoke_test_results.txt` — mem0+Chroma smoke test output (2026-03-31)
- `recall_test_results.txt` — 8-query recall validation output (2026-03-31)
