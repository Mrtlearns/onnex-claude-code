#!/usr/bin/env python3
"""
Update Extract Text via FastAPI node via n8n REST API.
Uses PUT /api/v1/workflows/{id} to properly update through n8n's internal layer.
"""
import subprocess, json, sys

N8N_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZjMwMDE0NS1jOTUzLTQ1ZWUtOGE3ZC0yZGU5N2NmMjA1YzciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzhkNzlmZjMtYmViNS00ZWQ0LWIwOWQtZDJiMTNhMDFhZDJkIiwiaWF0IjoxNzc2MzAxNjM2fQ.WvWO-V6NwWmkE1gaO8R6W79w8Fi_60gobg6169Ps_bI"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
BASE = "https://n8n.cmmc4msp.on-nex.us/api/v1"
TARGET = "Extract Text via FastAPI"

# Get current workflow from n8n API
r = subprocess.run(
    ["curl", "-s", f"{BASE}/workflows/{WF_ID}",
     "-H", f"X-N8N-API-KEY: {N8N_KEY}"],
    capture_output=True, text=True
)
wf = json.loads(r.stdout)
print(f"Got workflow: {wf.get('name')}, nodes: {len(wf.get('nodes',[]))}")

# Find and update Extract Text node
updated = False
for i, node in enumerate(wf.get("nodes", [])):
    if node.get("name") == TARGET:
        print(f"Found '{TARGET}' at index {i}")
        print(f"  Current type: {node.get('type')}, typeVersion: {node.get('typeVersion')}")
        print(f"  Current params (truncated): {str(node.get('parameters',{}))[:200]}")

        # Use EXACT same format as Claude Assessment (which works):
        # - bodyParametersJson (NOT bodyParameters)
        # - jsonParameters: true
        # - static header with X-Webhook-Secret
        node["type"] = "n8n-nodes-base.httpRequest"
        node["typeVersion"] = 1
        node["parameters"] = {
            "url": "http://fastapi:8000/api/artifacts/extract",
            "method": "POST",
            "options": {"timeout": 30000},
            "sendBody": True,
            "sendHeaders": True,
            "jsonParameters": True,
            "headerParameters": {
                "parameters": [
                    {"name": "X-Webhook-Secret", "value": "cmmc4msp-webhook-2026"}
                ]
            },
            "bodyParametersJson": "={{ JSON.stringify({ artifact_id: $('Webhook').first().json.body.artifact_id, secret: 'cmmc4msp-webhook-2026' }) }}"
        }
        updated = True
        break

if not updated:
    print(f"ERROR: '{TARGET}' not found!")
    sys.exit(1)

# Write to temp file
payload = json.dumps(wf)
with open("/tmp/workflow_update.json", "w") as f:
    f.write(payload)
print(f"Payload size: {len(payload)} bytes")

# PUT via curl with file input
r2 = subprocess.run(
    ["curl", "-s", "-X", "PUT", f"{BASE}/workflows/{WF_ID}",
     "-H", f"X-N8N-API-KEY: {N8N_KEY}",
     "-H", "Content-Type: application/json",
     "-d", f"@/tmp/workflow_update.json"],
    capture_output=True, text=True
)

try:
    result = json.loads(r2.stdout)
    n = next((x for x in result.get("nodes", []) if x.get("name") == TARGET), {})
    print(f"\nAPI update result:")
    print(f"  Workflow: {result.get('name')}")
    print(f"  Node method: {n.get('parameters', {}).get('method')}")
    print(f"  jsonParameters: {n.get('parameters', {}).get('jsonParameters')}")
    print(f"  sendBody: {n.get('parameters', {}).get('sendBody')}")
    print(f"  bodyParametersJson (start): {str(n.get('parameters', {}).get('bodyParametersJson', ''))[:80]}")
except Exception as e:
    print(f"Parse error: {e}")
    print(f"Response: {r2.stdout[:500]}")
