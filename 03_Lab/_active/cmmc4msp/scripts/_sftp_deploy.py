"""
SFTP deploy script — uploads 3 files to VM 10.10.110.41 and triggers docker rebuild.
Uses paramiko only (no scp / ssh CLI).
"""

import sys
import time
import paramiko

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASS = "Poll0000"

TRANSFERS = [
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\app\[orgSlug]\artifacts\page.tsx",
        "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/artifacts/page.tsx",
    ),
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\app\[orgSlug]\integrations\page.tsx",
        "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/integrations/page.tsx",
    ),
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\graphql\queries.ts",
        "/opt/stacks/cmmc4msp/nextjs/src/graphql/queries.ts",
    ),
]

# Remote directories that must exist before upload
REMOTE_DIRS = [
    "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/artifacts",
    "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/integrations",
    "/opt/stacks/cmmc4msp/nextjs/src/graphql",
]

DOCKER_CMD = "cd /opt/stacks/cmmc4msp && docker compose build nextjs && docker compose up -d nextjs"


def sftp_mkdir_p(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    """Create remote directory and all parents (like mkdir -p)."""
    parts = remote_dir.rstrip("/").split("/")
    path = ""
    for part in parts:
        if not part:
            path = "/"
            continue
        path = f"{path}/{part}" if path != "/" else f"/{part}"
        try:
            sftp.stat(path)
        except FileNotFoundError:
            print(f"  mkdir {path}")
            sftp.mkdir(path)


def main() -> int:
    print(f"=== Connecting to {HOST}:{PORT} as {USER} ===")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(HOST, port=PORT, username=USER, password=PASS, timeout=30)
    print("SSH connected.")

    # --- SFTP uploads ---
    print("\n=== Opening SFTP session ===")
    sftp = ssh.open_sftp()

    for remote_dir in REMOTE_DIRS:
        sftp_mkdir_p(sftp, remote_dir)

    for local_path, remote_path in TRANSFERS:
        print(f"\nUploading:\n  local : {local_path}\n  remote: {remote_path}")
        sftp.put(local_path, remote_path)
        print("  OK")

    sftp.close()
    print("\n=== SFTP transfers complete ===")

    # --- Docker rebuild ---
    print(f"\n=== Running docker compose build + up ===")
    print(f"Command: {DOCKER_CMD}\n")

    stdin, stdout, stderr = ssh.exec_command(DOCKER_CMD, get_pty=True, timeout=600)
    stdin.close()

    # Stream stdout in real time
    for line in iter(stdout.readline, ""):
        sys.stdout.write(line)
        sys.stdout.flush()

    exit_code = stdout.channel.recv_exit_status()
    err_output = stderr.read().decode(errors="replace").strip()
    if err_output:
        print("\n--- stderr ---")
        print(err_output)

    ssh.close()

    if exit_code == 0:
        print(f"\n=== Docker rebuild succeeded (exit 0) ===")
        return 0
    else:
        print(f"\n=== Docker rebuild FAILED (exit {exit_code}) ===")
        return exit_code


if __name__ == "__main__":
    sys.exit(main())
