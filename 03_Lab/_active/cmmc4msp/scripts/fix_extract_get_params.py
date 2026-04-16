#!/usr/bin/env python3
"""
Fix n8n 'Extract Text via FastAPI' node to use GET with query parameters.
Static URL + query params avoids all n8n v1 body/expression issues.
artifact_id from $('Webhook').first().json.body.artifact_id (known to work in this workflow).
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Extract Text via FastAPI"

def psql_file(local_path, remote_path):
    subprocess.run(["docker", "cp", local_path, f"cmmc-postgres:{remote_path}"])
    r = subprocess.run(
        ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME, "-f", remote_path],
        capture_output=True, text=True
    )
    print(r.stdout.strip(), r.stderr.strip())
    return r

# Fetch current nodes
r = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes = json.loads(r.stdout.strip())

NEW_NODE = {
    "parameters": {
        "url": "http://fastapi:8000/api/artifacts/extract",
        "method": "GET",
        "queryParameters": {
            "parameters": [
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
    },
    "name": TARGET,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [900, 300]
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET:
        print(f"Found '{TARGET}' at index {i}, type={node.get('type')}")
        NEW_NODE["position"] = node.get("position", [900, 300])
        nodes[i] = NEW_NODE
        updated = True
        break

if not updated:
    print("ERROR: node not found!")
    exit(1)

new_json = json.dumps(nodes)

# Update workflow_entity
sql1 = f"UPDATE workflow_entity SET nodes = $tag${new_json}$tag$::jsonb WHERE id = '{WF_ID}';\n"
with open("/tmp/fix_ge1.sql", "w") as f:
    f.write(sql1)
print("workflow_entity:")
psql_file("/tmp/fix_ge1.sql", "/tmp/fix_ge1.sql")

# Update workflow_history (sync nodes from workflow_entity)
sql2 = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');
"""
with open("/tmp/fix_ge2.sql", "w") as f:
    f.write(sql2)
print("workflow_history:")
psql_file("/tmp/fix_ge2.sql", "/tmp/fix_ge2.sql")

print("\nDone — deactivate/reactivate workflow to reload.")
