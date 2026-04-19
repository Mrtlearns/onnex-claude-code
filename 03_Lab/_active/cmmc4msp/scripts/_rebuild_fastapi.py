"""Rebuild and restart the FastAPI container on the cmmc4msp VM.

Tasks performed (in order):
  1. Print lines 315-325 of controls.py on the VM (version check)
  2. Query Authentik sub claim for Meridian user (pk=9 debug)
  3. docker compose build fastapi && docker compose up -d fastapi
  4. Print last 20 log lines to confirm clean startup
"""
from __future__ import annotations

import sys
import time
import paramiko

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"

STACK_DIR = "/opt/stacks/cmmc4msp"

COMMANDS: list[tuple[str, str]] = [
    (
        "Task 1 — controls.py lines 315-325 (version check)",
        "sed -n '315,325p' /opt/stacks/cmmc4msp/fastapi/app/routers/controls.py",
    ),
    (
        "Task 2 — Meridian user sub claim (Authentik pk=9)",
        (
            'docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main '
            '-c "SELECT id, email FROM users WHERE email LIKE \'%meridian%\' LIMIT 5;"'
        ),
    ),
    (
        "Task 3 — Build FastAPI image",
        f"cd {STACK_DIR} && docker compose build fastapi 2>&1",
    ),
    (
        "Task 3 — Start FastAPI container",
        f"cd {STACK_DIR} && docker compose up -d fastapi 2>&1",
    ),
    (
        "Task 4 — Last 20 log lines",
        "docker logs cmmc-fastapi --tail 20 2>&1",
    ),
]


def run_ssh(
    client: paramiko.SSHClient,
    label: str,
    cmd: str,
    timeout: int = 180,
) -> tuple[str, str, int]:
    """Execute cmd over SSH, stream output, return (stdout, stderr, exit_code)."""
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")
    print(f">>> {cmd}\n")

    transport = client.get_transport()
    assert transport is not None
    channel = transport.open_session()
    channel.set_combine_stderr(False)
    channel.exec_command(cmd)

    stdout_buf: list[str] = []
    stderr_buf: list[str] = []

    deadline = time.monotonic() + timeout
    while not channel.exit_status_ready():
        if time.monotonic() > deadline:
            print("[TIMEOUT] Command exceeded timeout — channel closed.", file=sys.stderr)
            channel.close()
            return "".join(stdout_buf), "".join(stderr_buf), -1

        # Drain stdout
        if channel.recv_ready():
            chunk = channel.recv(4096).decode(errors="replace")
            print(chunk, end="", flush=True)
            stdout_buf.append(chunk)

        # Drain stderr
        if channel.recv_stderr_ready():
            chunk = channel.recv_stderr(4096).decode(errors="replace")
            print("[stderr]", chunk, end="", flush=True)
            stderr_buf.append(chunk)

        time.sleep(0.2)

    # Drain any remaining data
    while channel.recv_ready():
        chunk = channel.recv(4096).decode(errors="replace")
        print(chunk, end="", flush=True)
        stdout_buf.append(chunk)
    while channel.recv_stderr_ready():
        chunk = channel.recv_stderr(4096).decode(errors="replace")
        print("[stderr]", chunk, end="", flush=True)
        stderr_buf.append(chunk)

    rc = channel.recv_exit_status()
    print(f"\n[exit {rc}]")
    return "".join(stdout_buf), "".join(stderr_buf), rc


def main() -> None:
    print(f"Connecting to {HOST}:{PORT} as {USER} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=20)
    print("Connected.\n")

    results: list[tuple[str, int]] = []

    for label, cmd in COMMANDS:
        # Build step can take 2+ minutes — give it 300 s
        timeout = 300 if "build" in label.lower() else 60
        out, err, rc = run_ssh(client, label, cmd, timeout=timeout)
        results.append((label, rc))

    client.close()

    # Summary
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    all_ok = True
    for label, rc in results:
        status = "OK" if rc == 0 else f"FAILED (exit {rc})"
        if rc != 0:
            all_ok = False
        print(f"  [{status:>12}]  {label}")

    if not all_ok:
        print("\nOne or more steps failed. Review output above.", file=sys.stderr)
        sys.exit(1)

    print("\nAll tasks completed successfully.")


if __name__ == "__main__":
    main()
