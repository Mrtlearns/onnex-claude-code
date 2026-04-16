#!/usr/bin/env python3
"""
Fix Notify Assessment Complete node: send full payload including rationale, gaps, model_used.

FastAPI WebhookAssessmentComplete model requires: artifact_id, program_control_id,
verdict, confidence, rationale, gaps, model_used.

Current payload only sends: artifact_id, program_control_id, verdict, confidence.
"""
import subprocess, json

DB_USER = "cmmc_app"
DB_NAME = "n8n_db"
WF_ID = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
TARGET = "Notify Assessment Complete"

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
    print(f"  Current bodyParametersJson: {str(p.get('bodyParametersJson', ''))[:100]}")

    # Full payload with all required fields from Parse Claude Response
    # Also send X-Webhook-Secret in body as fallback
    new_body = (
        "={{ JSON.stringify({ "
        "artifact_id: $('Parse Claude Response').first().json.artifact_id, "
        "program_control_id: $('Parse Claude Response').first().json.program_control_id, "
        "verdict: $('Parse Claude Response').first().json.verdict, "
        "confidence: $('Parse Claude Response').first().json.confidence, "
        "rationale: $('Parse Claude Response').first().json.rationale, "
        "gaps: JSON.parse($('Parse Claude Response').first().json.gaps || '[]'), "
        "model_used: $('Parse Claude Response').first().json.model_used, "
        "secret: 'cmmc4msp-webhook-2026'"
        "}) }}"
    )
    p["bodyParametersJson"] = new_body
    # Also ensure requestMethod is POST (should already be fixed)
    p["requestMethod"] = "POST"

    print(f"  New bodyParametersJson: {new_body[:120]}")
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
