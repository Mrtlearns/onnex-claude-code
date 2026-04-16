#!/usr/bin/env python3
"""
Deploy 00-Pre-Processing pseudo-inspection-type.

Steps:
  1. Run SQL migration: add 'system' to action_type CHECK constraint
  2. Run SQL seed: insert 00-PRE type + 7 steps
  3. Upload changed inspection-types.ts + rebuild API + restart api container
  4. Upload + run patch_wf5_preproc.py on server (patches WF-5 JSON)
  5. Push patched WF-5 to n8n API
  6. Pull back updated WF-5 JSON to local repo
"""
import io, json, os, paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.10.110.32', username='root', password='Poll0000',
            timeout=10, look_for_keys=False, allow_agent=False)
ssh.get_transport().set_keepalive(30)


def run(cmd, timeout=120):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc  = stdout.channel.recv_exit_status()
    return out, err, rc


def upload_bytes(data: bytes, remote_path: str):
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(data), remote_path)
    sftp.close()


def upload_file(local_path: str, remote_path: str):
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()


# ── 1. SQL migration ──────────────────────────────────────────────────────────
print("=== Phase 1: SQL migration — add 'system' action_type ===")
migration_sql = open(os.path.join(REPO, 'db/migrations/003_add_system_action_type.sql'),
                     encoding='utf-8').read()
upload_bytes(migration_sql.encode('utf-8'), '/tmp/003_add_system_action_type.sql')
run("docker cp /tmp/003_add_system_action_type.sql ndt-portal-postgres-1:/tmp/")
out, err, rc = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -f /tmp/003_add_system_action_type.sql"
)
print(f"  OUT: {out.strip()}")
if err.strip():
    print(f"  ERR: {err.strip()}")
if rc != 0:
    print(f"  WARNING: exit code {rc} — constraint may already exist, continuing...")

# ── 2. SQL seed ───────────────────────────────────────────────────────────────
print("\n=== Phase 2: SQL seed — insert 00-PRE type + 7 steps ===")
seed_sql = open(os.path.join(REPO, 'db/seeds/seed_preproc.sql'),
                encoding='utf-8').read()
upload_bytes(seed_sql.encode('utf-8'), '/tmp/seed_preproc.sql')
run("docker cp /tmp/seed_preproc.sql ndt-portal-postgres-1:/tmp/")
out, err, rc = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -f /tmp/seed_preproc.sql"
)
print(f"  OUT: {out.strip()}")
if err.strip():
    print(f"  ERR: {err.strip()}")
if rc != 0:
    raise RuntimeError(f"Seed SQL failed (rc={rc})")

# Verify
out, _, _ = run(
    "docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -c "
    "\"SELECT code, label, sort_order FROM app.inspection_types ORDER BY sort_order, code;\""
)
print(f"  Inspection types:\n{out.strip()}")

# ── 3. API rebuild ────────────────────────────────────────────────────────────
print("\n=== Phase 3: Upload inspection-types.ts + rebuild API ===")
local_api_ts = os.path.join(REPO, 'api/src/routes/inspection-types.ts')
upload_file(local_api_ts, '/opt/ndt-portal/api/src/routes/inspection-types.ts')
print("  Uploaded inspection-types.ts")

out, err, rc = run(
    "cd /opt/ndt-portal/api && node node_modules/.bin/tsc 2>&1",
    timeout=60
)
print(f"  TSC OUT: {out.strip()}")
if err.strip():
    print(f"  TSC ERR: {err.strip()}")
if rc != 0:
    raise RuntimeError(f"TypeScript compilation failed (rc={rc})")
print("  TypeScript compiled successfully")

out, err, rc = run(
    "cd /opt/ndt-portal && docker compose restart api 2>&1",
    timeout=30
)
print(f"  Restart OUT: {out.strip()}")
if err.strip():
    print(f"  Restart ERR: {err.strip()}")
print("  API container restarted")

# ── 4. WF-5 patch ─────────────────────────────────────────────────────────────
print("\n=== Phase 4: Upload + run WF-5 patch script ===")
patch_script = open(os.path.join(HERE, 'patch_wf5_preproc.py'), encoding='utf-8').read()
upload_bytes(patch_script.encode('utf-8'), '/tmp/patch_wf5_preproc.py')

out, err, rc = run("python3 /tmp/patch_wf5_preproc.py", timeout=30)
print(f"  OUT:\n{out.encode('ascii', errors='replace').decode('ascii')}")
if err.strip():
    print(f"  ERR: {err.encode('ascii', errors='replace').decode('ascii')}")
if rc != 0:
    raise RuntimeError(f"WF-5 patch script failed (rc={rc})")

# ── 5. Push patched WF-5 to n8n API ──────────────────────────────────────────
print("\n=== Phase 5: Push patched WF-5 to n8n ===")

N8N_BASE = 'http://172.18.0.8:5678'
N8N_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYmZmZjg1Yi0xY2JiLTQ4MTUtYWQwNS02ZWIzZjg3YTc1ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjI1NmRmZDAtY2ViYS00YjIxLWIyNzItYWNjMTFjZDI2MjAwIiwiaWF0IjoxNzczNzQ3MzQyfQ.gyB9urCR1BzlBESEWaL-f-liSvkElWC0IEmb5f6No08'
WF_ID    = 'Eu0F0n3h1w0owXc7'

push_py = f"""
import json, urllib.request, urllib.error
N8N_BASE = '{N8N_BASE}'
N8N_KEY  = '{N8N_KEY}'
WF_ID    = '{WF_ID}'
WF5_PATH = '/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json'

with open(WF5_PATH, 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Only send fields accepted by n8n PUT /workflows/ID
allowed = ['name', 'nodes', 'connections', 'settings']
wf_payload = {{k: wf[k] for k in allowed if k in wf}}

payload = json.dumps(wf_payload).encode('utf-8')
url = f'{{N8N_BASE}}/api/v1/workflows/{{WF_ID}}'
req = urllib.request.Request(
    url, data=payload,
    headers={{'Content-Type': 'application/json', 'X-N8N-API-KEY': N8N_KEY, 'Content-Length': str(len(payload))}},
    method='PUT'
)
try:
    with urllib.request.urlopen(req) as resp:
        body = resp.read().decode('utf-8', errors='replace')
        print(f'SUCCESS {{resp.status}}: {{body[:300]}}')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'ERROR {{e.code}}: {{body[:500]}}')
    raise
"""
upload_bytes(push_py.encode('utf-8'), '/tmp/push_wf5_preproc.py')
out, err, rc = run("python3 /tmp/push_wf5_preproc.py", timeout=30)
print(f"  OUT: {out.strip()}")
if err.strip():
    print(f"  ERR: {err.strip()}")
if rc != 0:
    raise RuntimeError(f"WF-5 push to n8n failed (rc={rc})")

# ── 6. Pull back patched WF-5 JSON to local ───────────────────────────────────
print("\n=== Phase 6: Pull patched WF-5 JSON back to local ===")
local_wf5 = os.path.join(REPO, 'n8n-workflows/WF-5-pipeline-orchestrator.json')
sftp = ssh.open_sftp()
sftp.get('/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json', local_wf5)
sftp.close()
print(f"  Saved to {local_wf5}")

ssh.close()
print("\n=== Deploy complete ===")
print("Verify: Settings → Inspection Types should show '00-Pre-Processing' at the top with 7 steps.")
