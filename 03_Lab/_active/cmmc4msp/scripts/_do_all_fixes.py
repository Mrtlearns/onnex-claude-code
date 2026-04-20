"""
_do_all_fixes.py — one-shot: deploy code + fix Authentik + trigger embeddings

1. SFTP 5 changed files to VM
2. Patch VM .env with API_URL
3. Restart FastAPI
4. Rebuild + restart Next.js
5. Get Authentik token from VM .env
6. Get meridian-defense org_id from DB
7. PATCH Authentik demo user attributes
8. Trigger artifact extraction/embedding for Meridian Defense artifacts via n8n webhook
"""
from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

import paramiko

# ── Credentials ───────────────────────────────────────────────────────────────

VM_HOST = "10.10.110.41"
VM_USER = "mrt"
VM_PASSWORD = "Poll0000"
VM_BASE = "/opt/stacks/cmmc4msp"
REPO_ROOT = Path(__file__).resolve().parent.parent

DEMO_USERS = [
    {"pk": 9,  "email": "admin@meridian-defense.demo",    "role": "client_admin"},
    {"pk": 10, "email": "engineer@meridian-defense.demo", "role": "client_user"},
    {"pk": 11, "email": "auditor@meridian-defense.demo",  "role": "client_user"},
]

FILES_TO_SYNC = [
    ("fastapi/app/config.py",                                    "fastapi/app/config.py"),
    ("fastapi/app/services/minio_service.py",                   "fastapi/app/services/minio_service.py"),
    ("fastapi/app/services/report_service.py",                  "fastapi/app/services/report_service.py"),
    ("fastapi/app/routers/reports.py",                          "fastapi/app/routers/reports.py"),
    ("nextjs/src/app/[orgSlug]/suggestions/page.tsx",           "nextjs/src/app/[orgSlug]/suggestions/page.tsx"),
]

# ── SSH helpers ────────────────────────────────────────────────────────────────

def _connect():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VM_HOST, username=VM_USER, password=VM_PASSWORD, timeout=20)
    return c


def _run(client, cmd, sudo=False, timeout=120):
    if sudo:
        cmd = f"echo {json.dumps(VM_PASSWORD)} | sudo -S bash -c {json.dumps(cmd)}"
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def sftp_put(sftp, local: Path, remote: str):
    parts = remote.split("/")
    cur = ""
    for p in parts[:-1]:
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
    sftp.put(str(local), remote)


# ── Step 1: Sync files ─────────────────────────────────────────────────────────

def sync_files(client):
    print("\n[1] Syncing files...")
    sftp = client.open_sftp()
    sftp.chdir(VM_BASE)
    for local_rel, remote_rel in FILES_TO_SYNC:
        local = REPO_ROOT / local_rel
        if not local.exists():
            print(f"  SKIP {local_rel} (not found locally)")
            continue
        remote_abs = f"{VM_BASE}/{remote_rel}"
        try:
            sftp_put(sftp, local, remote_abs)
            print(f"  OK   {local_rel}")
        except Exception as e:
            print(f"  ERR  {local_rel}: {e}")
    sftp.close()


# ── Step 2: Patch VM .env with API_URL ────────────────────────────────────────

def patch_env(client):
    print("\n[2] Patching VM .env...")
    rc, out, _ = _run(client, f"grep -q '^API_URL=' {VM_BASE}/.env && echo found || echo missing")
    if "missing" in out:
        _run(client, f"echo 'API_URL=https://api.cmmc4msp.on-nex.us' >> {VM_BASE}/.env", sudo=True)
        print("  Added API_URL=https://api.cmmc4msp.on-nex.us")
    else:
        print("  API_URL already set")


# ── Step 3: Restart FastAPI ────────────────────────────────────────────────────

def restart_fastapi(client):
    print("\n[3] Restarting FastAPI...")
    rc, out, err = _run(client, f"cd {VM_BASE} && docker compose restart fastapi 2>&1", sudo=True, timeout=60)
    print(f"  RC={rc} {(out or err)[:100]}")
    time.sleep(5)
    rc, out, _ = _run(client, "docker ps --filter name=fastapi --format '{{.Status}}'")
    print(f"  fastapi status: {out or '(none)'}")


# ── Step 4: Rebuild + restart Next.js ─────────────────────────────────────────

def rebuild_nextjs(client):
    print("\n[4] Rebuilding Next.js (this takes ~2min)...")
    rc, out, err = _run(
        client,
        f"cd {VM_BASE} && docker compose build nextjs 2>&1 | tail -15",
        sudo=True, timeout=300,
    )
    print(f"  Build RC={rc}")
    for line in (out or err).splitlines()[-8:]:
        print(f"    {line}")
    if rc != 0:
        print("  ERROR: build failed")
        return False

    rc, out, err = _run(client, f"cd {VM_BASE} && docker compose up -d nextjs 2>&1", sudo=True, timeout=60)
    print(f"  Up RC={rc} {(out or err)[:80]}")
    time.sleep(10)
    rc, out, _ = _run(client, "docker ps --filter name=nextjs --format '{{.Status}}'")
    print(f"  nextjs status: {out or '(none)'}")
    return rc == 0


# ── Step 5+6: Authentik demo user attributes ──────────────────────────────────

