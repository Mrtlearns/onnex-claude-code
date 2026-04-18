"""
fix_authentik_demo_users.py

1. SSH → get meridian-defense org UUID from Postgres
2. PATCH Authentik user attributes for demo users (org_id, role)
   so OIDC scope mapping emits correct claims
"""
from __future__ import annotations

import json
import sys
import urllib.request
import urllib.error
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _secrets import vm_ssh, authentik


DEMO_USERS = [
    {"pk": 9,  "email": "admin@meridian-defense.demo",    "role": "client_admin"},
    {"pk": 10, "email": "engineer@meridian-defense.demo", "role": "client_user"},
    {"pk": 11, "email": "auditor@meridian-defense.demo",  "role": "client_user"},
]


def _ssh():
    import paramiko
    host, user, password = vm_ssh()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=user, password=password, timeout=20)
    return c, password


def _run(client, cmd, timeout=30):
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def get_org_id(client, password) -> str:
    """Query meridian-defense org UUID from Postgres."""
    sql = "SELECT id FROM orgs WHERE slug='meridian-defense' LIMIT 1"
    cmd = f'echo {json.dumps(password)} | sudo -S docker exec cmmc4msp-postgres-1 psql -U cmmc -d cmmc_main -tAc {json.dumps(sql)}'
    rc, out, err = _run(client, cmd)
    if rc != 0 or not out:
        # Try alternate DB name
        cmd2 = f'echo {json.dumps(password)} | sudo -S docker exec cmmc4msp-postgres-1 psql -U cmmc -d cmmc4msp -tAc {json.dumps(sql)}'
        rc, out, err = _run(client, cmd2)
    org_id = out.strip()
    if not org_id:
        raise RuntimeError(f"Could not find meridian-defense org. RC={rc} err={err}")
    return org_id


def _authentik_patch(base_url: str, token: str, pk: int, attributes: dict) -> None:
    url = f"{base_url.rstrip('/')}/api/v3/core/users/{pk}/"
    payload = json.dumps({"attributes": attributes}).encode()
    req = urllib.request.Request(
        url,
        data=payload,
        method="PATCH",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read())
            print(f"  OK  pk={pk} {body.get('email')} → {body.get('attributes')}")
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        print(f"  ERR pk={pk} HTTP {e.code}: {body[:200]}")
    except Exception as ex:
        print(f"  ERR pk={pk}: {ex}")


def main():
    print("=" * 60)
    print("Fix Authentik Demo User Attributes")
    print("=" * 60)

    # Get Authentik creds
    auth_url, auth_token = authentik()
    print(f"\nAuthentik: {auth_url}")

    # Get org UUID from DB
    print("\n[Step 1] Get meridian-defense org ID from DB...")
    client, password = _ssh()
    try:
        org_id = get_org_id(client, password)
    finally:
        client.close()
    print(f"  org_id = {org_id}")

    # Patch Authentik users
    print("\n[Step 2] Patching Authentik user attributes...")
    for user in DEMO_USERS:
        attrs = {"org_id": org_id, "role": user["role"], "msp_id": ""}
        print(f"  PATCH pk={user['pk']} ({user['email']}) → role={user['role']}, org_id={org_id}")
        _authentik_patch(auth_url, auth_token, user["pk"], attrs)

    print("\nDone. Demo users should now emit correct OIDC claims on next login.")
    print("=" * 60)


if __name__ == "__main__":
    main()
