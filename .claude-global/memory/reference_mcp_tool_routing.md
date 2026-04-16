---
name: MCP Tool Routing — Lean Paths
description: Decision table for which tool to use in claude.ai chat sessions with Windows-MCP. Based on failures from this session. Avoids PowerShell where a dedicated tool exists and avoids blocking calls that hang the MCP process.
type: reference
---

# MCP Tool Routing — Lean Paths

## Why This Exists

Windows-MCP has three classes of tools available in claude.ai:
1. `Windows-MCP:PowerShell` — full PS shell, flexible but can block and crash the MCP process
2. `Windows-MCP:FileSystem` — direct file ops, no shell overhead, no command-length limit
3. `Windows-MCP:Registry` — direct registry reads/writes

PowerShell is the wrong tool for file and registry ops. Several PS calls crashed the MCP process during long sessions.

---

## Decision Table

| Operation | AVOID | USE INSTEAD | Why PS fails |
|-----------|-------|-------------|-------------|
| Network test | `Test-NetConnection`, `Find-NetRoute` | `TcpClient + AsyncWaitHandle.WaitOne(1500)` or `Invoke-RestMethod -TimeoutSec 5` | Blocks OS-level for full OS timeout, hangs entire MCP process |
| Large file write | PowerShell heredoc `@'...'@ \| Out-File` | `Windows-MCP:FileSystem mode=write` with `content` param | WinError 206 — PS command string hits Windows MAX_PATH/command length limit |
| File read | `Get-Content` via PS | `Windows-MCP:FileSystem mode=read` with `offset`/`limit`, or `tail=N` | Slow for large files; output gets truncated in MCP response |
| Directory listing | `Get-ChildItem -Recurse` | `Windows-MCP:FileSystem mode=list` or `mode=search pattern=*.ext` | Crawls node_modules and other large trees; output is huge and slow |
| File exists/info | `Test-Path` / `Get-Item` | `Windows-MCP:FileSystem mode=info` | Extra PS subprocess for a simple stat call |
| File copy | `Copy-Item` / `robocopy` (simple) | `Windows-MCP:FileSystem mode=copy` | Use robocopy only when /XD /XF exclusions are needed |
| Registry read/write | `Get-ItemProperty`, `reg query`, `[Env]::GetEnvironmentVariable` | `Windows-MCP:Registry mode=get/set/list path=HKCU:\...` | Extra PS overhead; Registry tool is direct and typed |
| Remote SSH commands | `python -c "import paramiko..."` | `Invoke-RestMethod -TimeoutSec 5` for HTTP APIs, or `ssh -o ConnectTimeout=5` in PS | Windows Store python stub adds 5–8s cold start, timed out at 10s limit |
| Screenshot | Default (tries dxcam) | Screenshot tool with `SCREENSHOT_BACKEND=mss` + `SCREENSHOT_SCALE=0.5` set as User env vars | dxcam hangs on GPU capture with dual RTX 3090 before fallback |

---

## When PowerShell IS the Right Tool

- Conditional logic, loops, string processing
- git operations
- robocopy with exclusion flags (/XD /XF)
- system admin tasks (services, processes, scheduled tasks)
- PowerShell-specific cmdlets with no FileSystem equivalent
- Any task under 30 lines that doesn't involve file I/O or network blocking

---

## Safe Network Test Pattern (copy-paste)

```powershell
function Test-Port($h, $p, $ms=1500) {
    try {
        $t = New-Object System.Net.Sockets.TcpClient
        $r = $t.BeginConnect($h, $p, $null, $null)
        $ok = $r.AsyncWaitHandle.WaitOne($ms, $false)
        $t.Close(); return $ok
    } catch { return $false }
}
# Usage:
Test-Port "100.111.233.126" 22    # SSH
Test-Port "100.111.233.126" 5000  # API
```

This is also in `$PROFILE` as `Test-Port`.

---

## FileSystem Tool Quick Reference

```
mode=read   path=... [offset=N] [limit=N]    # read file, optional slice
mode=write  path=... content="..."           # write file (no shell length limit)
mode=copy   path=... destination=...         # copy file or directory
mode=move   path=... destination=...         # move or rename
mode=delete path=... [recursive=true]        # delete
mode=list   path=... [pattern=*.md]          # list directory contents
mode=search path=... pattern=**/*.py         # glob search
mode=info   path=...                         # stat: size, dates, type
```

---

## Notes

- MCP process timeout is 4 minutes — any blocking call that runs longer crashes it
- intentional shutdown on tab switch is NORMAL — not a crash
- Screenshot requires Claude Desktop restart to pick up SCREENSHOT_BACKEND=mss env var
