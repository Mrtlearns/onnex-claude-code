"""Deploy auth fix: upload deps.py + controls.py to VM, rebuild fastapi container.

Usage:
    python scripts/_deploy_auth_fix.py

Requires: paramiko
    pip install paramiko
"""

import io
import sys
import time
import paramiko

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
VM_HOST = "10.10.110.41"
VM_PORT = 22
VM_USER = "mrt"
VM_PASS = "Poll0000"

LOCAL_DEPS     = r"D:\Code\Claude\03_Lab\_active\cmmc4msp\fastapi\app\deps.py"
LOCAL_CONTROLS = r"D:\Code\Claude\03_Lab\_active\cmmc4msp\fastapi\app\routers\controls.py"

REMOTE_DEPS     = "/opt/stacks/cmmc4msp/fastapi/app/deps.py"
REMOTE_CONTROLS = "/opt/stacks/cmmc4msp/fastapi/app/routers/controls.py"

COMPOSE_DIR = "/opt/stacks/cmmc4msp"

BUILD_CMD = (
    f"cd {COMPOSE_DIR} && "
    "docker compose build fastapi 2>&1 && "
    "docker compose up -d fastapi 2>&1"
)
VERIFY_CMD  = "docker ps | grep fastapi"
LOGS_CMD    = "docker logs cmmc-fastapi --tail 10 2>&1"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _banner(msg: str) -> None:
    print(f"\n{'=' * 60}")
    print(f"  {msg}")
    print(f"{'=' * 60}")


def _run(client: paramiko.SSHClient, cmd: str, timeout: int = 300) -> tuple[int, str, str]:
    """Execute a command and stream stdout/stderr to the terminal.

    Returns (exit_code, stdout, stderr).
    """
    print(f"\n$ {cmd}\n")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdin.close()

    out_lines: list[str] = []
    err_lines: list[str] = []

    # Stream stdout in real time
    for line in iter(stdout.readline, ""):
        print(line, end="")
        out_lines.append(line)

    # Drain stderr
    for line in stderr:
        print(f"[stderr] {line}", end="")
        err_lines.append(line)

    exit_code = stdout.channel.recv_exit_status()
    return exit_code, "".join(out_lines), "".join(err_lines)


def _upload(sftp: paramiko.SFTPClient, local_path: str, remote_path: str) -> None:
    print(f"  Uploading {local_path}")
    print(f"       -> {remote_path}")
    sftp.put(local_path, remote_path)
    print("  Done.")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    _banner("Connecting to VM")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VM_HOST, port=VM_PORT, username=VM_USER, password=VM_PASS, timeout=15)
    print(f"Connected to {VM_USER}@{VM_HOST}")

    # --- Upload files -------------------------------------------------------
    _banner("Uploading files via SFTP")
    with client.open_sftp() as sftp:
        _upload(sftp, LOCAL_DEPS, REMOTE_DEPS)
        _upload(sftp, LOCAL_CONTROLS, REMOTE_CONTROLS)

    # --- Build + start container --------------------------------------------
    _banner("Building fastapi container (docker compose build + up)")
    print("NOTE: This may take 1-3 minutes — streaming output below.\n")
    rc, out, err = _run(client, BUILD_CMD, timeout=300)
    if rc != 0:
        print(f"\n[ERROR] Build/up command exited with code {rc}")
        # Don't abort — still run verification so we can see the state

    # --- Verify container is running ----------------------------------------
    _banner("Verifying container status")
    rc_ps, out_ps, _ = _run(client, VERIFY_CMD, timeout=15)
    if not out_ps.strip():
        print("[WARNING] fastapi container not found in docker ps — may still be starting.")
    else:
        print("\nContainer is UP:")
        print(out_ps)

    # --- Check logs ---------------------------------------------------------
    _banner("Container startup logs (last 10 lines)")
    _run(client, LOGS_CMD, timeout=15)

    client.close()

    _banner("Deploy complete")
    print("Files uploaded, container rebuilt and started.")
    print("Review logs above for any startup errors.\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
