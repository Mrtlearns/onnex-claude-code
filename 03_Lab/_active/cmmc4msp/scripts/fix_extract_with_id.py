#!/usr/bin/env python3
"""
Fix n8n 'Extract Text via FastAPI' node — restore node id and use correct v1 params.
Without id, n8n may not load node parameters. Original id was a1b2c3d4-0002-0002-0002-000000000004.
Using query parameters (GET) with correct v1 format.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Extract Text via FastAPI"
# Original node id from first workflow import
ORIGINAL_NODE_ID = "a1b2c3d4-0002-0002-0002-000000000004"

def run_sql_file(local_path, remote_path):
    subprocess.run(["docker", "cp", local_path, f"cmmc-postgres:{remote_path}"])
    r = subprocess.run(
        ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME, "-f", remote_path],
        capture_output=True, text=True
    )
    print(r.stdout.strip(), r.stderr.strip())

# Fetch current nodes
r = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes = json.loads(r.stdout.strip())

# Print current Extract Text node
for n in nodes:
    if n.get("name") == TARGET:
        print("Current node id:", n.get("id"))
        print("Current params:", json.dumps(n.get("parameters", {})))
        break

# n8n HTTP Request v1 query params: correct format with node id restored
NEW_NODE = {
    "id": ORIGINAL_NODE_ID,
    "name": TARGET,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [900, 300],
    "parameters": {
        "url": "http://fastapi:8000/api/artifacts/extract",
        "method": "GET",
        "addQueryParameters": True,
        "queryParameters": {
            "parameter": [
                {
                    "name": "artifact_id",
                    "value": "={{ $('Webhook').first().json.body.artifact_id }}"
                },
                {
                    "name": "secret",
                    "value": "cmmc4msp-webhook-2026"
                }
            ]
        },
        "options": {}
    }
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET:
        NEW_NODE["position"] = node.get("position", [900, 300])
        nodes[i] = NEW_NODE
        updated = True
        print(f"Replaced node at index {i}")
        break

if not updated:
    print("ERROR: node not found!")
    exit(1)

new_json = json.dumps(nodes)

sql1 = f"UPDATE workflow_entity SET nodes = $tag${new_json}$tag$::jsonb WHERE id = '{WF_ID}';\n"
with open("/tmp/fix_id1.sql", "w") as f:
    f.write(sql1)
print("Updating workflow_entity...")
run_sql_file("/tmp/fix_id1.sql", "/tmp/fix_id1.sql")

sql2 = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');\n"""
with open("/tmp/fix_id2.sql", "w") as f:
    f.write(sql2)
print("Updating workflow_history...")
run_sql_file("/tmp/fix_id2.sql", "/tmp/fix_id2.sql")

print("\nDone.")
