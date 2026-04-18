"""
deploy_nextjs_and_seed.py

1. SFTPs changed nextjs source files + seed script to the VM
2. Runs docker compose build nextjs && docker compose up -d nextjs
3. Runs seed_demo_client.py --dry-run, then live (with --skip-authentik if no token)
4. Verifies the Next.js container is healthy
"""
from __future__ import annotations

import io
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _secrets import vm_ssh

REPO_ROOT = Path(__file__).resolve().parent.parent
VM_BASE = "/opt/cmmc4msp"

# Files to sync (relative to REPO_ROOT → remote path relative to VM_BASE)
SYNC_ITEMS = [
    # nextjs source changes
    ("nextjs/package.json",                                         "nextjs/package.json"),
    ("nextjs/package-lock.json",                                    "nextjs/package-lock.json"),
    ("nextjs/tailwind.config.js",                                   "nextjs/tailwind.config.js"),
    ("nextjs/src/app/globals.css",                                  "nextjs/src/app/globals.css"),
    ("nextjs/src/app/page.tsx",                                     "nextjs/src/app/page.tsx"),
    ("nextjs/src/app/[orgSlug]/layout.tsx",                         "nextjs/src/app/[orgSlug]/layout.tsx"),
    ("nextjs/src/app/[orgSlug]/dashboard/page.tsx",                 "nextjs/src/app/[orgSlug]/dashboard/page.tsx"),
    ("nextjs/src/components/AppSidebar.tsx",                        "nextjs/src/components/AppSidebar.tsx"),
    # new platform routes
    ("nextjs/src/app/platform/layout.tsx",                         "nextjs/src/app/platform/layout.tsx"),
    ("nextjs/src/app/platform/page.tsx",                           "nextjs/src/app/platform/page.tsx"),
    ("nextjs/src/app/platform/msps/page.tsx",                      "nextjs/src/app/platform/msps/page.tsx"),
    ("nextjs/src/app/platform/clients/page.tsx",                   "nextjs/src/app/platform/clients/page.tsx"),
    ("nextjs/src/app/platform/health/page.tsx",                    "nextjs/src/app/platform/health/page.tsx"),
    ("nextjs/src/app/platform/analytics/page.tsx",                 "nextjs/src/app/platform/analytics/page.tsx"),
    # new msp routes
    ("nextjs/src/app/msp/layout.tsx",                              "nextjs/src/app/msp/layout.tsx"),
    ("nextjs/src/app/msp/page.tsx",                                "nextjs/src/app/msp/page.tsx"),
    ("nextjs/src/app/msp/clients/page.tsx",                        "nextjs/src/app/msp/clients/page.tsx"),
    ("nextjs/src/app/msp/analytics/page.tsx",                      "nextjs/src/app/msp/analytics/page.tsx"),
    ("nextjs/src/app/msp/team/page.tsx",                           "nextjs/src/app/msp/team/page.tsx"),
    ("nextjs/src/app/msp/reports/page.tsx",                        "nextjs/src/app/msp/reports/page.tsx"),
    # scripts
    ("scripts/_secrets.py",                                        "scripts/_secrets.py"),
    ("scripts/seed_demo_client.py",                                "scripts/seed_demo_client.py"),
]

# File to remove from VM (old Sidebar.tsx)
REMOVE_REMOTE = [
    "nextjs/src/components/Sidebar.tsx",
]


def _ssh():
    import paramiko
    host, user, password = vm_ssh()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=20)
    return client, password


def _run(client, cmd, sudo_pw=None, timeout=120):
    import json as _json
    if sudo_pw:
        cmd = f"echo {_json.dumps(sudo_pw)} | sudo -S bash -c {_json.dumps(cmd)}"
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def sftp_put(sftp, local_path: Path, remote_path: str):
    """Upload a file, creating remote directories as needed."""
    remote_dir = "/".join(remote_path.split("/")[:-1])
    try:
        sftp.stat(remote_dir)
    except FileNotFoundError:
        # mkdir -p equivalent
        parts = remote_dir.split("/")
        cur = ""
        for p in parts:
            if not p:
                continue
            cur = cur + "/" + p
            try:
                sftp.stat(cur)
            except FileNotFoundError:
                try:
                    sftp.mkdir(cur)
                except Exception:
                    pass
    sftp.put(str(local_path), remote_path)


# ── Step 1: Sync files ────────────────────────────────────────────────────────

def sync_files(client, password):
    print("\n[Step 1] Syncing files to VM...")
    sftp = client.open_sftp()
    sftp.chdir(VM_BASE)

    for local_rel, remote_rel in SYNC_ITEMS:
        local = REPO_ROOT / local_rel
        if not local.exists():
            print(f"  SKIP (not found): {local_rel}")
            continue
        remote_abs = f"{VM_BASE}/{remote_rel}"
        try:
            sftp_put(sftp, local, remote_abs)
            print(f"  OK  {local_rel}")
        except Exception as e:
            print(f"  ERR {local_rel}: {e}")

    # Remove old Sidebar.tsx if present
    for rem in REMOVE_REMOTE:
        try:
            sftp.remove(f"{VM_BASE}/{rem}")
            print(f"  DEL {rem}")
        except FileNotFoundError:
            pass  # already gone

    sftp.close()
    print("  Sync complete.")


