#!/usr/bin/env python3
"""
Add RETURNING clauses to ALL Postgres DML nodes so n8n execution chain continues.

Without RETURNING, executeQuery INSERT/UPDATE returns [] stopping the chain.
"""
import subprocess, json, re

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

# Nodes that need RETURNING added and what to return
# Key: node name, Value: what to append to the query
FIXES = {
    "Mark Processing": " RETURNING id::text AS artifact_id",
    "Update Artifact Assessed": " RETURNING id::text AS artifact_id",
    "Set Fully Implemented": " RETURNING id::text AS program_control_id",
    "Set Implementation Begun": " RETURNING id::text AS program_control_id",
    "Log Assessment Activity": " RETURNING id::text AS log_id",
    "Mark Assessment Failed": " RETURNING id::text AS artifact_id",
}

# Special case: Insert Assessment already has RETURNING from previous fix
# but let's ensure it's correct
INSERT_ASSESSMENT_QUERY = (
    "INSERT INTO assessments (artifact_id, program_control_id, verdict, confidence, rationale, gaps, model_used) "
    "VALUES ('{{ $json.artifact_id }}'::uuid, '{{ $json.program_control_id }}'::uuid, "
    "'{{ $json.verdict }}', {{ $json.confidence }}::numeric, '{{ $json.rationale }}', "
    "'{{ $json.gaps }}'::jsonb, '{{ $json.model_used }}') "
    "RETURNING id::text AS assessment_id, artifact_id::text, program_control_id::text, verdict"
)

fixed = []
for i, node in enumerate(nodes):
    name = node.get("name", "")
    p = node.get("parameters", {})

    if name == "Insert Assessment":
        old = p.get("query", "")
        if "RETURNING" not in old.upper():
            p["query"] = INSERT_ASSESSMENT_QUERY
            node["parameters"] = p
            print(f"Fixed '{name}': added RETURNING")
            fixed.append(name)
        else:
            print(f"'{name}': already has RETURNING")

    elif name in FIXES:
        q = p.get("query", "")
        if "RETURNING" not in q.upper():
            p["query"] = q.rstrip(";") + FIXES[name]
            node["parameters"] = p
            print(f"Fixed '{name}': {FIXES[name].strip()}")
            fixed.append(name)
        else:
            print(f"'{name}': already has RETURNING")

print(f"\nTotal fixed: {len(fixed)}: {fixed}")

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

# Verify
r2 = subprocess.run(
    ["docker", "exec", "cmmc-postgres", "psql", "-U", DB_USER, "-d", DB_NAME,
     "-t", "-A", "-c", f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';"],
    capture_output=True, text=True
)
nodes_check = json.loads(r2.stdout.strip())
print("\nVerification (DML nodes):")
for n in nodes_check:
    p = n.get("parameters", {})
    q = p.get("query", "")
    op = p.get("operation", "")
    if op == "executeQuery" and q:
        has_r = "RETURNING" in q.upper()
        is_select = q.strip().upper().startswith("SELECT")
        print(f"  {n['name']}: RETURNING={has_r} (SELECT={is_select})")

print("\nDone.")
