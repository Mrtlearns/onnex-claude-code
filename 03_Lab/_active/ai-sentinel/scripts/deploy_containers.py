"""
deploy_containers.py — Docker Compose management on ai-sentinel-build VM.

Usage:
    python scripts/deploy_containers.py --up
    python scripts/deploy_containers.py --up --build
    python scripts/deploy_containers.py --status
    python scripts/deploy_containers.py --logs
    python scripts/deploy_containers.py --restart <service>

Commands requiring explicit approval (not auto-run):
    --down
"""

import sys
import argparse
import paramiko
from _config import (
    VM_HOST, VM_USER, VM_PASS, VM_PORT,
    TIMEOUT_SHORT, TIMEOUT_BUILD, TIMEOUT_CONNECT,
    REMOTE_ROOT,
)


def run_remote(ssh, cmd: str, timeout: int = TIMEOUT_SHORT) -> tuple[int, str]:
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.settimeout(timeout)
    chan.exec_command(f"bash -c 'cd {REMOTE_ROOT} && {cmd}'")

    out = []
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096).decode(errors="replace")
            print(chunk, end="", flush=True)
            out.append(chunk)
        if chan.recv_stderr_ready():
            chunk = chan.recv_stderr(4096).decode(errors="replace")
            print(chunk, end="", flush=True)
            out.append(chunk)
        if chan.exit_status_ready():
            break

    while chan.recv_ready():
        chunk = chan.recv(4096).decode(errors="replace")
        print(chunk, end="", flush=True)
        out.append(chunk)

    return chan.recv_exit_status(), "".join(out)


def get_status(ssh) -> None:
    print("\n[status] Container status:")
    rc, _ = run_remote(ssh, "docker compose ps 2>&1")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--up", action="store_true")
    parser.add_argument("--down", action="store_true")
    parser.add_argument("--build", action="store_true", help="Use with --up to rebuild")
    parser.add_argument("--status", action="store_true")
    parser.add_argument("--logs", action="store_true")
    parser.add_argument("--restart", metavar="SERVICE")
    args = parser.parse_args()

    if args.down:
        print("[WARN] --down requires explicit human approval. Exiting.")
        sys.exit(1)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[connect] Connecting to {VM_HOST}...")
    ssh.connect(VM_HOST, username=VM_USER, password=VM_PASS, port=VM_PORT, timeout=TIMEOUT_CONNECT)
    print("[connect] OK")

    if args.up:
        cmd = "docker compose up -d --remove-orphans"
        if args.build:
            cmd = "docker compose up -d --build --remove-orphans"
        print(f"\n[up] Running: {cmd}")
        rc, _ = run_remote(ssh, f"{cmd} 2>&1", timeout=TIMEOUT_BUILD)
        if rc == 0:
            get_status(ssh)
        else:
            print(f"\n[FAIL] docker compose up failed (rc={rc})")
            sys.exit(rc)

    elif args.status:
        get_status(ssh)

    elif args.logs:
        print("\n[logs] Tailing logs (Ctrl+C to stop):")
        run_remote(ssh, "docker compose logs --tail=50 -f 2>&1", timeout=300)

    elif args.restart:
        print(f"\n[restart] Restarting {args.restart}...")
        rc, _ = run_remote(ssh, f"docker compose restart {args.restart} 2>&1")
        if rc == 0:
            get_status(ssh)

    else:
        parser.print_help()

    ssh.close()


if __name__ == "__main__":
    main()
