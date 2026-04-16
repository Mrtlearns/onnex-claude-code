"""
deploy_build.py — Upload source and run cargo check/build on ai-sentinel-build VM.

Usage:
    python scripts/deploy_build.py              # upload + cargo check
    python scripts/deploy_build.py --release    # upload + cargo build --release
    python scripts/deploy_build.py --check-only # skip upload, cargo check only
    python scripts/deploy_build.py --upload-only # upload without building
"""

import sys
import os
import argparse
import paramiko
import stat
from pathlib import Path
from _config import (
    VM_HOST, VM_USER, VM_PASS, VM_PORT,
    TIMEOUT_SHORT, TIMEOUT_BUILD, TIMEOUT_CONNECT,
    REMOTE_ROOT, REMOTE_CARGO_ENV,
    LOCAL_ROOT, SYNC_DIRS, SYNC_FILES, EXCLUDE_PATTERNS,
)


def should_exclude(path: str) -> bool:
    for pat in EXCLUDE_PATTERNS:
        if pat in path:
            return True
    return False


def sftp_upload_dir(sftp, local_dir: Path, remote_dir: str):
    """Recursively upload a directory via SFTP."""
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        sftp.mkdir(remote_dir)

    for item in local_dir.iterdir():
        if should_exclude(item.name):
            continue
        remote_path = f"{remote_dir}/{item.name}"
        if item.is_dir():
            sftp_upload_dir(sftp, item, remote_path)
        else:
            print(f"  -> {remote_path}")
            sftp.put(str(item), remote_path)


def upload_sources(sftp):
    print(f"[upload] Syncing source to {REMOTE_ROOT}...")
    local = Path(LOCAL_ROOT)

    # Upload sync dirs
    for d in SYNC_DIRS:
        local_path = local / d
        if local_path.exists():
            sftp_upload_dir(sftp, local_path, f"{REMOTE_ROOT}/{d}")
        else:
            print(f"  [skip] {d} (not found locally)")

    # Upload top-level files
    for f in SYNC_FILES:
        local_path = local / f
        if local_path.exists():
            remote_path = f"{REMOTE_ROOT}/{f}"
            print(f"  -> {remote_path}")
            sftp.put(str(local_path), remote_path)


def run_remote(ssh, cmd: str, timeout: int = TIMEOUT_SHORT, stream: bool = True) -> int:
    """Run a command with PTY, streaming output. Returns exit code."""
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.settimeout(timeout)
    chan.exec_command(f"bash -c 'source {REMOTE_CARGO_ENV} 2>/dev/null; cd {REMOTE_ROOT} && {cmd}'")

    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096).decode(errors="replace")
            if stream:
                print(chunk, end="", flush=True)
        if chan.recv_stderr_ready():
            chunk = chan.recv_stderr(4096).decode(errors="replace")
            if stream:
                print(chunk, end="", flush=True)
        if chan.exit_status_ready():
            break

    # Drain remaining output
    while chan.recv_ready():
        print(chan.recv(4096).decode(errors="replace"), end="", flush=True)
    while chan.recv_stderr_ready():
        print(chan.recv_stderr(4096).decode(errors="replace"), end="", flush=True)

    return chan.recv_exit_status()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", action="store_true", help="Run cargo build --release")
    parser.add_argument("--check-only", action="store_true", help="Only run cargo check (no upload)")
    parser.add_argument("--upload-only", action="store_true", help="Only upload (no build)")
    args = parser.parse_args()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[connect] Connecting to {VM_HOST}...")
    ssh.connect(VM_HOST, username=VM_USER, password=VM_PASS, port=VM_PORT, timeout=TIMEOUT_CONNECT)
    print("[connect] OK")

    if not args.check_only:
        sftp = ssh.open_sftp()
        upload_sources(sftp)
        sftp.close()
        print("[upload] Done")

    if args.upload_only:
        ssh.close()
        print("[done] Upload complete.")
        return

    if args.release:
        print("\n[build] Running: cargo build --release")
        rc = run_remote(ssh, "cargo build --release 2>&1", timeout=TIMEOUT_BUILD)
    else:
        print("\n[check] Running: cargo check")
        rc = run_remote(ssh, "cargo check 2>&1", timeout=TIMEOUT_BUILD)

    ssh.close()

    if rc != 0:
        print(f"\n[FAIL] Build exited with code {rc}")
        sys.exit(rc)
    else:
        print(f"\n[OK] Build succeeded")


if __name__ == "__main__":
    main()
