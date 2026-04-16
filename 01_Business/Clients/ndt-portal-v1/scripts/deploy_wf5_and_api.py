#!/usr/bin/env python3
"""
Deploy WF-5 to n8n via API (server-side) and update Express API with
intake_id linkage + GET /pipeline/logs/:quoteId endpoint.
Runs entirely on the server to avoid encoding issues.
"""
import paramiko, json, sys, os

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('10.10.110.32', username='root', password='Poll0000')

def run(cmd, timeout=120):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    return out, err

# ── 1. Upload WF-5 JSON to server ──────────────────────────────
print("=== Uploading WF-5 JSON to server ===")
local_wf = os.path.join(os.path.dirname(__file__), '..', 'n8n-workflows', 'WF-5-pipeline-orchestrator.json')
with open(local_wf, 'r', encoding='utf-8') as f:
    wf_data = json.load(f)

sftp = ssh.open_sftp()
sftp.put(local_wf, '/tmp/WF-5-pipeline-orchestrator.json')
sftp.close()
print("  Uploaded to /tmp/WF-5-pipeline-orchestrator.json")

# ── 2. Push WF-5 to n8n API from server ────────────────────────
print("\n=== Pushing WF-5 to n8n API ===")
N8N_BASE = 'http://172.18.0.8:5678'
N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJlYmZmZjg1Yi0xY2JiLTQ4MTUtYWQwNS02ZWIzZjg3YTc1ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMjI1NmRmZDAtY2ViYS00YjIxLWIyNzItYWNjMTFjZDI2MjAwIiwiaWF0IjoxNzczNzQ3MzQyfQ.gyB9urCR1BzlBESEWaL-f-liSvkElWC0IEmb5f6No08'
WF_ID = 'Eu0F0n3h1w0owXc7'

push_script = f"""
import json, urllib.request, urllib.error

N8N_BASE = '{N8N_BASE}'
N8N_KEY = '{N8N_KEY}'
WF_ID = '{WF_ID}'

with open('/tmp/WF-5-pipeline-orchestrator.json', 'r', encoding='utf-8') as f:
    wf = json.load(f)

# Strip read-only fields
for field in ['id', 'createdAt', 'updatedAt', 'active', 'isArchived']:
    wf.pop(field, None)

payload = json.dumps(wf).encode('utf-8')
url = f'{{N8N_BASE}}/api/v1/workflows/{{WF_ID}}'
req = urllib.request.Request(
    url,
    data=payload,
    headers={{
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': N8N_KEY,
    }},
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

run(f"python3 -c \"{push_script.replace(chr(34), chr(39)).replace(chr(10), ';')}\"")

# Write as a file instead to avoid quoting issues
with ssh.open_sftp() as sftp:
    import io
    script_bytes = push_script.encode('utf-8')
    sftp.putfo(io.BytesIO(script_bytes), '/tmp/push_wf5.py')

out, err = run("python3 /tmp/push_wf5.py")
print(f"  OUT: {out.strip()}")
if err.strip():
    print(f"  ERR: {err.strip()}")

ssh.close()
print("\nDone.")
