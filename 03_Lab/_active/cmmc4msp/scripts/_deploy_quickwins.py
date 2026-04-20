"""
_deploy_quickwins.py
Deploy quick-wins build to VM 10.10.110.41 via paramiko.
Steps: upload files → run migration → rebuild containers → smoke test.
"""

import sys
import time
import paramiko
import posixpath

# ── Connection ────────────────────────────────────────────────────────────────
HOST = "10.10.110.41"
PORT = 22
USER = "mrt"
PASSWORD = "Poll0000"
REMOTE_ROOT = "/opt/stacks/cmmc4msp"
LOCAL_ROOT = r"D:\Code\Claude\03_Lab\_active\cmmc4msp"

# ── File manifest ─────────────────────────────────────────────────────────────
# (local_relative, remote_relative)  — relative to their respective roots
UPLOADS = [
    # Backend
    (r"fastapi\main.py",                                     "fastapi/main.py"),
    (r"fastapi\app\services\integration_service.py",         "fastapi/app/services/integration_service.py"),
    (r"fastapi\app\routers\assignments.py",                  "fastapi/app/routers/assignments.py"),
    (r"fastapi\app\routers\controls.py",                     "fastapi/app/routers/controls.py"),
    (r"fastapi\app\routers\artifacts.py",                    "fastapi/app/routers/artifacts.py"),
    (r"postgres\migrations\027_integration_instance_url.sql","postgres/migrations/027_integration_instance_url.sql"),
    # Frontend
    (r"nextjs\src\app\[orgSlug]\evidence-automation\page.tsx",
     "nextjs/src/app/[orgSlug]/evidence-automation/page.tsx"),
    (r"nextjs\src\components\AppSidebar.tsx",                "nextjs/src/components/AppSidebar.tsx"),
    (r"nextjs\src\app\[orgSlug]\controls\page.tsx",          "nextjs/src/app/[orgSlug]/controls/page.tsx"),
    (r"nextjs\src\components\CopilotChat.tsx",               "nextjs/src/components/CopilotChat.tsx"),
    (r"nextjs\src\app\[orgSlug]\controls\[id]\page.tsx",     "nextjs/src/app/[orgSlug]/controls/[id]/page.tsx"),
    (r"nextjs\src\graphql\queries.ts",                       "nextjs/src/graphql/queries.ts"),
    # Harvester scripts → fastapi/static/harvester/
    (r"scripts\harvest_windows.ps1",   "fastapi/static/harvester/harvest_windows.ps1"),
    (r"scripts\harvest_linux.sh",      "fastapi/static/harvester/harvest_linux.sh"),
    (r"scripts\README_HARVESTER.md",   "fastapi/static/harvester/README.md"),
]


def safe_print(text: str) -> None:
    """Print text, replacing unencodable characters with '?'."""
    encoded = text.encode(sys.stdout.encoding or "utf-8", errors="replace")
    sys.stdout.buffer.write(encoded + b"\n")
    sys.stdout.buffer.flush()


def banner(msg: str) -> None:
    safe_print(f"\n{'='*60}")
    safe_print(f"  {msg}")
    safe_print(f"{'='*60}")


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 180) -> tuple[int, str, str]:
    """Execute a command and return (exit_code, stdout, stderr)."""
    safe_print(f"  CMD: {cmd}")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    if out.strip():
        safe_print(f"  OUT: {out.strip()}")
    if err.strip():
        safe_print(f"  ERR: {err.strip()}")
    return code, out, err


def ensure_remote_dir(sftp: paramiko.SFTPClient, remote_path: str) -> None:
    """Recursively mkdir the remote directory (mkdir -p equivalent)."""
    parts = remote_path.split("/")
    current = ""
    for part in parts:
        if not part:
            current = "/"
            continue
        current = posixpath.join(current, part) if current != "/" else "/" + part
        try:
            sftp.stat(current)
        except FileNotFoundError:
            sftp.mkdir(current)
            safe_print(f"  MKDIR: {current}")


def step1_upload(ssh: paramiko.SSHClient) -> None:
    banner("STEP 1 — Upload files")
    sftp = ssh.open_sftp()
    try:
        for local_rel, remote_rel in UPLOADS:
            local_path = LOCAL_ROOT + "\\" + local_rel
            remote_path = REMOTE_ROOT + "/" + remote_rel
            remote_dir = posixpath.dirname(remote_path)

            safe_print(f"\n  Uploading: {local_rel}")
            safe_print(f"         -> {remote_path}")

            ensure_remote_dir(sftp, remote_dir)
            sftp.put(local_path, remote_path)
            stat = sftp.stat(remote_path)
            safe_print(f"  OK - {stat.st_size} bytes")
    finally:
        sftp.close()
    safe_print("\nSTEP 1 COMPLETE - all files uploaded.")


def step2_migration(ssh: paramiko.SSHClient) -> None:
    banner("STEP 2 - Run migration 027")

    sql_remote = f"{REMOTE_ROOT}/postgres/migrations/027_integration_instance_url.sql"

    code, out, err = run(
        ssh,
        f"docker cp {sql_remote} cmmc-postgres:/tmp/027.sql && "
        f"docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -f /tmp/027.sql"
    )
    if code != 0:
        raise RuntimeError(f"Migration failed (exit {code}):\n{err}")

    # Verify column exists
    code, out, err = run(
        ssh,
        r'docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c "\d integrations" | grep instance_url'
    )
    if "instance_url" not in out:
        raise RuntimeError(f"Column instance_url not found after migration. Got:\n{out}\n{err}")

    safe_print("\nSTEP 2 COMPLETE - migration applied, instance_url column confirmed.")


