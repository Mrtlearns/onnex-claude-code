#!/usr/bin/env python3
"""
Fix n8n HTTP Request v1 query parameters format.
n8n v1 uses "parameter" (singular) not "parameters" (plural).
Also needs "addQueryParameters": true to enable them.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Extract Text via FastAPI"

def run_sql_file(local_path, remote_path):
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

# Correct n8n HTTP Request v1 query parameters format:
# - "addQueryParameters": true  (enables query param section)
# - "queryParameters": {"parameter": [{name, value}]}  (note: "parameter" singular)
NEW_NODE = {
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
    },
    "name": TARGET,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [900, 300]
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET:
        print(f"Found '{TARGET}': type={node.get('type')}, typeVersion={node.get('typeVersion')}")
        print(f"Current params: {json.dumps(node.get('parameters', {}), indent=2)[:300]}")
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
with open("/tmp/fix_qp1.sql", "w") as f:
    f.write(sql1)
print("\nUpdating workflow_entity...")
run_sql_file("/tmp/fix_qp1.sql", "/tmp/fix_qp1.sql")

# Sync workflow_history
sql2 = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');\n"""
with open("/tmp/fix_qp2.sql", "w") as f:
    f.write(sql2)
print("Updating workflow_history...")
run_sql_file("/tmp/fix_qp2.sql", "/tmp/fix_qp2.sql")

print("\nDone — deactivate/reactivate workflow to reload.")