# ── Step 2: Docker build + up ─────────────────────────────────────────────────

def docker_deploy(client, password):
    print("\n[Step 2] Docker build + deploy nextjs...")

    rc, out, err = _run(
        client,
        f"cd {VM_BASE} && docker compose build nextjs 2>&1 | tail -20",
        password, timeout=300,
    )
    print(f"  Build RC={rc}")
    for line in (out + err).splitlines()[-15:]:
        print(f"    {line}")
    if rc != 0:
        print("  ERROR: build failed")
        return False

    rc, out, err = _run(
        client,
        f"cd {VM_BASE} && docker compose up -d nextjs 2>&1",
        password, timeout=60,
    )
    print(f"  Up RC={rc} — {out or err}")
    if rc != 0:
        print("  ERROR: up failed")
        return False

    # Wait for container to settle
    print("  Waiting 15s for container to start...")
    time.sleep(15)

    # Check container health
    rc, out, err = _run(client, "docker ps --filter name=nextjs --format '{{.Status}}'")
    print(f"  Container status: {out or '(none)'}")
    return True


# ── Step 3: Run seed ──────────────────────────────────────────────────────────

def run_seed(client, password):
    print("\n[Step 3] Running demo seeder on VM...")

    # Get DATABASE_URL from .env
    rc, db_url, _ = _run(client, f"grep -E '^DATABASE_URL=' {VM_BASE}/.env | head -1")
    if not db_url:
        # Try constructing from individual vars
        rc, pg_vars, _ = _run(client, f"grep -E '^(POSTGRES|DB)' {VM_BASE}/.env | head -10")
        print(f"  No DATABASE_URL found. Postgres vars:\n{pg_vars}")
        print("  Will attempt seeder anyway (it will prompt/use env vars)")

    # Dry run first
    print("\n  --- DRY RUN ---")
    rc, out, err = _run(
        client,
        f"cd {VM_BASE} && python3 scripts/seed_demo_client.py --dry-run --skip-authentik 2>&1",
        password, timeout=30,
    )
    print(f"  Dry run RC={rc}")
    for line in (out + err).splitlines():
        print(f"    {line}")

    if rc != 0:
        print("  Dry run failed — check output above. Skipping live seed.")
        return False

    # Live seed
    print("\n  --- LIVE SEED ---")
    rc, out, err = _run(
        client,
        f"cd {VM_BASE} && python3 scripts/seed_demo_client.py --skip-authentik 2>&1",
        password, timeout=120,
    )
    print(f"  Live seed RC={rc}")
    for line in (out + err).splitlines():
        print(f"    {line}")

    return rc == 0


# ── Step 4: Smoke test ────────────────────────────────────────────────────────

def smoke_test(client):
    print("\n[Step 4] Smoke tests...")

    checks = [
        ("FastAPI /health",        "curl -sf http://localhost:8000/health 2>/dev/null | python3 -c \"import sys,json; d=json.load(sys.stdin); print('status:', d.get('status'))\""),
        ("Next.js responds",       "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null"),
        ("Nextjs /msp route",      "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000/msp 2>/dev/null"),
        ("Nextjs /platform route", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000/platform 2>/dev/null"),
        ("DB: meridian-defense org","psql $DATABASE_URL -tAc \"SELECT slug FROM orgs WHERE slug='meridian-defense'\" 2>/dev/null || docker exec cmmc4msp-postgres-1 psql -U cmmc -d cmmc4msp -tAc \"SELECT slug FROM orgs WHERE slug='meridian-defense'\" 2>/dev/null"),
        ("DB: program_controls count","docker exec cmmc4msp-postgres-1 psql -U cmmc -d cmmc4msp -tAc \"SELECT COUNT(*) FROM program_controls pc JOIN programs p ON pc.program_id=p.id JOIN orgs o ON p.org_id=o.id WHERE o.slug='meridian-defense'\" 2>/dev/null"),
    ]

    all_ok = True
    for label, cmd in checks:
        rc, out, err = _run(None if label.startswith("DB") else None, cmd)  # use client below
        rc, out, err = _run(client, cmd, timeout=15)
        status = "OK " if (rc == 0 and out.strip()) else "ERR"
        if status == "ERR":
            all_ok = False
        print(f"  [{status}] {label}: {out.strip() or err.strip()[:80] or '(empty)'}")

    return all_ok


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Deploy Next.js + Seed Demo Client")
    print("=" * 60)

    client, password = _ssh()
    results = {}

    try:
        sync_files(client, password)
        results["deploy"] = docker_deploy(client, password)
        results["seed"] = run_seed(client, password)
        results["smoke"] = smoke_test(client)
    finally:
        client.close()

    print("\n" + "=" * 60)
    print("Summary:")
    for k, v in results.items():
        print(f"  {'✓' if v else '✗'} {k}")
    print("=" * 60)

    if not all(results.values()):
        sys.exit(1)


if __name__ == "__main__":
    main()
