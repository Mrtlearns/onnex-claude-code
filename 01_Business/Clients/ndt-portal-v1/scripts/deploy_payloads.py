#!/usr/bin/env python3
"""
Deploy WF-5 payload enrichment patch + frontend rebuild.

Steps:
  1. Upload + run patch_wf5_payloads.py on server
  2. Push patched WF-5 to n8n API
  3. Pull patched WF-5 JSON back to local
  4. Rebuild + restart frontend container
"""
import io, json, os, paramiko

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.join(HERE, '..')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.10.110.32', username='root', password='Poll0000',
            timeout=10, look_for_keys=False, allow_agent=False)
ssh.get_transport().set_keepalive(30)


def run(cmd, timeout=180):
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


# ── 1. Upload + run WF-5 payload patch ────────────────────────────────────
print("=== Phase 1: WF-5 payload enrichment patch ===")
patch_script = open(os.path.join(HERE, 'patch_wf5_payloads.py'), encoding='utf-8').read()
upload_bytes(patch_script.encode('utf-8'), '/tmp/patch_wf5_payloads.py')

out, err, rc = run("python3 /tmp/patch_wf5_payloads.py", timeout=30)
print(f"  OUT:\n{out.encode('ascii', errors='replace').decode('ascii')}")
if err.strip():
    print(f"  ERR: {err.encode('ascii', errors='replace').decode('ascii')}")
if rc != 0:
    raise RuntimeError(f"WF-5 payload patch failed (rc={rc})")


# ── 2. Push patched WF-5 to n8n API ───────────────────────────────────────
print("\n=== Phase 2: Push patched WF-5 to n8n ===")

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
        print(f'SUCCESS {{resp.status}}: {{body[:200]}}')
except urllib.error.HTTPError as e:
    body = e.read().decode('utf-8', errors='replace')
    print(f'ERROR {{e.code}}: {{body[:500]}}')
    raise
"""
upload_bytes(push_py.encode('utf-8'), '/tmp/push_wf5_payloads.py')
out, err, rc = run("python3 /tmp/push_wf5_payloads.py", timeout=30)
print(f"  OUT: {out.strip()}")
if err.strip():
    print(f"  ERR: {err.strip()}")
if rc != 0:
    raise RuntimeError(f"WF-5 push to n8n failed (rc={rc})")


# ── 3. Pull patched WF-5 JSON back to local ───────────────────────────────
print("\n=== Phase 3: Pull patched WF-5 JSON back to local ===")
local_wf5 = os.path.join(REPO, 'n8n-workflows/WF-5-pipeline-orchestrator.json')
sftp = ssh.open_sftp()
sftp.get('/opt/ndt-portal/n8n-workflows/WF-5-pipeline-orchestrator.json', local_wf5)
sftp.close()
print(f"  Saved to {local_wf5}")


# ── 4. Rebuild + restart frontend ─────────────────────────────────────────
print("\n=== Phase 4: Upload frontend src + rebuild ===")

# Upload changed frontend files
frontend_files = [
    ('frontend/src/components/analysis/ExecutionLogViewer.tsx',
     '/opt/ndt-portal/frontend/src/components/analysis/ExecutionLogViewer.tsx'),
    ('frontend/src/components/analysis/PipelineHistory.tsx',
     '/opt/ndt-portal/frontend/src/components/analysis/PipelineHistory.tsx'),
    ('frontend/src/components/analysis/AnalysisPage.tsx',
     '/opt/ndt-portal/frontend/src/components/analysis/AnalysisPage.tsx'),
    ('frontend/src/App.tsx',
     '/opt/ndt-portal/frontend/src/App.tsx'),
]

for local_rel, remote_path in frontend_files:
    local_path = os.path.join(REPO, local_rel)
    upload_file(local_path, remote_path)
    print(f"  Uploaded: {local_rel}")

# Build frontend
out, err, rc = run(
    "cd /opt/ndt-portal/frontend && npm run build 2>&1",
    timeout=180
)
print(f"  Build OUT (last 500 chars): {out[-500:].encode('ascii', errors='replace').decode('ascii')}")
if rc != 0:
    print(f"  Build ERR: {err[-200:].encode('ascii', errors='replace').decode('ascii')}")
    raise RuntimeError(f"Frontend build failed (rc={rc})")
print("  Frontend built successfully")

# Restart frontend container
out, err, rc = run("cd /opt/ndt-portal && docker compose restart frontend 2>&1", timeout=30)
print(f"  Restart: {out.strip()}")
print("  Frontend container restarted")

ssh.close()
print("\n=== Deploy complete ===")
print("Verify:")
print("  1. /audit          — Pipeline History list")
print("  2. /audit/:id      — Audit log with navigation back to /analysis/:id")
print("  3. /analysis/:id   — 'Audit Log' button navigates in-app (not new tab)")
print("  4. Trigger a pipeline run — request_sent events should have 'prompt' and 'llm' badges")
