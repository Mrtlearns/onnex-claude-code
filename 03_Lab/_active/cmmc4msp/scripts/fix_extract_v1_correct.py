#!/usr/bin/env python3
"""
Fix Extract Text node using CORRECT n8n v1 HTTP Request parameter names.

Execution data revealed that n8n v1 uses:
  - requestMethod  (NOT method)
  - headerParametersJson  (NOT headerParameters.parameters when jsonParameters=true)
  - bodyParametersJson  (with jsonParameters=true)

Our stored params had 'method' and 'headerParameters.parameters' which v1 ignores,
causing it to default to GET with no headers/body.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Extract Text via FastAPI"
NODE_ID = "a1b2c3d4-0002-0002-0002-000000000004"

def run_sql(sql):
    r = subprocess.run(
        ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
         "-c", sql],
        capture_output=True, text=True
    )
    print(r.stdout.strip())
    if r.stderr.strip():
        print("STDERR:", r.stderr.strip())

r = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes = json.loads(r.stdout.strip())

# CORRECT v1 parameter names as observed in execution_data:
# - requestMethod (not method)
# - jsonParameters: true → use bodyParametersJson + headerParametersJson
# - headerParametersJson: JSON object {"header": "value"}
# FastAPI endpoint accepts secret in body, so no header needed for auth
NEW_PARAMS = {
    "requestMethod": "POST",
    "url": "http://fastapi:8000/api/artifacts/extract",
    "jsonParameters": True,
    "bodyParametersJson": "={{ JSON.stringify({ artifact_id: $('Webhook').first().json.body.artifact_id, secret: 'cmmc4msp-webhook-2026' }) }}",
    "headerParametersJson": "{\"X-Webhook-Secret\": \"cmmc4msp-webhook-2026\"}",
    "options": {"timeout": 30000}
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET:
        print(f"Found '{TARGET}' at index {i}")
        print(f"  Old requestMethod: {node.get('parameters', {}).get('requestMethod', 'NOT SET')}")
        print(f"  Old method: {node.get('parameters', {}).get('method', 'NOT SET')}")
        node["parameters"] = NEW_PARAMS
        node["id"] = NODE_ID
        node["typeVersion"] = 1
        updated = True
        print(f"  New requestMethod: {NEW_PARAMS['requestMethod']}")
        break

if not updated:
    print("ERROR: node not found!")
    exit(1)

new_json = json.dumps(nodes)

# Update workflow_entity
sql_entity = f"UPDATE workflow_entity SET nodes = $tag${new_json}$tag$::jsonb WHERE id = '{WF_ID}';"
run_sql(sql_entity)
print("workflow_entity updated")

# Sync to workflow_history active version
sql_history = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');"""
run_sql(sql_history)
print("workflow_history updated")

# Verify
r2 = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes_check = json.loads(r2.stdout.strip())
for n in nodes_check:
    if n.get("name") == TARGET:
        p = n.get("parameters", {})
        print(f"\nVerification:")
        print(f"  requestMethod: {p.get('requestMethod')}")
        print(f"  url: {p.get('url')}")
        print(f"  jsonParameters: {p.get('jsonParameters')}")
        print(f"  bodyParametersJson (start): {str(p.get('bodyParametersJson', ''))[:80]}")
        print(f"  headerParametersJson: {p.get('headerParametersJson')}")
        break

print("\nDone.")
