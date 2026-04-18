"""Deploy logging + triage workstreams (WS A-E) to the CMMC Compliance OS VM.

Performs:
  1. SFTP upload of FastAPI files -> /opt/stacks/cmmc4msp/
  2. docker cp into cmmc-fastapi container
  3. Gunicorn hot-reload via SIGHUP
  4. SFTP upload of Next.js files
  5. Rebuild + restart cmmc-nextjs container
  6. Re-activate all n8n workflows (01-16) via docker exec CLI
  7. Post-deploy verification smoke tests

Usage:
  python scripts/deploy_fastapi_ws.py

Requires: paramiko
"""
from __future__ import annotations

import json
import sys
import time

import paramiko

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

from _secrets import n8n_api, vm_ssh

VM_HOST, VM_USER, VM_PASS = vm_ssh()
VM_PORT = 22

LOCAL_ROOT = "D:/Code/Claude/03_Lab/_active/cmmc4msp"
REMOTE_ROOT = "/opt/stacks/cmmc4msp"

_N8N_URL, N8N_API_KEY = n8n_api()

# FastAPI files: (local_relative_path, remote_relative_path)
FASTAPI_FILES = [
    ("fastapi/app/logging_config.py",                  "fastapi/app/logging_config.py"),
    ("fastapi/app/middleware/__init__.py",              "fastapi/app/middleware/__init__.py"),
    ("fastapi/app/middleware/correlation.py",           "fastapi/app/middleware/correlation.py"),
    ("fastapi/app/middleware/access_log.py",            "fastapi/app/middleware/access_log.py"),
    ("fastapi/app/middleware/exception_handlers.py",    "fastapi/app/middleware/exception_handlers.py"),
    ("fastapi/app/services/error_events_service.py",   "fastapi/app/services/error_events_service.py"),
    ("fastapi/app/services/error_triage_service.py",   "fastapi/app/services/error_triage_service.py"),
    ("fastapi/app/routers/triage.py",                  "fastapi/app/routers/triage.py"),
    ("fastapi/app/routers/client_errors.py",            "fastapi/app/routers/client_errors.py"),
    ("fastapi/app/routers/controls.py",                "fastapi/app/routers/controls.py"),
    ("fastapi/app/routers/integrations.py",            "fastapi/app/routers/integrations.py"),
    ("fastapi/app/routers/audit.py",                   "fastapi/app/routers/audit.py"),
    ("fastapi/app/services/policy_draft_service.py",   "fastapi/app/services/policy_draft_service.py"),
    ("fastapi/app/services/sweep_service.py",          "fastapi/app/services/sweep_service.py"),
    ("fastapi/app/services/n8n_service.py",            "fastapi/app/services/n8n_service.py"),
    ("fastapi/main.py",                                "fastapi/main.py"),
]

# Next.js files: (local_relative_path, remote_relative_path)
NEXTJS_FILES = [
    ("nextjs/src/app/global-error.tsx",                          "nextjs/src/app/global-error.tsx"),
    ("nextjs/src/app/[orgSlug]/error.tsx",                       "nextjs/src/app/[orgSlug]/error.tsx"),
    ("nextjs/src/app/[orgSlug]/admin/error.tsx",                 "nextjs/src/app/[orgSlug]/admin/error.tsx"),
    ("nextjs/src/app/admin/errors/page.tsx",                     "nextjs/src/app/admin/errors/page.tsx"),
    ("nextjs/src/components/ErrorBoundary.tsx",                  "nextjs/src/components/ErrorBoundary.tsx"),
    ("nextjs/src/lib/client-error-reporter.ts",                  "nextjs/src/lib/client-error-reporter.ts"),
    ("nextjs/src/lib/api.ts",                                    "nextjs/src/lib/api.ts"),
    ("nextjs/src/app/layout.tsx",                                "nextjs/src/app/layout.tsx"),
    ("nextjs/src/graphql/queries.ts",                            "nextjs/src/graphql/queries.ts"),
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sep(label: str) -> None:
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")


def _run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple[int, str, str]:
    """Execute a remote command, return (exit_status, stdout, stderr)."""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    exit_status = stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    return exit_status, out, err


def _run_ok(ssh: paramiko.SSHClient, cmd: str, label: str, timeout: int = 120) -> str:
    """Run remote command, print result, raise on non-zero exit."""
    code, out, err = _run(ssh, cmd, timeout=timeout)
    if code != 0:
        print(f"  [FAIL] {label} (exit {code})")
        if out:
            print(f"  stdout: {out[:500]}")
        if err:
            print(f"  stderr: {err[:500]}")
        raise RuntimeError(f"Command failed ({label}): exit {code}")
    print(f"  [OK]   {label}")
    if out:
        print(f"         {out[:200]}")
    return out


def _sftp_mkdir(sftp: paramiko.SFTPClient, remote_dir: str) -> None:
    """Recursively create remote directory if it doesn't exist."""
    parts = remote_dir.strip("/").split("/")
    current = ""
    for part in parts:
        current = f"{current}/{part}"
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)


