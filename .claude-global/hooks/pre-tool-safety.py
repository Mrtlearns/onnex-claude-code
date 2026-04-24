#!/usr/bin/env python3
"""
pre-tool-safety.py — PreToolUse hook
Three-tier security model (inspired by PAI SecurityValidator):
  - BLOCKED  (exit 2) : Hard block, catastrophic/irreversible operations
  - CONFIRM  (exit 0 + JSON) : Ask user before proceeding
  - ALERT    (exit 0 + stderr) : Log and allow
  - ALLOW    (exit 0) : Silent pass

Covers: Bash commands + file path protection zones.
"""

import json
import sys
import re

sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")


# ─────────────────────────────────────────────
# BASH PATTERNS
# ─────────────────────────────────────────────

BASH_BLOCKED = [
    # Filesystem destruction
    (r"rm\s+-rf\s+/",              "Filesystem root destruction"),
    (r"rm\s+-rf\s+~",              "Home directory destruction"),
    (r"sudo\s+rm\s+-rf",           "Destructive rm with sudo"),
    (r"del\s+/f\s+/s\s+/q",        "Windows recursive force delete"),
    (r"rd\s+/s\s+/q\s+[A-Za-z]:\\","Windows drive recursive delete"),
    # Disk operations
    (r"dd\s+if=/dev/zero",         "Disk overwrite with dd"),
    (r"mkfs",                      "Filesystem format"),
    (r"diskutil\s+erase",          "Disk erase"),
    (r"format\s+[A-Za-z]:",        "Windows format drive"),
    # Repo destruction
    (r"gh\s+repo\s+delete",        "GitHub repo deletion"),
    # SQL destruction (unqualified)
    (r"DROP\s+DATABASE",           "Database destruction"),
    # Pipe-exec (curl/wget to shell)
    (r"curl.+\|\s*(bash|sh)",      "Piping curl to shell (supply chain risk)"),
    (r"wget.+\|\s*(bash|sh)",      "Piping wget to shell (supply chain risk)"),
    # Windows credential theft patterns
    (r"mimikatz",                  "Credential dumping tool"),
    (r"sekurlsa",                  "Credential dumping pattern"),
]

BASH_CONFIRM = [
    # Git: per user's "always allow all git actions" feedback, no git commands
    # gate here. Still logged via BASH_ALERT for audit trail. See
    # feedback_git_autonomous.md.
    # Infrastructure
    (r"terraform\s+destroy",       "Infrastructure destruction"),
    (r"terraform\s+apply.+auto-approve", "Auto-approve bypasses review"),
    (r"pulumi\s+destroy",          "Infrastructure destruction"),
    # Containers
    (r"docker\s+system\s+prune",   "Removes all unused Docker data"),
    (r"docker\s+volume\s+rm",      "Volume data deletion"),
    (r"kubectl\s+delete\s+namespace", "Kubernetes namespace deletion"),
    # Cloud
    (r"aws\s+s3\s+rm.+--recursive","Bulk S3 deletion"),
    (r"aws\s+(ec2|rds|ecs).+terminate|delete", "AWS resource deletion"),
    (r"gcloud.+delete",            "GCP resource deletion"),
    # DB (scoped)
    (r"DROP\s+TABLE",              "Table destruction — confirm scope"),
    (r"TRUNCATE\s+TABLE",          "Table data wipe — confirm scope"),
    (r"DELETE\s+FROM\s+\w+\s+WHERE","Bulk delete — confirm scope"),
    # Proxmox / homelab
    (r"pvesh\s+delete",            "Proxmox resource deletion"),
    (r"qm\s+destroy",              "Proxmox VM destruction"),
    (r"pct\s+destroy",             "Proxmox CT destruction"),
    # SAP (RFC/BAPI destructive)
    (r"BAPI_MATERIAL_DELETE",      "SAP material deletion — confirm"),
    (r"BAPI_ACC_DOCUMENT_POST.*STORNO", "SAP document reversal — confirm"),
]

BASH_ALERT = [
    # Git — all allowed per user's autonomous-git feedback; logged here for audit trail.
    (r"git\s+push\b(?!.*(-f|--force)).*\b(main|master)\b", "Direct push to main/master — allowed, logging"),
    (r"git\s+push\s+(--force|-f)", "Force push — allowed per user config, can overwrite remote commits"),
    (r"git\s+reset\s+--hard",      "git reset --hard — allowed per user config, discards uncommitted work"),
    (r"git\s+clean\s+-fd",         "git clean -fd — allowed per user config, deletes untracked files"),
    # Non-git alerts retained
    (r"sudo\s+",                   "Sudo usage — elevated privilege"),
    (r"chmod\s+777",               "Permissive chmod — security concern"),
    (r"ssh.+StrictHostKeyChecking=no", "SSH host key checking disabled"),
    (r"--no-verify",               "Git hooks bypassed"),
    (r"base64\s+-d\s*\|",          "Base64 decode piped to command"),
    (r"gh\s+pr\s+create",          "Creating PR — will be visible to collaborators"),
    (r"gh\s+pr\s+merge",           "Merging PR — confirm base branch"),
]


