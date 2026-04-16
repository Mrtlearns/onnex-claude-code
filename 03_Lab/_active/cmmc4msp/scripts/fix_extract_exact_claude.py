#!/usr/bin/env python3
"""
Set Extract Text node to EXACTLY match Claude Assessment format.
Claude Assessment works → replicate its structure with minor changes.
Key: jsonParameters:true + bodyParametersJson (not bodyParameters form format).
FastAPI endpoint will accept JSON body (Pydantic).
Uses $('Webhook').first().json.body.artifact_id (NOT $json.id which may fail).
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Extract Text via FastAPI"
NODE_ID = "a1b2c3d4-0002-0002-0002-000000000004"

def run_sql_file(local_path, remote_path):
    subprocess.run(["docker", "cp", local_path, f"cmmc-postgres:{remote_path}"])
    r = subprocess.run(
        ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME, "-f", remote_path],
        capture_output=True, text=True
    )
    print(r.stdout.strip(), r.stderr.strip())

r = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes = json.loads(r.stdout.strip())

# EXACT structure matching Claude Assessment (which works):
# url, method, options, sendBody, sendHeaders, jsonParameters, headerParameters, bodyParametersJson
# Use $('Webhook').first().json.body.artifact_id (works in Fetch Control Details etc.)
NEW_NODE = {
    "id": NODE_ID,
    "name": TARGET,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [900, 300],
    "parameters": {
        "url": "http://fastapi:8000/api/artifacts/extract",
        "method": "POST",
        "options": {
            "timeout": 30000
        },
        "sendBody": True,
        "sendHeaders": True,
        "jsonParameters": True,
        "headerParameters": {
            "parameters": [
                {
                    "name": "X-Webhook-Secret",
                    "value": "cmmc4msp-webhook-2026"
                }
            ]
        },
        "bodyParametersJson": "={{ JSON.stringify({ artifact_id: $('Webhook').first().json.body.artifact_id, secret: 'cmmc4msp-webhook-2026' }) }}"
    }
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET:
        print(f"Found '{TARGET}' at index {i}")
        NEW_NODE["position"] = node.get("position", [900, 300])
        nodes[i] = NEW_NODE
        updated = True
        break

if not updated:
    print("ERROR: not found!")
    exit(1)

new_json = json.dumps(nodes)

sql1 = f"UPDATE workflow_entity SET nodes = $tag${new_json}$tag$::jsonb WHERE id = '{WF_ID}';\n"
with open("/tmp/fix_claude1.sql", "w") as f:
    f.write(sql1)
print("workflow_entity:")
run_sql_file("/tmp/fix_claude1.sql", "/tmp/fix_claude1.sql")

sql2 = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');\n"""
with open("/tmp/fix_claude2.sql", "w") as f:
    f.write(sql2)
print("workflow_history:")
run_sql_file("/tmp/fix_claude2.sql", "/tmp/fix_claude2.sql")

print("\nDone.")