def _sftp_put(sftp: paramiko.SFTPClient, local: str, remote: str) -> None:
    """Upload a single file, creating parent directories as needed."""
    import os
    remote_dir = remote.rsplit("/", 1)[0]
    _sftp_mkdir(sftp, remote_dir)
    sftp.put(local, remote)
    print(f"  [UP]   {local.split('/')[-1]:45s} -> {remote}")


def _upload_files(
    sftp: paramiko.SFTPClient,
    file_list: list[tuple[str, str]],
    local_root: str,
    remote_root: str,
) -> None:
    import os
    missing: list[str] = []
    for local_rel, remote_rel in file_list:
        local_path = f"{local_root}/{local_rel}"
        # Convert backslashes for Windows compatibility
        local_path = local_path.replace("\\", "/")
        if not os.path.exists(local_path.replace("/", "\\")):
            missing.append(local_path)
            print(f"  [SKIP] {local_rel} -- file not found locally, skipping")
            continue
        remote_path = f"{remote_root}/{remote_rel}"
        _sftp_put(sftp, local_path.replace("/", "\\"), remote_path)
    if missing:
        print(f"\n  WARNING: {len(missing)} file(s) not found locally and were skipped.")


# ---------------------------------------------------------------------------
# Phase 1: FastAPI deploy
# ---------------------------------------------------------------------------

