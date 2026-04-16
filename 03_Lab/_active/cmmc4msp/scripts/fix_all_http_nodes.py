#!/usr/bin/env python3
"""
Fix ALL HTTP Request v1 nodes in workflow 02 - Artifact Submitted.

n8n v1 HTTP Request node uses 'requestMethod' NOT 'method'.
Any node with 'method' stored will default to GET at runtime.

Also ensure correct v1 parameter names throughout.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"

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

http_nodes_fixed = []
for i, node in enumerate(nodes):
    if node.get("type") != "n8n-nodes-base.httpRequest":
        continue

    params = node.get("parameters", {})
    method_val = params.get("method")
    request_method_val = params.get("requestMethod")
    name = node.get("name", "unknown")

    # If using 'method' but not 'requestMethod', fix it
    if method_val and not request_method_val:
        print(f"Fixing '{name}': method={method_val} → requestMethod={method_val}")
        params["requestMethod"] = method_val
        del params["method"]

        # Also: when jsonParameters=true, headers need headerParametersJson not headerParameters.parameters
        # BUT we keep both for safety — n8n v1 with jsonParameters=true uses headerParametersJson
        # If there are headerParameters.parameters AND no headerParametersJson, convert it
        if params.get("jsonParameters") and params.get("headerParameters"):
            hp = params.get("headerParameters", {}).get("parameters", [])
            if hp and not params.get("headerParametersJson"):
                # Convert to headerParametersJson format (key-value object)
                header_obj = {p["name"]: p["value"] for p in hp if p.get("name")}
                params["headerParametersJson"] = json.dumps(header_obj)
                print(f"  → Converted headerParameters to headerParametersJson: {params['headerParametersJson'][:100]}")

        node["parameters"] = params
        http_nodes_fixed.append(name)
    else:
        print(f"'{name}': already has requestMethod={request_method_val} (method={method_val})")

if not http_nodes_fixed:
    print("No nodes needed fixing.")
else:
    print(f"\nFixed {len(http_nodes_fixed)} nodes: {http_nodes_fixed}")

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

# Verify all HTTP nodes
r2 = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes_check = json.loads(r2.stdout.strip())
print("\nFinal HTTP node parameters:")
for n in nodes_check:
    if n.get("type") == "n8n-nodes-base.httpRequest":
        p = n.get("parameters", {})
        print(f"  {n['name']}: requestMethod={p.get('requestMethod')} method={p.get('method')} url={p.get('url', '')[:60]}")

print("\nDone.")