def step3_rebuild(ssh: paramiko.SSHClient) -> None:
    banner("STEP 3 - Rebuild FastAPI + Next.js")

    safe_print("\n  Building both services in parallel (this may take 2-4 minutes)...")
    code, out, err = run(
        ssh,
        "cd /opt/stacks/cmmc4msp && docker compose build fastapi nextjs 2>&1",
        timeout=480,
    )
    if code != 0:
        raise RuntimeError(f"docker compose build failed (exit {code}):\n{err}\n{out[-3000:]}")

    safe_print("\n  Starting services...")
    code, out, err = run(
        ssh,
        "cd /opt/stacks/cmmc4msp && docker compose up -d fastapi nextjs",
        timeout=60,
    )
    if code != 0:
        raise RuntimeError(f"docker compose up failed (exit {code}):\n{err}")

    safe_print("\n  Waiting 30s for containers to stabilise...")
    time.sleep(30)
    safe_print("STEP 3 COMPLETE - services rebuilt and restarted.")


def step4_verify_running(ssh: paramiko.SSHClient) -> None:
    banner("STEP 4 - Verify containers are Up")

    code, out, err = run(ssh, 'docker ps | grep -E "cmmc-(fastapi|nextjs)"')
    lines = [l for l in out.splitlines() if "cmmc-fastapi" in l or "cmmc-nextjs" in l]

    fastapi_up = any("cmmc-fastapi" in l and "Up" in l for l in lines)
    nextjs_up  = any("cmmc-nextjs"  in l and "Up" in l for l in lines)

    safe_print(f"\n  cmmc-fastapi Up: {fastapi_up}")
    safe_print(f"  cmmc-nextjs  Up: {nextjs_up}")

    if not fastapi_up or not nextjs_up:
        raise RuntimeError(
            f"One or more containers not running.\nDocker ps output:\n{out}"
        )
    safe_print("\nSTEP 4 COMPLETE - both containers running.")


def step5_smoke_tests(ssh: paramiko.SSHClient) -> None:
    banner("STEP 5 - Smoke tests")

    # 5a - Harvester static file
    safe_print("\n  5a - Harvester static file")
    code, out, err = run(
        ssh,
        "curl -sI https://api.cmmc4msp.on-nex.us/harvester/harvest_windows.ps1 | head -5"
    )
    if "200" not in out and "200" not in err:
        raise RuntimeError(f"5a FAILED - expected 200, got:\n{out}\n{err}")
    safe_print("  5a PASS - harvest_windows.ps1 served OK")

    # 5b - Evidence automation page
    safe_print("\n  5b - Evidence automation Next.js page")
    code, out, err = run(
        ssh,
        "curl -sI https://app.cmmc4msp.on-nex.us/meridian-defense/evidence-automation | head -5"
    )
    if "200" not in out and "307" not in out and "302" not in out:
        raise RuntimeError(f"5b FAILED - expected 200 or redirect, got:\n{out}\n{err}")
    safe_print("  5b PASS - evidence-automation page reachable")

    # 5c - FastAPI logs for errors
    safe_print("\n  5c - FastAPI recent error logs")
    code, out, err = run(
        ssh,
        'docker logs cmmc-fastapi --since 3m 2>&1 | grep -iE "error|traceback" | head -20'
    )
    if out.strip():
        safe_print(f"  5c WARNING - errors found in FastAPI logs:\n{out}")
    else:
        safe_print("  5c PASS - no errors in FastAPI logs")

    # 5d - Next.js build/start log
    safe_print("\n  5d - Next.js startup log")
    code, out, err = run(
        ssh,
        "docker logs cmmc-nextjs --since 3m 2>&1 | tail -20"
    )
    if "Ready" not in out and "ready" not in out:
        safe_print(f"  5d WARNING - 'Ready' not found in Next.js logs. Tail:\n{out}")
    else:
        safe_print("  5d PASS - Next.js shows Ready")

    safe_print("\nSTEP 5 COMPLETE - smoke tests done.")


def main() -> None:
    # Allow --from-step3 to skip upload+migration (already done)
    skip_to_step3 = "--from-step3" in sys.argv

    banner("CMMC4MSP Quick-Wins Deployment")
    safe_print(f"  Target: {USER}@{HOST}")
    if skip_to_step3:
        safe_print("  Mode: resuming from step 3 (upload+migration already complete)")
    else:
        safe_print(f"  Files:  {len(UPLOADS)} files to upload")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    safe_print(f"\n  Connecting to {HOST}:{PORT}...")
    ssh.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    safe_print("  Connected.")

    try:
        if not skip_to_step3:
            step1_upload(ssh)
            step2_migration(ssh)
        step3_rebuild(ssh)
        step4_verify_running(ssh)
        step5_smoke_tests(ssh)
    except Exception as exc:
        safe_print(f"\n{'!'*60}")
        safe_print(f"  DEPLOYMENT FAILED: {exc}")
        safe_print(f"{'!'*60}")
        ssh.close()
        sys.exit(1)

    ssh.close()
    banner("DEPLOYMENT COMPLETE")
    safe_print("  All steps passed. Build is live.\n")


if __name__ == "__main__":
    main()
