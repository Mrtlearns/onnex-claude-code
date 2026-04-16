#!/usr/bin/env python3
"""
Fix Claude Assessment node authorization header.

When jsonParameters=true, headers must be in headerParametersJson.
To include env var expressions, headerParametersJson itself must be an n8n expression
using ={{ }} syntax that builds the JSON string dynamically.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Claude Assessment"

def run_sql(sql):
    r = subprocess.run(
        ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME, "-c", sql],
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

for i, node in enumerate(nodes):
    if node.get("name") != TARGET:
        continue

    p = node.get("parameters", {})
    print(f"Found '{TARGET}'")
    print(f"  Current requestMethod: {p.get('requestMethod')}")
    print(f"  Current headerParametersJson: {str(p.get('headerParametersJson', ''))[:100]}")

    # Use expression syntax so n8n evaluates $env.OPENROUTER_API_KEY at runtime
    # headerParametersJson as an n8n expression that produces a JSON string
    p["headerParametersJson"] = '={{ JSON.stringify({"Authorization": "Bearer " + $env.OPENROUTER_API_KEY, "content-type": "application/json"}) }}'

    # Remove old headerParameters (form-style) to avoid confusion
    p.pop("headerParameters", None)
    p.pop("sendHeaders", None)

    print(f"  New headerParametersJson: {p['headerParametersJson'][:100]}")
    node["parameters"] = p
    break

new_json = json.dumps(nodes)

sql_entity = f"UPDATE workflow_entity SET nodes = $tag${new_json}$tag$::jsonb WHERE id = '{WF_ID}';"
run_sql(sql_entity)
print("workflow_entity updated")

sql_history = f"""UPDATE workflow_history
SET nodes = (SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}')::json
WHERE "workflowId" = '{WF_ID}'
AND "versionId" = (SELECT "activeVersionId" FROM workflow_entity WHERE id = '{WF_ID}');"""
run_sql(sql_history)
print("workflow_history updated")

print("Done.")
