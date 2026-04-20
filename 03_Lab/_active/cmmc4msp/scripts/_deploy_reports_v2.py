"""
Deploy SPRS Excel + Audit Package ZIP feature to cmmc4msp VM.

Steps:
  1. SFTP upload: requirements.txt, report_service.py, reports.py,
                  reports/page.tsx, api.ts
  2. docker compose build fastapi && up -d fastapi
  3. docker compose build nextjs  && up -d nextjs
  4. Smoke test: GET /health/deep, POST sprs-sheet, POST audit-package
"""
from __future__ import annotations

import io
import sys
import time
import urllib.request
import urllib.error
import json
from pathlib import Path
import paramiko

# Force UTF-8 on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"
STACK_DIR = "/opt/stacks/cmmc4msp"

REPO_ROOT = Path(__file__).resolve().parent.parent

TRANSFERS = [
    (
        REPO_ROOT / "fastapi/requirements.txt",
        f"{STACK_DIR}/fastapi/requirements.txt",
    ),
    (
        REPO_ROOT / "fastapi/app/services/report_service.py",
        f"{STACK_DIR}/fastapi/app/services/report_service.py",
    ),
    (
        REPO_ROOT / "fastapi/app/routers/reports.py",
        f"{STACK_DIR}/fastapi/app/routers/reports.py",
    ),
    (
        REPO_ROOT / "nextjs/src/app/[orgSlug]/reports/page.tsx",
        f"{STACK_DIR}/nextjs/src/app/[orgSlug]/reports/page.tsx",
    ),
    (
        REPO_ROOT / "nextjs/src/lib/api.ts",
        f"{STACK_DIR}/nextjs/src/lib/api.ts",
    ),
]

BUILD_COMMANDS = [
    ("Build FastAPI",  f"cd {STACK_DIR} && docker compose build fastapi 2>&1", 300),
    ("Start FastAPI",  f"cd {STACK_DIR} && docker compose up -d fastapi 2>&1", 60),
    ("FastAPI logs",   "docker logs cmmc-fastapi --tail 30 2>&1", 30),
    ("Build Next.js",  f"cd {STACK_DIR} && docker compose build nextjs 2>&1", 300),
    ("Start Next.js",  f"cd {STACK_DIR} && docker compose up -d nextjs 2>&1", 60),
    ("Next.js logs",   "docker logs cmmc-nextjs --tail 20 2>&1", 30),
]


def run_ssh(client: paramiko.SSHClient, label: str, cmd: str, timeout: int = 120) -> int:
    print(f"\n{'='*60}\n  {label}\n{'='*60}")
    print(f">>> {cmd}\n")
    transport = client.get_transport()
    assert transport
    ch = transport.open_session()
    ch.set_combine_stderr(True)
    ch.exec_command(cmd)
    deadline = time.monotonic() + timeout
    while not ch.exit_status_ready():
        if time.monotonic() > deadline:
            print("[TIMEOUT]", file=sys.stderr)
            ch.close()
            return -1
        if ch.recv_ready():
            print(ch.recv(4096).decode(errors="replace"), end="", flush=True)
        time.sleep(0.2)
    while ch.recv_ready():
        print(ch.recv(4096).decode(errors="replace"), end="", flush=True)
    rc = ch.recv_exit_status()
    print(f"\n[exit {rc}]")
    return rc


def main() -> None:
    print(f"=== Connecting to {HOST}:{PORT} as {USER} ===")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
    sftp = client.open_sftp()
    print("Connected.\n")

    # ── 1. Upload files ────────────────────────────────────────────────────────
    print("=== Uploading files ===")
    for local, remote in TRANSFERS:
        local_path = Path(local)
        if not local_path.exists():
            print(f"  [MISSING] {local_path}")
            sys.exit(1)
        print(f"  {local_path.name} -> {remote}")
        sftp.put(str(local_path), remote)
        print("  OK")
    sftp.close()

    # ── 2. Build + restart ────────────────────────────────────────────────────
    results: list[tuple[str, int]] = []
    for label, cmd, timeout in BUILD_COMMANDS:
        rc = run_ssh(client, label, cmd, timeout)
        results.append((label, rc))

    client.close()

    # ── 3. Summary ─────────────────────────────────────────────────────────────
    print(f"\n{'='*60}\n  SUMMARY\n{'='*60}")
    ok = True
    for label, rc in results:
        status = "OK" if rc == 0 else f"FAILED ({rc})"
        print(f"  [{status:>12}]  {label}")
        if rc != 0:
            ok = False

    if not ok:
        print("\nOne or more steps FAILED — check output above.", file=sys.stderr)
        sys.exit(1)

    print("\nDeploy complete. Run smoke tests next.")


if __name__ == "__main__":
    main()
