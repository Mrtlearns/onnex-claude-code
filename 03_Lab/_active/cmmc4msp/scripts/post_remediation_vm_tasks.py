"""
Post-remediation VM tasks:
  1. Set WEBHOOK_SECRET to a strong random value in /opt/cmmc4msp/.env
  2. Re-run Hasura permissions update (restrict stack_trace/context from msp_admin)
  3. Restart FastAPI container to pick up new secret
  4. Verify all 16 n8n workflows are active
"""
from __future__ import annotations

import json
import os
import secrets
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _secrets import vm_ssh, hasura, n8n_api

# ── New webhook secret ─────────────────────────────────────────────────────────
NEW_WEBHOOK_SECRET = secrets.token_hex(32)

def _ssh():
    import paramiko
    host, user, password = vm_ssh()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=user, password=password, timeout=15)
    return client, password


def _run(client, cmd, sudo_pw=None, timeout=30):
    if sudo_pw:
        cmd = f"echo '{sudo_pw}' | sudo -S bash -c {json.dumps(cmd)}"
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


# ── Task 1: Update WEBHOOK_SECRET in VM .env ──────────────────────────────────
def update_webhook_secret(client, sudo_pw):
    print(f"\n[Task 1] Setting WEBHOOK_SECRET on VM...")

    # Read current .env
    rc, out, err = _run(client, "cat /opt/cmmc4msp/.env", sudo_pw)
    if rc != 0:
        print(f"  ERROR reading .env: {err}")
        return False

    lines = out.splitlines()
    new_lines = []
    found = False
    for line in lines:
        if line.startswith("WEBHOOK_SECRET="):
            new_lines.append(f"WEBHOOK_SECRET={NEW_WEBHOOK_SECRET}")
            found = True
        else:
            new_lines.append(line)
    if not found:
        new_lines.append(f"WEBHOOK_SECRET={NEW_WEBHOOK_SECRET}")

    new_env = "\n".join(new_lines) + "\n"

    # Write back
    escaped = new_env.replace("'", "'\\''")
    cmd = f"echo '{escaped}' > /opt/cmmc4msp/.env && chmod 600 /opt/cmmc4msp/.env"
    rc, out, err = _run(client, cmd, sudo_pw)
    if rc != 0:
        print(f"  ERROR writing .env: {err}")
        return False

    print(f"  OK — WEBHOOK_SECRET set to {NEW_WEBHOOK_SECRET[:8]}...{NEW_WEBHOOK_SECRET[-8:]}")
    return True


# ── Task 2: Restart FastAPI to pick up new secret ─────────────────────────────
def restart_fastapi(client, sudo_pw):
    print(f"\n[Task 2] Restarting FastAPI container...")
    rc, out, err = _run(
        client,
        "cd /opt/cmmc4msp && docker compose restart fastapi",
        sudo_pw, timeout=60,
    )
    if rc != 0:
        print(f"  ERROR: {err}")
        return False
    print(f"  OK — fastapi restarted")
    time.sleep(5)  # give it time to start

    # Health check
    rc, out, err = _run(client, "curl -s http://localhost:8000/health 2>/dev/null | head -c 200")
    print(f"  Health: {out or err or '(no response)'}")
    return True


# ── Task 3: Apply updated Hasura column permissions ───────────────────────────
def apply_hasura_permissions():
    print(f"\n[Task 3] Applying updated Hasura permissions (restricting stack_trace/context)...")
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, str(Path(__file__).parent / "setup_hasura_025.py")],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode != 0:
            print(f"  ERROR:\n{result.stderr[-2000:]}")
            return False
        lines = result.stdout.strip().splitlines()
        for line in lines[-10:]:
            print(f"  {line}")
        print("  OK")
        return True
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


# ── Task 4: Verify all 16 n8n workflows are active ───────────────────────────
def verify_n8n_workflows():
    print(f"\n[Task 4] Verifying n8n workflow activation status...")
    try:
        import httpx
        n8n_url, api_key = n8n_api()
        resp = httpx.get(
            f"{n8n_url}/api/v1/workflows",
            headers={"X-N8N-API-KEY": api_key},
            timeout=15,
        )
        resp.raise_for_status()
        workflows = resp.json().get("data", [])
        active = [w for w in workflows if w.get("active")]
        inactive = [w for w in workflows if not w.get("active")]

        print(f"  Total: {len(workflows)}  Active: {len(active)}  Inactive: {len(inactive)}")

        if inactive:
            print("  Activating inactive workflows...")
            for wf in inactive:
                wid = wf["id"]
                name = wf.get("name", wid)
                ar = httpx.patch(
                    f"{n8n_url}/api/v1/workflows/{wid}",
                    headers={"X-N8N-API-KEY": api_key, "Content-Type": "application/json"},
                    json={"active": True},
                    timeout=15,
                )
                if ar.status_code in (200, 204):
                    print(f"    Activated: {name}")
                else:
                    print(f"    WARN: {name} — {ar.status_code} {ar.text[:100]}")

        # Final count
        resp2 = httpx.get(f"{n8n_url}/api/v1/workflows", headers={"X-N8N-API-KEY": api_key}, timeout=15)
        workflows2 = resp2.json().get("data", [])
        active2 = sum(1 for w in workflows2 if w.get("active"))
        print(f"  Final: {active2}/{len(workflows2)} active")
        return active2 == len(workflows2)
    except Exception as e:
        print(f"  ERROR: {e}")
        return False


if __name__ == "__main__":
    print("=" * 60)
    print("Post-remediation VM tasks")
    print("=" * 60)

    client, sudo_pw = _ssh()

    results = {}
    try:
        results["webhook_secret"] = update_webhook_secret(client, sudo_pw)
        results["restart_fastapi"] = restart_fastapi(client, sudo_pw)
    finally:
        client.close()

    results["hasura_permissions"] = apply_hasura_permissions()
    results["n8n_workflows"] = verify_n8n_workflows()

    print("\n" + "=" * 60)
    print("Summary:")
    for k, v in results.items():
        status = "✓" if v else "✗"
        print(f"  {status} {k}")

    print("=" * 60)
    if all(results.values()):
        print("All tasks completed successfully.")
    else:
        print("Some tasks failed — check output above.")
        sys.exit(1)
