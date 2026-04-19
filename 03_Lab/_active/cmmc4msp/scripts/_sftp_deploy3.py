"""
_sftp_deploy3.py — Upload 3 Next.js source files to VM and rebuild nextjs Docker container.

Usage: python scripts/_sftp_deploy3.py
"""

import paramiko
import sys
import time
import io

HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"

# (local_path, remote_path)
FILES = [
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\app\[orgSlug]\controls\[id]\page.tsx",
        "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/controls/[id]/page.tsx",
    ),
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\graphql\queries.ts",
        "/opt/stacks/cmmc4msp/nextjs/src/graphql/queries.ts",
    ),
    (
        r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\app\[orgSlug]\team\page.tsx",
        "/opt/stacks/cmmc4msp/nextjs/src/app/[orgSlug]/team/page.tsx",
    ),
]

BUILD_COMMAND = (
    "cd /opt/stacks/cmmc4msp && "
    "docker compose build nextjs 2>&1 && "
    "docker compose up -d nextjs 2>&1"
)


def log(msg: str) -> None:
    # Safe print — replace characters that can't be encoded on the current terminal
    safe = msg.encode(sys.stdout.encoding or "utf-8", errors="replace").decode(
        sys.stdout.encoding or "utf-8", errors="replace"
    )
    print(safe, flush=True)


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    """Recursively ensure the remote directory exists."""
    parts = remote_path.split("/")
    current = ""
    for part in parts:
        if not part:
            current = "/"
            continue
        current = current.rstrip("/") + "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            try:
                sftp.mkdir(current)
                log(f"  [mkdir] {current}")
            except Exception:
                pass  # may already exist via race or be a file


def main() -> int:
    log(f"Connecting to {USER}@{HOST}:{PORT} ...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
        log("Connected.\n")
    except Exception as exc:
        log(f"ERROR: SSH connection failed — {exc}")
        return 1

    # --- SFTP upload ---
    try:
        sftp = client.open_sftp()
        log("=== SFTP Upload ===")
        for local, remote in FILES:
            remote_dir = "/".join(remote.split("/")[:-1])
            ensure_remote_dir(sftp, remote_dir)
            log(f"  Uploading: {local}")
            log(f"        to: {remote}")
            sftp.put(local, remote)
            log(f"  OK\n")
        sftp.close()
        log("All files uploaded successfully.\n")
    except Exception as exc:
        log(f"ERROR: SFTP upload failed — {exc}")
        client.close()
        return 1

    # --- Docker rebuild ---
    log("=== Docker Build ===")
    log(f"Running: {BUILD_COMMAND}\n")

    try:
        stdin, stdout, stderr = client.exec_command(BUILD_COMMAND, timeout=600)
        stdin.close()

        # Stream stdout in real time — decode with replacement to survive emoji/special chars
        for raw_line in stdout:
            line = raw_line if isinstance(raw_line, str) else raw_line.decode("utf-8", errors="replace")
            log(line.rstrip("\n"))

        exit_code = stdout.channel.recv_exit_status()
        # Print any remaining stderr
        err_output = stderr.read().decode("utf-8", errors="replace").strip()
        if err_output:
            log(f"\n[stderr]\n{err_output}")

        log(f"\n=== Build exit code: {exit_code} ===")
        if exit_code == 0:
            log("Docker build and up completed successfully.")
        else:
            log("ERROR: Docker build/up returned non-zero exit code.")
            return exit_code
    except Exception as exc:
        log(f"ERROR: Remote command failed — {exc}")
        client.close()
        return 1

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
