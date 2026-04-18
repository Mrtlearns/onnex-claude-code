"""
Deploy docker-compose.yml with log rotation config to VM and restart services.
Steps:
1. SFTP docker-compose.yml to /opt/stacks/cmmc4msp/docker-compose.yml
2. SSH: docker compose up -d (picks up logging config without rebuilding)
3. Verify: docker inspect cmmc-fastapi log config
"""
import os
import sys
import paramiko

HOST = "10.10.110.41"
USER = "mrt"
PASSWORD = "Poll0000"
REMOTE_BASE = "/opt/stacks/cmmc4msp"

LOCAL_BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOCAL_COMPOSE = os.path.join(LOCAL_BASE, "docker-compose.yml")
REMOTE_COMPOSE = f"{REMOTE_BASE}/docker-compose.yml"


def run_ssh(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    """Run command via SSH, return (exit_code, stdout, stderr)."""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    stdin.close()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    return exit_code, out, err


def main() -> int:
    print("=== Deploy Log Rotation ===")
    print(f"  Local:  {LOCAL_COMPOSE}")
    print(f"  Remote: {REMOTE_COMPOSE}")
    print()

    if not os.path.exists(LOCAL_COMPOSE):
        print(f"ERROR: Local file not found: {LOCAL_COMPOSE}")
        return 1

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {USER}@{HOST} ...")
    ssh.connect(HOST, username=USER, password=PASSWORD)
    print("Connected.")

    # --- Step 1: SFTP docker-compose.yml ---
    print("\n[1/3] Uploading docker-compose.yml via SFTP ...")
    sftp = ssh.open_sftp()
    sftp.put(LOCAL_COMPOSE, REMOTE_COMPOSE)
    sftp.close()
    print("  OK: docker-compose.yml uploaded.")

    # --- Step 2: docker compose up -d ---
    print("\n[2/3] Running docker compose up -d ...")
    cmd = f"cd {REMOTE_BASE} && docker compose up -d 2>&1"
    rc, out, err = run_ssh(ssh, cmd, timeout=180)
    combined = out + err
    for line in combined.strip().splitlines():
        print(f"  {line}")
    if rc != 0:
        print(f"\nERROR: docker compose up -d exited with code {rc}")
        ssh.close()
        return 1
    print("  OK: docker compose up -d complete.")

    # --- Step 3: Verify log config on cmmc-fastapi ---
    print("\n[3/3] Verifying log config on cmmc-fastapi ...")
    verify_cmd = "docker inspect cmmc-fastapi --format '{{json .HostConfig.LogConfig}}'"
    rc2, out2, err2 = run_ssh(ssh, verify_cmd)
    log_config = (out2 + err2).strip()
    print(f"  LogConfig: {log_config}")

    if "json-file" in log_config and "20m" in log_config:
        print("  OK: Log rotation confirmed on cmmc-fastapi.")
    else:
        print("  WARNING: Log rotation not detected in inspect output.")
        print("  (Container may need full stop/start rather than up -d to pick up logging changes.)")

    ssh.close()
    print("\n=== Deploy complete ===")
    return 0


if __name__ == "__main__":
    sys.exit(main())
