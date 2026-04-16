# core-windows-mcp — Tool Selection and Safe Patterns

> Use this skill whenever executing commands or file operations on Mr. T's Windows machine via Claude Desktop (claude.ai chat with MCP tools).

---

## Tool Priority Order

Always prefer tools in this order. Lower-numbered tools are faster, more stable, and don't risk crashing the MCP process.

```
1. Filesystem:*           D:\Code\ file ops — separate stable MCP server, instant
2. Windows-MCP:Registry   Registry reads/writes — dedicated, non-blocking
3. Invoke-RestMethod      HTTP API calls — explicit TimeoutSec, non-blocking
4. Test-Port ($PROFILE)   TCP port checks — 1500ms AsyncWaitHandle, non-blocking
5. Windows-MCP:PowerShell Last resort: process mgmt, git, env vars, complex logic
```

---

## File Operations Under D:\Code\ — Use Filesystem:* Not PowerShell

The Filesystem MCP server has D:\Code as its allowed root. All subdirectories are accessible.

| Task | PowerShell (avoid) | Lean alternative |
|------|-------------------|-----------------|
| Read file | Get-Content | Filesystem:read_text_file |
| Read last N lines | Get-Content -Tail N | Filesystem:read_text_file tail=N |
| Read first N lines | Get-Content -TotalCount N | Filesystem:read_text_file head=N |
| Read multiple files | Multiple Get-Content calls | Filesystem:read_multiple_files |
| Write file | Out-File / Set-Content | Filesystem:write_file (no 32K char limit) |
| List directory | Get-ChildItem | Filesystem:list_directory or directory_tree |
| Check path exists | Test-Path | Filesystem:get_file_info |
| Create directory | New-Item -ItemType Directory | Filesystem:create_directory |
| Search files | Get-ChildItem -Recurse -Filter | Filesystem:search_files |

---

## Registry — Use Windows-MCP:Registry Not PowerShell

| Task | PowerShell (avoid) | Lean alternative |
|------|-------------------|-----------------|
| Read env var | [System.Environment]::GetEnvironmentVariable | Windows-MCP:Registry mode=get path="HKCU:\Environment" name="VAR" |
| Read HKLM key | Get-ItemProperty | Windows-MCP:Registry mode=get |
| Write env var | [System.Environment]::SetEnvironmentVariable | Windows-MCP:Registry mode=set |
| List subkeys | Get-ChildItem | Windows-MCP:Registry mode=list |

---

## Network Checks — NEVER Use Blocking Cmdlets

These block the entire MCP process thread until OS timeout. 2-3 calls exceed the 4-minute MCP timeout and crash the server.

BANNED (crash MCP):
- Test-NetConnection — blocks 30s+ per call
- Find-NetRoute — blocks for full routing lookup
- Test-Connection (ping) — blocks
- python subprocess for socket/paramiko — slow startup + import time

Safe TCP check (Test-Port is in $PROFILE):
  Test-Port -Host "100.111.233.126" -Port 22   # 1500ms max, non-blocking

Safe routing check:
  route print | Select-String "100\.|Tailscale"  # non-blocking string parse

Safe HTTP check:
  Invoke-RestMethod -Uri "http://100.111.233.126:5000/api/status" -TimeoutSec 5

---

## PowerShell Command Length Limit (WinError 206)

Windows has a ~32,767 character limit on process arguments.
Symptom: FileNotFoundError: [WinError 206] The filename or extension is too long
Fix: Use Filesystem:write_file for any content over ~200 lines.
For medium content through PowerShell, chunk into multiple Add-Content calls (max ~4KB per call).

---

## Screenshot Tool

Default backend (auto) tries dxcam first — hangs on dual RTX 3090 GPU capture.
Fix: SCREENSHOT_BACKEND=mss + SCREENSHOT_SCALE=0.5 set as User env vars.
Requires Claude Desktop restart to activate.
After restart: CPU-based mss, ~200ms, no GPU hang.

---

## MCP Lifecycle — Restarts Are Normal

Claude Desktop kills and respawns the Windows-MCP process on every tab switch and new conversation.
"Server transport closed (intentional shutdown)" = normal tab switch, NOT a crash.
"Server transport closed unexpectedly" + "Server disconnected" = actual crash.

Actual crash history:
- spawn uv ENOENT: fixed — full path C:\Users\mrtma\.local\bin\uv.exe in mcpServers config
- AuthError localhost:3000: fixed — mcpServers entry bypasses Desktop Extension auth
- utils.py SyntaxWarning line 29: patched — invalid escape \m in docstring

---

## Infrastructure Access

Prefer HTTP API over SSH subprocess for homelab:
  Invoke-RestMethod -Uri "http://100.111.233.126:5000/api/status" -TimeoutSec 5

claude-controller: LAN 10.10.30.40:5000 | Tailscale 100.111.233.126:5000
Full provisioning API ref: D:\Code\Claude\.claude-global\memory\reference_provisioning_api.md

---

## Quick Decision Tree

Need to read/write a file under D:\Code\?
  YES -> Filesystem:* tools

Need to read/write registry or env var?
  YES -> Windows-MCP:Registry

Need to check if a port is open?
  YES -> Test-Port function (in $PROFILE)

Need to call an HTTP API?
  YES -> Invoke-RestMethod -TimeoutSec 5

Anything else (git, process mgmt, complex logic)?
  -> Windows-MCP:PowerShell with explicit timeout param
  -> Never exceed ~4KB in the command string
  -> Never use blocking network cmdlets
