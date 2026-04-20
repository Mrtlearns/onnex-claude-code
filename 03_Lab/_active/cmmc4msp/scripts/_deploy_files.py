"""
One-shot deploy: SFTP 5 changed files to the cmmc4msp VM, patch .env,
restart FastAPI, rebuild + restart Next.js, verify container status.
"""
from __future__ import annotations

import sys
import time

sys.path.insert(0, "D:/Code/Claude/03_Lab/_active/cmmc4msp/scripts")
from _secrets import vm_ssh

import paramiko

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
LOCAL_BASE = "D:/Code/Claude/03_Lab/_active/cmmc4msp"
REMOTE_BASE = "/opt/cmmc4msp"

FILES = [
    ("fastapi/app/config.py",                  "fastapi/app/config.py"),
    ("fastapi/app/services/minio_service.py",   "fastapi/app/services/minio_service.py"),
    ("fastapi/app/services/report_service.py",  "fastapi/app/services/report_service.py"),
    ("fastapi/app/routers/reports.py",           "fastapi/app/routers/reports.py"),
    ("nextjs/src/app/[orgSlug]/suggestions/page.tsx",
     "nextjs/src/app/[orgSlug]/suggestions/page.tsx"),
]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def run(ssh: paramiko.SSHClient, cmd: str, password: str) -> tuple[int, str, str]:
    """Run a command via sudo -S, return (exit_code, stdout, stderr)."""
    full = f"echo {password} | sudo -S bash -c '{cmd}'"
    _, stdout, stderr = ssh.exec_command(full, timeout=180)
    exit_code = stdout.channel.recv_exit_status()
    return exit_code, stdout.read().decode(), stderr.read().decode()


def banner(msg: str) -> None:
    print(f"\n{'='*60}\n  {msg}\n{'='*60}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    host, user, password = vm_ssh()
    print(f"[INFO] Connecting to {user}@{host} …")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=user, password=password, timeout=15)
    print("[OK]   SSH connected.")

    # ------------------------------------------------------------------
    # Step 1 — SFTP upload
    # ------------------------------------------------------------------
    banner("Step 1 — SFTP upload (5 files)")
    sftp = ssh.open_sftp()

    for local_rel, remote_rel in FILES:
        local_path  = f"{LOCAL_BASE}/{local_rel}"
        remote_path = f"{REMOTE_BASE}/{remote_rel}"

        # Ensure remote directory exists
        remote_dir = remote_path.rsplit("/", 1)[0]
        try:
            sftp.stat(remote_dir)
        except FileNotFoundError:
            # mkdir -p via SSH
            rc, out, err = run(ssh, f"mkdir -p {remote_dir}", password)
            if rc != 0:
                print(f"  [WARN] mkdir -p {remote_dir}: {err.strip()}")

        sftp.put(local_path, remote_path)
        print(f"  [OK]  {local_rel}  →  {remote_path}")

    sftp.close()

    # ------------------------------------------------------------------
    # Step 2 — Add API_URL to .env if absent
    # ------------------------------------------------------------------
    banner("Step 2 — Patch .env (API_URL)")
    env_cmd = r"grep -q '^API_URL=' /opt/cmmc4msp/.env || echo 'API_URL=https://api.cmmc4msp.on-nex.us' >> /opt/cmmc4msp/.env"
    rc, out, err = run(ssh, env_cmd, password)
    if rc == 0:
        print("  [OK]  API_URL present or appended.")
    else:
        print(f"  [WARN] .env patch exit={rc}  stderr={err.strip()}")

    # ------------------------------------------------------------------
    # Step 3 — Restart FastAPI
    # ------------------------------------------------------------------
    banner("Step 3 — Restart FastAPI container")
    rc, out, err = run(ssh, "cd /opt/cmmc4msp && docker compose restart fastapi", password)
    print(f"  exit={rc}")
    if out.strip():
        print(f"  stdout: {out.strip()}")
    if err.strip():
        # docker compose writes normal output to stderr
        print(f"  stderr: {err.strip()}")
    if rc != 0:
        print("  [ERROR] FastAPI restart failed.")
    else:
        print("  [OK]  FastAPI restarted.")

    # ------------------------------------------------------------------
    # Step 4 — Rebuild + restart Next.js
    # ------------------------------------------------------------------
    banner("Step 4 — Rebuild Next.js (tail last 10 lines) + up -d")
    rc_build, out_build, err_build = run(
        ssh,
        "cd /opt/cmmc4msp && docker compose build nextjs 2>&1 | tail -10",
        password,
    )
    combined = (out_build + err_build).strip()
    print(f"  build exit={rc_build}")
    for line in combined.splitlines():
        print(f"    {line}")

    rc_up, out_up, err_up = run(
        ssh,
        "cd /opt/cmmc4msp && docker compose up -d nextjs",
        password,
    )
    print(f"  up -d exit={rc_up}")
    combined_up = (out_up + err_up).strip()
    for line in combined_up.splitlines():
        print(f"    {line}")

    if rc_build != 0 or rc_up != 0:
        print("  [ERROR] Next.js rebuild/restart had errors.")
    else:
        print("  [OK]  Next.js rebuilt and started.")

    # ------------------------------------------------------------------
    # Step 5 — Wait 10 s then check container status
    # ------------------------------------------------------------------
    banner("Step 5 — Container status (after 10 s)")
    print("  Waiting 10 seconds …")
    time.sleep(10)

    rc, out, err = run(
        ssh,
        (
            "docker ps --filter name=fastapi --format '{{.Names}} | {{.Status}}' ; "
            "docker ps --filter name=nextjs  --format '{{.Names}} | {{.Status}}'"
        ),
        password,
    )
    lines = (out + err).strip().splitlines()
    if lines:
        for line in lines:
            print(f"  {line}")
    else:
        print("  [WARN] No output from docker ps — containers may not be running.")

    ssh.close()
    print("\n[DONE] Deploy script finished.")


if __name__ == "__main__":
    main()
