#!/usr/bin/env python3
"""
Fix Insert Assessment node: add RETURNING clause so n8n gets output items
and continues the execution chain to Update Artifact Assessed etc.

Without RETURNING, Postgres executeQuery INSERT returns [], stopping the chain.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Insert Assessment"

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
    old_query = p.get("query", "")
    print(f"Old query: {old_query[:100]}")

    # Add RETURNING clause so the INSERT produces output items
    new_query = (
        "INSERT INTO assessments (artifact_id, program_control_id, verdict, confidence, rationale, gaps, model_used) "
        "VALUES ('{{ $json.artifact_id }}'::uuid, '{{ $json.program_control_id }}'::uuid, "
        "'{{ $json.verdict }}', {{ $json.confidence }}::numeric, '{{ $json.rationale }}', "
        "'{{ $json.gaps }}'::jsonb, '{{ $json.model_used }}') "
        "RETURNING id::text AS assessment_id, artifact_id::text, program_control_id::text, verdict"
    )
    p["query"] = new_query
    node["parameters"] = p
    print(f"New query: {new_query[:150]}")
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
