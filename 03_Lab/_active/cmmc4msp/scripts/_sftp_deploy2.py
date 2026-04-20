#!/usr/bin/env python3
"""
_sftp_deploy2.py -- Upload 8 changed Next.js files to VM and rebuild nextjs container.

Target: 10.10.110.41 (mrt@)
Remote base: /opt/stacks/cmmc4msp
"""

import sys
import time
import paramiko

# -- Connection ----------------------------------------------------------------
HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"

REMOTE_BASE = "/opt/stacks/cmmc4msp"

# -- File map: local -> remote -------------------------------------------------
LOCAL_BASE = r"D:\Code\Claude\03_Lab\_active\cmmc4msp"

TRANSFERS = [
    (
        rf"{LOCAL_BASE}\nextjs\src\components\PhaseProgress.tsx",
        f"{REMOTE_BASE}/nextjs/src/components/PhaseProgress.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\components\DomainHeatmap.tsx",
        f"{REMOTE_BASE}/nextjs/src/components/DomainHeatmap.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\app\[orgSlug]\dashboard\page.tsx",
        f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/dashboard/page.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\app\[orgSlug]\controls\page.tsx",
        f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/controls/page.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\app\[orgSlug]\team\page.tsx",
        f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/team/page.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\graphql\queries.ts",
        f"{REMOTE_BASE}/nextjs/src/graphql/queries.ts",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\app\[orgSlug]\artifacts\page.tsx",
        f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/artifacts/page.tsx",
    ),
    (
        rf"{LOCAL_BASE}\nextjs\src\app\[orgSlug]\integrations\page.tsx",
        f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/integrations/page.tsx",
    ),
]

# Directories that may not exist on the remote and must be created
ENSURE_DIRS = [
    f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/artifacts",
    f"{REMOTE_BASE}/nextjs/src/app/[orgSlug]/integrations",
]


def sftp_mkdir_p(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    """Recursively ensure remote_dir exists (like mkdir -p)."""
    parts = remote_dir.split("/")
    path = ""
    for part in parts:
        if not part:
            path = "/"
            continue
        path = f"{path}/{part}" if path != "/" else f"/{part}"
        try:
            sftp.stat(path)
        except FileNotFoundError:
            print(f"  mkdir: {path}")
            sftp.mkdir(path)


def run_ssh_command(
    client: paramiko.SSHClient, command: str, timeout: int = 600
) -> tuple[int, str, str]:
    """Execute a command over SSH, stream stdout, return (exit_code, stdout, stderr)."""
    print(f"\n[SSH] {command}\n" + "-" * 60)
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout, get_pty=True)
    stdin.close()

    out_lines: list[str] = []
    # Stream output line by line; encode to ASCII replacing non-printable chars
    for line in iter(stdout.readline, ""):
        safe = line.encode("ascii", errors="replace").decode("ascii")
        print(safe, end="", flush=True)
        out_lines.append(line)

    exit_code = stdout.channel.recv_exit_status()
    err_data = stderr.read().decode(errors="replace")

    return exit_code, "".join(out_lines), err_data


def main() -> int:
    print(f"Connecting to {USER}@{HOST}:{PORT} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected.\n")

    # -- SFTP uploads ----------------------------------------------------------
    sftp = client.open_sftp()

    # Ensure directories that might not exist
    print("Ensuring remote directories exist ...")
    for d in ENSURE_DIRS:
        sftp_mkdir_p(sftp, d)

    print("\nUploading files ...")
    for local_path, remote_path in TRANSFERS:
        print(f"  {local_path}")
        print(f"    -> {remote_path}")
        try:
            sftp.put(local_path, remote_path)
            print("    OK")
        except Exception as exc:
            print(f"    ERROR: {exc}")
            sftp.close()
            client.close()
            return 1

    sftp.close()
    print(f"\nAll {len(TRANSFERS)} files uploaded successfully.\n")

    # -- Docker rebuild --------------------------------------------------------
    build_cmd = (
        "cd /opt/stacks/cmmc4msp && "
        "docker compose build nextjs && "
        "docker compose up -d nextjs"
    )

    print("Starting docker compose build + up (this takes 3-5 minutes) ...")
    t0 = time.time()
    exit_code, stdout_data, stderr_data = run_ssh_command(client, build_cmd, timeout=600)
    elapsed = time.time() - t0

    print("\n" + "-" * 60)
    print(f"Build finished in {elapsed:.1f}s -- exit code: {exit_code}")

    if stderr_data.strip():
        print(f"\n[STDERR]\n{stderr_data}")

    if exit_code != 0:
        print("ERROR: docker build/up failed.")
        client.close()
        return exit_code

    # -- Verify container running ----------------------------------------------
    verify_cmd = "docker ps | grep nextjs"
    print("\nVerifying container is running ...")
    v_exit, v_out, v_err = run_ssh_command(client, verify_cmd, timeout=30)

    if v_exit != 0 or not v_out.strip():
        print("WARNING: nextjs container not found in docker ps output!")
        client.close()
        return 1

    print("\nnextjs container is UP.")
    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