def phase_fastapi(ssh: paramiko.SSHClient, sftp: paramiko.SFTPClient) -> None:
    _sep("PHASE 1 — FastAPI SFTP upload")
    _upload_files(sftp, FASTAPI_FILES, LOCAL_ROOT, REMOTE_ROOT)

    _sep("PHASE 1 — Rebuild + restart cmmc-fastapi from updated VM source")
    # NOTE: 'docker cp <dir> container:/app/app' nests the directory instead of
    # merging contents, overwriting the container's full app/. The safe approach
    # is a full image rebuild from the VM's source (which is complete after SFTP).
    _run_ok(
        ssh,
        f"cd {REMOTE_ROOT} && docker compose build --no-cache fastapi 2>&1 | tail -5",
        "docker compose build fastapi",
        timeout=300,
    )
    _run_ok(
        ssh,
        f"cd {REMOTE_ROOT} && docker compose up -d fastapi",
        "docker compose up -d fastapi",
        timeout=60,
    )
    print("  Waiting 8s for workers to start...")
    time.sleep(8)

    _sep("PHASE 1 — FastAPI health check")
    code, out, err = _run(ssh, "curl -s http://localhost:8000/health")
    if code != 0 or not out:
        raise RuntimeError(f"FastAPI health check failed: {err}")
    try:
        data = json.loads(out)
        status = data.get("status", "unknown")
        print(f"  [OK]   /health -> status={status}")
        for comp, state in data.get("components", {}).items():
            icon = "OK" if state == "up" else "!!"
            print(f"         [{icon}]  {comp}: {state}")
    except json.JSONDecodeError:
        raise RuntimeError(f"FastAPI /health returned non-JSON: {out[:200]}")

    _sep("PHASE 1 — Correlation-ID header present")
    code, out, err = _run(ssh, "curl -sv http://localhost:8000/health 2>&1 | grep -i X-Correlation-ID")
    if "X-Correlation-ID" in out or "x-correlation-id" in out:
        print("  [OK]   X-Correlation-ID header present")
    else:
        print("  [WARN] X-Correlation-ID header not found in response headers")

    _sep("PHASE 1 — Triage route registered")
    code, out, _ = _run(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/api/triage/reports")
    if out.strip() == "401":
        print("  [OK]   /api/triage/reports -> 401 (route registered, auth working)")
    else:
        print(f"  [WARN] /api/triage/reports returned {out.strip()} (expected 401)")

    _sep("PHASE 1 — Client-error endpoint smoke test")
    payload = '{"message":"deploy smoke test","source":"deploy_script"}'
    code, out, err = _run(ssh, f"curl -s -X POST http://localhost:8000/api/client-errors -H 'Content-Type: application/json' -d '{payload}'")
    if '"status":"recorded"' in out or '"status": "recorded"' in out:
        print("  [OK]   /api/client-errors -> {\"status\": \"recorded\"}")
    else:
        print(f"  [WARN] /api/client-errors returned: {out[:200]}")

    _sep("PHASE 1 — error_events table check")
    code, out, _ = _run(ssh, "docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c 'SELECT count(*) FROM error_events'")
    if code == 0:
        print(f"  [OK]   error_events row count: {out.strip()}")
    else:
        print(f"  [WARN] Could not query error_events: {out[:200]}")


# ---------------------------------------------------------------------------
# Phase 2: Next.js deploy
# ---------------------------------------------------------------------------

def phase_nextjs(ssh: paramiko.SSHClient, sftp: paramiko.SFTPClient) -> None:
    _sep("PHASE 2 — Next.js SFTP upload")
    _upload_files(sftp, NEXTJS_FILES, LOCAL_ROOT, REMOTE_ROOT)

    _sep("PHASE 2 — Docker build cmmc-nextjs (2-3 min, streaming last 30 lines)")
    # We stream by collecting output with a longer timeout
    print("  Building... this takes 2-3 minutes.")
    code, out, err = _run(
        ssh,
        f"cd {REMOTE_ROOT} && docker compose build --no-cache nextjs 2>&1 | tail -30",
        timeout=300,
    )
    if code != 0:
        raise RuntimeError(f"Next.js build failed:\n{out}\n{err}")
    print(f"  Build output (last 30 lines):\n{out}")
    print("  [OK]   Next.js build complete")

    _sep("PHASE 2 — docker compose up -d nextjs")
    _run_ok(
        ssh,
        f"cd {REMOTE_ROOT} && docker compose up -d nextjs",
        "nextjs up",
        timeout=60,
    )
    print("  Waiting 10s for Next.js to start...")
    time.sleep(10)

    _sep("PHASE 2 — Next.js health check")
    code, out, _ = _run(ssh, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000")
    code_str = out.strip()
    if code_str in ("200", "301", "302", "307", "308"):
        print(f"  [OK]   Next.js responding (HTTP {code_str})")
    else:
        print(f"  [WARN] Next.js returned HTTP {code_str}")


# ---------------------------------------------------------------------------
# Phase 3: n8n workflow activation
# ---------------------------------------------------------------------------

def phase_n8n(ssh: paramiko.SSHClient) -> None:
    _sep("PHASE 3 — Fetch n8n workflow list")

    # Get all workflow IDs via API
    curl_cmd = (
        "curl -s "
        f"-H 'X-N8N-API-KEY: {N8N_API_KEY}' "
        "'https://n8n.cmmc4msp.on-nex.us/api/v1/workflows?limit=50'"
    )
    code, out, err = _run(ssh, curl_cmd, timeout=30)
    if code != 0 or not out:
        print(f"  [WARN] Could not fetch workflow list: {err[:200]}")
        print("  Skipping n8n workflow activation.")
        return

    try:
        data = json.loads(out)
    except json.JSONDecodeError:
        print(f"  [WARN] n8n API returned non-JSON: {out[:200]}")
        print("  Skipping n8n workflow activation.")
        return

    workflows = data.get("data", [])
    if not workflows:
        print("  [WARN] No workflows returned from n8n API")
        return

    print(f"  Found {len(workflows)} workflow(s)")

    _sep("PHASE 3 — Activate all workflows")
    activated = 0
    failed = 0
    for wf in workflows:
        wf_id = wf.get("id")
        wf_name = wf.get("name", "unnamed")[:50]
        if not wf_id:
            continue
        code, out, err = _run(
            ssh,
            f"docker exec cmmc-n8n n8n update:workflow --active=true --id={wf_id}",
            timeout=15,
        )
        if code == 0:
            print(f"  [OK]   [{wf_id}] {wf_name}")
            activated += 1
        else:
            print(f"  [FAIL] [{wf_id}] {wf_name}: {err[:100]}")
            failed += 1

    print(f"\n  Activated: {activated}  Failed: {failed}")

    _sep("PHASE 3 — Verify active count via API")
    code, out, _ = _run(ssh, curl_cmd, timeout=30)
    if code == 0:
        try:
            data2 = json.loads(out)
            active_count = sum(1 for w in data2.get("data", []) if w.get("active"))
            total = len(data2.get("data", []))
            print(f"  [OK]   Active: {active_count}/{total} workflows")
        except json.JSONDecodeError:
            print("  [WARN] Could not parse verification response")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    print("CMMC Compliance OS — Workstream Deploy Script")
    print(f"Target: {VM_USER}@{VM_HOST}")
    print()

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"Connecting to {VM_HOST}:{VM_PORT}...")
        ssh.connect(VM_HOST, port=VM_PORT, username=VM_USER, password=VM_PASS, timeout=15)
        print("  [OK]   Connected\n")

        sftp = ssh.open_sftp()

        phase_fastapi(ssh, sftp)
        phase_nextjs(ssh, sftp)
        phase_n8n(ssh)

        sftp.close()

        print("\n" + "="*60)
        print("  DEPLOY COMPLETE")
        print("="*60)
        print()
        print("Summary of manual verification commands (run from your machine):")
        print(f"  FastAPI health  : curl -s http://{VM_HOST}:8000/health")
        print(f"  Triage route    : curl -s http://{VM_HOST}:8000/api/triage/reports")
        print(f"  Client errors   : curl -s -X POST http://{VM_HOST}:8000/api/client-errors -H 'Content-Type: application/json' -d '{{\"message\":\"test\"}}'")

    except KeyboardInterrupt:
        print("\n[ABORT] Deploy cancelled by user.")
        sys.exit(1)
    except Exception as exc:
        print(f"\n[ERROR] Deploy failed: {exc}")
        sys.exit(1)
    finally:
        ssh.close()


if __name__ == "__main__":
    main()
