#!/usr/bin/env python3
"""
Fix n8n 'Extract Text via FastAPI' node to use static URL + bodyParametersJson.
The body-based endpoint POST /api/artifacts/extract accepts {artifact_id, secret} in body.
Static URL avoids the JS label/comment parsing bug with dynamic URL expressions.
"""
import subprocess
import json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WORKFLOW_NAME = "02"  # partial match
TARGET_NODE = "Extract Text via FastAPI"

def psql(sql, flags=None):
    cmd = ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME]
    if flags:
        cmd.extend(flags)
    cmd.extend(["-c", sql])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r

def psql_file(path):
    cmd = ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME, "-f", path]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r

# Fetch workflow
r = psql(f"SELECT id FROM workflow_entity WHERE name LIKE '%{WORKFLOW_NAME}%Artifact%';", ["-t", "-A"])
print("Workflow IDs:", r.stdout.strip())
wf_id = r.stdout.strip()
if not wf_id:
    print("Workflow not found!")
    exit(1)

# Fetch nodes JSON
r2 = psql(f"SELECT nodes FROM workflow_entity WHERE id = '{wf_id}';", ["-t", "-A"])
nodes_json = r2.stdout.strip()
nodes = json.loads(nodes_json)

print(f"Workflow: {wf_id}, nodes count: {len(nodes)}")
for n in nodes:
    print(f"  - {n.get('name')} ({n.get('type')})")

# Find and replace target node
NEW_NODE = {
    "parameters": {
        "url": "http://fastapi:8000/api/artifacts/extract",
        "method": "POST",
        "jsonParameters": True,
        "sendBody": True,
        "bodyParametersJson": "={{ JSON.stringify({ artifact_id: $json.id, secret: 'cmmc4msp-webhook-2026' }) }}",
        "options": {}
    },
    "name": TARGET_NODE,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 1,
    "position": [900, 300]
}

updated = False
for i, node in enumerate(nodes):
    if node.get("name") == TARGET_NODE:
        print(f"\nFound '{TARGET_NODE}' at index {i}")
        print(f"  Current type: {node.get('type')}, typeVersion: {node.get('typeVersion')}")
        NEW_NODE["position"] = node.get("position", [900, 300])
        nodes[i] = NEW_NODE
        updated = True
        break

if not updated:
    print(f"ERROR: Node '{TARGET_NODE}' not found!")
    exit(1)

new_nodes_json = json.dumps(nodes)

# Write SQL using dollar-quoting to avoid escaping issues
update_sql = f"UPDATE workflow_entity SET nodes = $js${new_nodes_json}$js$::jsonb WHERE id = '{wf_id}';\n"

with open("/tmp/fix_nodes.sql", "w") as f:
    f.write(update_sql)

subprocess.run(["docker", "cp", "/tmp/fix_nodes.sql", "cmmc-postgres:/tmp/fix_nodes.sql"])
r3 = psql_file("/tmp/fix_nodes.sql")
print("workflow_entity update:", r3.stdout.strip(), r3.stderr.strip())

# Update workflow_history (latest version)
hist_sql = f"UPDATE workflow_history SET nodes = $js${new_nodes_json}$js$::jsonb WHERE workflow_id = '{wf_id}' AND id = (SELECT MAX(id) FROM workflow_history WHERE workflow_id = '{wf_id}');\n"

with open("/tmp/fix_hist.sql", "w") as f:
    f.write(hist_sql)

subprocess.run(["docker", "cp", "/tmp/fix_hist.sql", "cmmc-postgres:/tmp/fix_hist.sql"])
r4 = psql_file("/tmp/fix_hist.sql")
print("workflow_history update:", r4.stdout.strip(), r4.stderr.strip())

print("\nDone — restart n8n to pick up changes.")
