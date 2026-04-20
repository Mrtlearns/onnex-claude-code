"""
Deploy report_service.py to the cmmc4msp FastAPI container on VM 10.10.110.41.

Steps:
  1. SCP report_service.py to remote path
  2. docker compose build fastapi
  3. docker compose up -d fastapi
  4. Verify container is running (docker ps)
  5. Tail container logs (docker logs --tail 10)

Usage:
    python scripts/_deploy_reports.py
"""

from __future__ import annotations

import io
import os
import sys
import time
import textwrap

import paramiko

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"

LOCAL_FILE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "fastapi",
    "app",
    "services",
    "report_service.py",
)
REMOTE_FILE = "/opt/stacks/cmmc4msp/fastapi/app/services/report_service.py"
REMOTE_WORKDIR = "/opt/stacks/cmmc4msp"

BUILD_CMD = "docker compose build fastapi 2>&1"
UP_CMD = "docker compose up -d fastapi 2>&1"
PS_CMD = "docker ps | grep fastapi 2>&1"
LOGS_CMD = "docker logs cmmc-fastapi --tail 10 2>&1"

TIMEOUT = 300  # seconds — build can be slow


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _run(client: paramiko.SSHClient, cmd: str, workdir: str | None = None) -> tuple[int, str]:
    """Run a command on the remote host and return (exit_code, combined_output)."""
    full_cmd = f"cd {workdir} && {cmd}" if workdir else cmd
    print(f"\n>>> {full_cmd}")
    _, stdout, stderr = client.exec_command(full_cmd, timeout=TIMEOUT)
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        print(textwrap.indent(combined, "    "))
    return rc, combined


def _upload(client: paramiko.SSHClient, local_path: str, remote_path: str) -> None:
    """Upload a single file via SFTP."""
    abs_local = os.path.abspath(local_path)
    print(f"\n>>> SFTP upload: {abs_local} -> {remote_path}")
    with client.open_sftp() as sftp:
        sftp.put(abs_local, remote_path)
    print("    Upload complete.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> int:
    local_abs = os.path.abspath(LOCAL_FILE)
    if not os.path.isfile(local_abs):
        print(f"ERROR: local file not found: {local_abs}", file=sys.stderr)
        return 1

    print(f"Connecting to {USER}@{HOST}:{PORT} …")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected.")

    try:
        # Step 1 — upload file
        _upload(client, local_abs, REMOTE_FILE)

        # Step 2 — build
        print("\n=== docker compose build fastapi ===")
        rc, _ = _run(client, BUILD_CMD, workdir=REMOTE_WORKDIR)
        if rc != 0:
            print(f"ERROR: build failed (exit {rc})", file=sys.stderr)
            return rc

        # Step 3 — up
        print("\n=== docker compose up -d fastapi ===")
        rc, _ = _run(client, UP_CMD, workdir=REMOTE_WORKDIR)
        if rc != 0:
            print(f"ERROR: up failed (exit {rc})", file=sys.stderr)
            return rc

        # Brief pause to let container start
        time.sleep(3)

        # Step 4 — verify
        print("\n=== docker ps | grep fastapi ===")
        rc, ps_out = _run(client, PS_CMD)
        if not ps_out.strip():
            print("WARNING: no fastapi container found in docker ps output", file=sys.stderr)

        # Step 5 — logs
        print("\n=== docker logs cmmc-fastapi --tail 10 ===")
        _run(client, LOGS_CMD)

        print("\nDeployment complete.")
        return 0

    finally:
        client.close()


if __name__ == "__main__":
    sys.exit(main())
