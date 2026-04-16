---
name: Windows-MCP Tool Selection and Safe Patterns
description: Tool priority order, blocked commands, and lean alternatives for Windows automation via claude.ai chat MCP tools.
type: reference
---

# Tool Priority (claude.ai chat sessions with Windows-MCP)

1. Filesystem:*           — D:\Code\ file ops (separate MCP, instant, stable)
2. Windows-MCP:Registry   — registry and env var access
3. Invoke-RestMethod      — HTTP API calls (-TimeoutSec 5 always)
4. Test-Port ($PROFILE)   — TCP port checks (1500ms non-blocking)
5. Windows-MCP:PowerShell — process mgmt, git, env vars, complex logic only

## File ops: Filesystem:* scope = D:\Code\ (all subdirectories)

read  -> Filesystem:read_text_file  (head=N / tail=N for partial reads)
write -> Filesystem:write_file      (no 32K command-length limit)
list  -> Filesystem:list_directory or directory_tree
check -> Filesystem:get_file_info
mkdir -> Filesystem:create_directory
multi -> Filesystem:read_multiple_files

## Banned PowerShell commands (crash MCP process)

Test-NetConnection     blocks 30s+ per call
Find-NetRoute          blocks for routing lookup
Test-Connection        blocks (ping)
python -c subprocess   slow startup + import time > timeout

## WinError 206 = command string too long

Use Filesystem:write_file instead of Out-File via PowerShell for large content.
Chunk PowerShell heredocs to ~4KB max per call.

## Screenshot backend

SCREENSHOT_BACKEND=mss + SCREENSHOT_SCALE=0.5 set (User env vars).
Requires Claude Desktop restart to activate.
Default "auto" tries dxcam which hangs on dual RTX 3090.

## MCP restarts

"intentional shutdown" = normal tab switch (not a crash)
"transport closed unexpectedly" = real crash

Fixed crashes:
- spawn uv ENOENT: mcpServers config uses full path C:\Users\mrtma\.local\bin\uv.exe
- AuthError localhost:3000: mcpServers entry bypasses Desktop Extension auth
- utils.py SyntaxWarning: patched backslash in docstring line 29

Full skill: D:\Code\Claude\.claude-global\skills\core-windows-mcp\SKILL.md
