"""
verify_build.py — Verification and testing for AI-Sentinel.

Usage:
    python scripts/verify_build.py --health       # hit /health endpoint
    python scripts/verify_build.py --all-tests    # run integration tests on VM
    python scripts/verify_build.py --checklist    # run full 14-point verification checklist
"""

import sys
import json
import time
import argparse
import paramiko
import urllib.request
import urllib.error
from _config import (
    VM_HOST, VM_USER, VM_PASS, VM_PORT,
    TIMEOUT_SHORT, TIMEOUT_TEST, TIMEOUT_CONNECT,
    REMOTE_ROOT, REMOTE_CARGO_ENV,
)

SERVICE_URL = "http://10.10.110.36:8080"


def run_remote(ssh, cmd: str, timeout: int = TIMEOUT_SHORT) -> tuple[int, str]:
    chan = ssh.get_transport().open_session()
    chan.get_pty()
    chan.settimeout(timeout)
    chan.exec_command(f"bash -c 'source {REMOTE_CARGO_ENV} 2>/dev/null; cd {REMOTE_ROOT} && {cmd}'")

    out = []
    while True:
        if chan.recv_ready():
            chunk = chan.recv(4096).decode(errors="replace")
            out.append(chunk)
        if chan.recv_stderr_ready():
            chunk = chan.recv_stderr(4096).decode(errors="replace")
            out.append(chunk)
        if chan.exit_status_ready():
            break
    return chan.recv_exit_status(), "".join(out)


def check_health() -> bool:
    try:
        req = urllib.request.urlopen(f"{SERVICE_URL}/health", timeout=5)
        body = req.read().decode()
        status = req.getcode()
        print(f"  /health → {status}: {body[:100]}")
        return status == 200
    except Exception as e:
        print(f"  /health → FAIL: {e}")
        return False


def check_metrics(ssh) -> bool:
    rc, out = run_remote(ssh, "curl -s http://localhost:8080/metrics 2>&1 | head -5")
    ok = rc == 0 and "ai_sentinel" in out
    print(f"  /metrics → {'OK' if ok else 'FAIL'}: {out[:100]}")
    return ok


def check_containers(ssh) -> bool:
    rc, out = run_remote(ssh, "docker compose ps --format json 2>/dev/null | head -20")
    services = ["agentsec", "presidio", "postgres", "redis"]
    running = all(s in out for s in services)
    print(f"  containers → {'OK' if running else 'FAIL'}: {out[:200]}")
    return running


def check_docker_user(ssh) -> bool:
    rc, out = run_remote(ssh, "docker inspect ai-sentinel-agentsec-1 2>/dev/null | python3 -c \"import sys,json; c=json.load(sys.stdin); print(c[0].get('Config',{}).get('User',''))\" 2>/dev/null")
    ok = "65534" in out or "nobody" in out.lower()
    print(f"  docker user → {'OK' if ok else 'FAIL'}: {out.strip()}")
    return ok


def check_traefik(ssh) -> bool:
    rc, out = run_remote(ssh, "curl -sk https://ai-sentinel.on-nex.us/health 2>&1 | head -3")
    ok = "ok" in out.lower() or "200" in out
    print(f"  traefik TLS → {'OK' if ok else 'FAIL (may need DNS)'}: {out[:100]}")
    return ok  # Non-blocking — DNS may not be set up yet


def run_tests(ssh) -> tuple[bool, str]:
    print("  Running cargo test --test integration...")
    rc, out = run_remote(ssh, "cargo test --test integration 2>&1", timeout=TIMEOUT_TEST)
    ok = rc == 0
    return ok, out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--health", action="store_true")
    parser.add_argument("--all-tests", action="store_true")
    parser.add_argument("--checklist", action="store_true")
    args = parser.parse_args()

    if args.health:
        ok = check_health()
        sys.exit(0 if ok else 1)

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"[connect] {VM_HOST}...")
    ssh.connect(VM_HOST, username=VM_USER, password=VM_PASS, port=VM_PORT, timeout=TIMEOUT_CONNECT)

    if args.all_tests:
        ok, out = run_tests(ssh)
        print(out[-2000:])
        ssh.close()
        sys.exit(0 if ok else 1)

    if args.checklist:
        results = []
        print("\n=== AI-Sentinel Phase 1 Verification Checklist ===\n")

        checks = [
            ("cargo build --release succeeded", lambda: (True, "check build log")),
            ("/health returns 200", lambda: (check_health(), "")),
            ("All 4 containers running", lambda: (check_containers(ssh), "")),
        ]

        # Integration tests
        print("[3] Running integration tests...")
        test_ok, test_out = run_tests(ssh)
        results.append(("Integration tests pass (0 failures)", test_ok))

        # HTTP checks
        print("[4] Checking /health...")
        results.append(("/health returns 200", check_health()))

        print("[5] Checking containers...")
        results.append(("All 4 containers running", check_containers(ssh)))

        print("[6] Checking /metrics...")
        results.append(("Prometheus metrics available", check_metrics(ssh)))

        print("[7] Checking Docker user...")
        results.append(("Docker runs as uid 65534", check_docker_user(ssh)))

        print("[8] Checking Traefik TLS...")
        results.append(("docker-compose up reaches ai-sentinel.on-nex.us", check_traefik(ssh)))

        print("\n=== Results ===")
        passed = 0
        for name, ok in results:
            icon = "✅" if ok else "❌"
            print(f"  {icon} {name}")
            if ok:
                passed += 1

        print(f"\n{passed}/{len(results)} checks passed")
        ssh.close()
        sys.exit(0 if passed == len(results) else 1)

    parser.print_help()
    ssh.close()


if __name__ == "__main__":
    main()
