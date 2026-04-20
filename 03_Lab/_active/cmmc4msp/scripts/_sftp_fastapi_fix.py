"""SFTP deploy script — upload FastAPI files to VM and restart container."""
from __future__ import annotations

import sys
import paramiko

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"

TRANSFERS = [
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\fastapi\app\services\copilot_service.py",
        "/opt/stacks/cmmc4msp/fastapi/app/services/copilot_service.py",
    ),
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\fastapi\app\routers\controls.py",
        "/opt/stacks/cmmc4msp/fastapi/app/routers/controls.py",
    ),
]

RESTART_CMD = "cd /opt/stacks/cmmc4msp && docker compose restart fastapi"
PS_CMD = "docker ps | grep fastapi"
LOGS_CMD = "docker logs cmmc-fastapi --tail 20 2>&1"


def run_ssh(client: paramiko.SSHClient, cmd: str) -> tuple[str, str, int]:
    print(f"\n>>> {cmd}")
    _, stdout, stderr = client.exec_command(cmd)
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    if out:
        print(out, end="")
    if err:
        print("[stderr]", err, end="")
    print(f"[exit {rc}]")
    return out, err, rc


def main() -> None:
    print(f"Connecting to {HOST}:{PORT} as {USER} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected.")

    # --- SFTP upload ---
    sftp = client.open_sftp()
    for local_path, remote_path in TRANSFERS:
        print(f"\nUploading:\n  local : {local_path}\n  remote: {remote_path}")
        sftp.put(local_path, remote_path)
        print("  OK")
    sftp.close()
    print("\nAll files uploaded.")

    # --- Restart container ---
    out, err, rc = run_ssh(client, RESTART_CMD)
    if rc != 0:
        print(f"ERROR: restart failed (exit {rc}). Aborting.", file=sys.stderr)
        client.close()
        sys.exit(1)

    # --- Verify running ---
    run_ssh(client, PS_CMD)

    # --- Check logs ---
    run_ssh(client, LOGS_CMD)

    client.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
