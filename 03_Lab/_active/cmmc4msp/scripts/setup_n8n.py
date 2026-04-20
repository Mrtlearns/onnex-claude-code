"""Set up n8n: fix workflow ownership, create credentials, activate workflows."""
import subprocess, json, sys, os

from _secrets import require

PG_PASSWORD = require(
    "PG_APP_PASSWORD",
    prompt="Postgres cmmc_app password: ",
)
WEBHOOK_SECRET = require(
    "FASTAPI_WEBHOOK_SECRET",
    prompt="FastAPI webhook secret (X-Webhook-Secret): ",
)

def psql(sql, db="n8n_db"):
    r = subprocess.run(
        ["docker", "exec", "-i", "cmmc-postgres", "psql",
         "-U", "cmmc_app", "-d", db, "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip(), r.stderr.strip()

def psql_at(sql, db="n8n_db"):
    """Return unformatted output (-At)."""
    r = subprocess.run(
        ["docker", "exec", "-i", "cmmc-postgres", "psql",
         "-U", "cmmc_app", "-d", db, "-At", "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip(), r.stderr.strip()

print("=== Step 1: Check shared_workflow structure ===")
out, _ = psql(r"\d shared_workflow")
print(out)

print("\n=== Step 2: Check existing shared_workflow entries ===")
out, _ = psql('SELECT * FROM shared_workflow LIMIT 5')
print(out)

# Get all workflow IDs
out, _ = psql_at('SELECT id FROM workflow_entity')
workflow_ids = [line for line in out.split('\n') if line.strip()]
print(f"\nWorkflows to share: {len(workflow_ids)}")

# Get project ID
proj_out, _ = psql_at("SELECT id FROM project WHERE type='personal' LIMIT 1")
project_id = proj_out.strip()
print(f"Personal project ID: {project_id}")

# Get user ID
user_out, _ = psql_at('SELECT id FROM "user" LIMIT 1')
user_id = user_out.strip()
print(f"User ID: {user_id}")

print("\n=== Step 3: Share all workflows with personal project ===")
for wf_id in workflow_ids:
    sql = (
        f"INSERT INTO shared_workflow (\"workflowId\", \"projectId\", role) "
        f"VALUES ('{wf_id}', '{project_id}', 'workflow:owner') "
        f"ON CONFLICT DO NOTHING"
    )
    out, err = psql(sql)
    status = "OK" if not err else f"ERR: {err}"
    print(f"  {wf_id[:8]}... {status}")

print("\n=== Step 4: Create Postgres credential for n8n ===")
import os, hashlib, json as json_mod

# Credentials in n8n are stored encrypted - we need to use n8n's own
# credential import mechanism instead of raw DB insert.
# Instead, let's use the n8n REST API to create credentials.

N8N_API_KEY = "n8n-cmmc4msp-deploy-key-2026"
N8N_URL = "http://localhost:5678"

import urllib.request, urllib.error

def n8n_api(method, path, body=None):
    url = f"{N8N_URL}{path}"
    data = json_mod.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url, data=data, method=method,
        headers={
            "X-N8N-API-KEY": N8N_API_KEY,
            "Content-Type": "application/json"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json_mod.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": e.code, "body": e.read().decode()}

# Test API
result = n8n_api("GET", "/api/v1/workflows")
print(f"Workflows visible via API: {len(result.get('data', []))}")

print("\n=== Step 5: Create credentials via n8n API ===")
# Postgres credential
pg_cred = n8n_api("POST", "/api/v1/credentials", {
    "name": "CMMC4MSP Postgres",
    "type": "postgres",
    "data": {
        "host": "postgres",
        "port": 5432,
        "database": "cmmc_main",
        "user": "cmmc_app",
        "password": PG_PASSWORD,
        "ssl": "disable"
    }
})
print(f"Postgres credential: {pg_cred.get('id', pg_cred.get('error', 'unknown'))}")

# HTTP Header Auth credential for FastAPI webhook secret
webhook_cred = n8n_api("POST", "/api/v1/credentials", {
    "name": "CMMC4MSP Webhook Secret",
    "type": "httpHeaderAuth",
    "data": {
        "name": "X-Webhook-Secret",
        "value": WEBHOOK_SECRET
    }
})
print(f"Webhook credential: {webhook_cred.get('id', webhook_cred.get('error', 'unknown'))}")

print("\n=== Step 6: Activate workflows 01-04 (core, no Anthropic needed) ===")
# Workflow IDs we know
WORKFLOW_IDS = {
    "01": "0b94eab2-87a1-527d-8dd6-05b48162278d",
    "03": "6534ce61-8765-524e-ab4b-3e33c8846adb",
    "04": "5ef330f0-2dbf-56de-95bc-6ac4213bd988",
    "07": "3636f908-0bdb-51a6-9da2-1338e6c807bf",
}

# Check current workflow list via API first
wf_list = n8n_api("GET", "/api/v1/workflows")
print(f"Workflows via API after share fix: {len(wf_list.get('data', []))}")

print("\nDone.")