# ─────────────────────────────────────────────
# PATH PROTECTION ZONES
# ─────────────────────────────────────────────

# Complete denial — read + write + delete
PATH_ZERO_ACCESS = [
    r"[/\\]\.ssh[/\\](id_|.*\.pem)",
    r"[/\\]\.aws[/\\]credentials",
    r"[/\\]\.gnupg[/\\]private",
    r"service[-_]account.*\.json",
]

# Cannot write or delete (read allowed)
PATH_READ_ONLY = [
    r"^/etc/",
    r"[/\\]\.git[/\\]config$",
]

# Writing requires confirmation
PATH_CONFIRM_WRITE = [
    r"(^|[/\\])\.env(\.|$)",
    r"[/\\]\.claude[/\\]settings(\.local)?\.json$",
    r"credentials\.json$",
    r"private[-_]key",
    r"(id_rsa|id_ed25519|id_ecdsa)$",
]

# Cannot delete
PATH_NO_DELETE = [
    r"[/\\]\.git[/\\]",
    r"(^|[/\\])LICENSE",
    r"(^|[/\\])README\.md$",
    r"(^|[/\\])CLAUDE\.md$",
]


# ─────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────

def match_any(text, patterns):
    for pattern, reason in patterns:
        try:
            if re.search(pattern, text, re.IGNORECASE):
                return reason
        except re.error:
            # Skip invalid regex patterns
            continue
    return None


def match_path_any(path, patterns):
    path_norm = path.replace("\\", "/")
    for pattern in patterns:
        if re.search(pattern, path_norm, re.IGNORECASE):
            return pattern
    return None


def block(reason):
    print(reason, file=sys.stderr)
    sys.exit(2)


def confirm(message):
    print(json.dumps({"decision": "ask", "message": message}))
    sys.exit(0)


def alert(reason):
    print(f"[SAFETY ALERT] {reason}", file=sys.stderr)
    # fall through to allow


def allow():
    sys.exit(0)


# ─────────────────────────────────────────────
# TOOL HANDLERS
# ─────────────────────────────────────────────

def handle_bash(command):
    reason = match_any(command, BASH_BLOCKED)
    if reason:
        block(f"BLOCKED: {reason}\nCommand: {command[:200]}")

    reason = match_any(command, BASH_CONFIRM)
    if reason:
        confirm(
            f"⚠️  SAFETY CHECK: {reason}\n\n"
            f"Command:\n  {command[:300]}\n\n"
            f"Proceed?"
        )

    reason = match_any(command, BASH_ALERT)
    if reason:
        alert(reason)

    allow()


def handle_file_write(file_path):
    if match_path_any(file_path, PATH_ZERO_ACCESS):
        block(f"BLOCKED: Zero-access path — cannot write '{file_path}'")

    if match_path_any(file_path, PATH_READ_ONLY):
        block(f"BLOCKED: Read-only path — cannot write '{file_path}'")

    pattern = match_path_any(file_path, PATH_CONFIRM_WRITE)
    if pattern:
        confirm(
            f"⚠️  SAFETY CHECK: Writing to sensitive path\n\n"
            f"File: {file_path}\n\n"
            f"Proceed?"
        )

    allow()


def handle_file_delete(file_path):
    if match_path_any(file_path, PATH_ZERO_ACCESS):
        block(f"BLOCKED: Zero-access path — cannot delete '{file_path}'")

    if match_path_any(file_path, PATH_NO_DELETE):
        block(f"BLOCKED: Protected path — cannot delete '{file_path}'")

    allow()


def handle_file_read(file_path):
    if match_path_any(file_path, PATH_ZERO_ACCESS):
        block(f"BLOCKED: Zero-access path — cannot read '{file_path}'")

    allow()


# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────

try:
    try:
        input_data = json.loads(sys.stdin.read())
    except Exception:
        sys.exit(0)  # Fail open on parse error

    tool_name = input_data.get("tool_name", "")
    tool_input = input_data.get("tool_input", {})

    if isinstance(tool_input, str):
        # Some tools pass input as raw string
        tool_input = {}

    def get_path():
        return str(tool_input.get("path", "") or tool_input.get("file_path", ""))

    if tool_name in ("Bash", "bash_tool", "execute_command"):
        command = str(tool_input.get("command", "") or tool_input.get("cmd", ""))
        handle_bash(command)

    elif tool_name in ("Write", "create_file"):
        handle_file_write(get_path())

    elif tool_name in ("Edit", "MultiEdit", "str_replace"):
        handle_file_write(get_path())

    elif tool_name == "Read":
        handle_file_read(get_path())

    # Allow everything else
    sys.exit(0)

except Exception as e:
    # Fail open if hook crashes — log error but don't block operation
    print(f"[HOOK ERROR] {type(e).__name__}: {str(e)}", file=sys.stderr)
    sys.exit(0)