def get_authentik_token(client) -> str:
    rc, out, _ = _run(client, f"grep -E '^AUTHENTIK_API_TOKEN=' {VM_BASE}/.env | head -1")
    if out:
        token = out.split("=", 1)[1].strip().strip('"').strip("'")
        if token:
            return token
    # Try /opt/stacks path
    rc, out, _ = _run(client, "grep -rE '^AUTHENTIK_API_TOKEN=' /opt/ 2>/dev/null | head -1")
    if out and "=" in out:
        return out.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


def get_authentik_url(client) -> str:
    rc, out, _ = _run(client, f"grep -E '^AUTHENTIK_URL=' {VM_BASE}/.env | head -1")
    if out and "=" in out:
        return out.split("=", 1)[1].strip().strip('"').strip("'")
    return "https://auth.cmmc4msp.on-nex.us"


def get_org_id(client) -> str:
    sql = "SELECT id FROM orgs WHERE slug='meridian-defense' LIMIT 1"
    cmd = f"docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -tAc {json.dumps(sql)} 2>/dev/null || docker exec cmmc-postgres psql -U cmmc -d cmmc_main -tAc {json.dumps(sql)} 2>/dev/null"
    rc, out, _ = _run(client, cmd)
    return out.strip()


def patch_authentik_user(base_url: str, token: str, pk: int, attrs: dict):
    url = f"{base_url.rstrip('/')}/api/v3/core/users/{pk}/"
    payload = json.dumps({"attributes": attrs}).encode()
    req = urllib.request.Request(url, data=payload, method="PATCH", headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            print(f"  OK  pk={pk} {body.get('email')} attrs={body.get('attributes')}")
    except urllib.error.HTTPError as e:
        print(f"  ERR pk={pk} HTTP {e.code}: {e.read().decode()[:150]}")
    except Exception as ex:
        print(f"  ERR pk={pk}: {ex}")


def fix_authentik(client):
    print("\n[5] Fixing Authentik demo user attributes...")
    token = get_authentik_token(client)
    if not token:
        print("  WARN: AUTHENTIK_API_TOKEN not found in VM .env — skipping")
        return
    auth_url = get_authentik_url(client)
    print(f"  Authentik: {auth_url}")

    print("\n[6] Getting meridian-defense org_id from DB...")
    org_id = get_org_id(client)
    if not org_id:
        print("  WARN: meridian-defense org not found — skipping Authentik patch")
        return
    print(f"  org_id = {org_id}")

    for u in DEMO_USERS:
        patch_authentik_user(auth_url, token, u["pk"], {
            "org_id": org_id, "role": u["role"], "msp_id": "",
        })


# ── Step 7: Trigger artifact embeddings ───────────────────────────────────────

def trigger_embeddings(client):
    print("\n[7] Triggering artifact extraction for Meridian Defense...")
    sql = """
    SELECT a.id, a.file_name, a.minio_bucket, a.minio_key
    FROM artifacts a
    JOIN program_controls pc ON a.program_control_id = pc.id
    JOIN programs p ON pc.program_id = p.id
    JOIN orgs o ON p.org_id = o.id
    WHERE o.slug = 'meridian-defense'
    LIMIT 10
    """
    cmd = f"docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -tAc {json.dumps(sql.strip())} 2>/dev/null || docker exec cmmc-postgres psql -U cmmc -d cmmc_main -tAc {json.dumps(sql.strip())} 2>/dev/null"
    rc, out, _ = _run(client, cmd)

    if not out.strip():
        print("  No artifacts found for meridian-defense")
        return

    # Get n8n webhook URL for artifact processing
    n8n_url = "http://localhost:5678"
    rc2, wh, _ = _run(client, "docker exec cmmc-n8n n8n list:workflow 2>/dev/null | grep -i artifact | head -3")
    print(f"  n8n artifact workflows: {wh[:100] or '(none found)'}")

    # Get webhook secret for artifact trigger
    rc3, ws, _ = _run(client, f"grep -E '^WEBHOOK_SECRET=' {VM_BASE}/.env | head -1")
    webhook_secret = ws.split("=", 1)[1].strip().strip('"').strip("'") if ws and "=" in ws else ""

    rows = [r for r in out.strip().splitlines() if "|" in r]
    print(f"  Found {len(rows)} artifact(s)")
    for row in rows[:6]:
        parts = [p.strip() for p in row.split("|")]
        if len(parts) >= 2:
            art_id = parts[0]
            fname = parts[1]
            print(f"    {art_id[:8]}… {fname}")

            # Call FastAPI internally to trigger suggest-controls (which generates embeddings on-the-fly)
            trigger_cmd = (
                f"curl -sf -X POST http://localhost:8000/api/artifacts/{art_id}/suggest-controls "
                f"-H 'X-Webhook-Secret: {webhook_secret}' "
                f"-H 'Content-Type: application/json' "
                f"-o /dev/null -w '%{{http_code}}' 2>/dev/null"
            )
            rc4, http_code, _ = _run(client, trigger_cmd, timeout=30)
            print(f"      → HTTP {http_code}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("All-in-one Fix: Deploy + Authentik + Embeddings")
    print("=" * 60)

    client = _connect()
    print(f"Connected to {VM_HOST}")

    try:
        sync_files(client)
        patch_env(client)
        restart_fastapi(client)
        rebuild_nextjs(client)
        fix_authentik(client)
        trigger_embeddings(client)
    finally:
        client.close()

    print("\n" + "=" * 60)
    print("All steps complete.")
    print("=" * 60)


if __name__ == "__main__":
    main()
