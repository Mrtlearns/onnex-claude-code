#!/bin/bash
# apply_hasura_metadata.sh
# Applies Hasura v2.42 table tracking, relationships, and permissions
# for the cmmc4msp platform (22 tables, migrations 001-013).
#
# Usage:
#   # From inside the VM (Hasura on localhost):
#   HASURA_ADMIN_SECRET=<secret> bash scripts/apply_hasura_metadata.sh
#
#   # From an external host:
#   HASURA_URL=https://gql.cmmc4msp.on-nex.us HASURA_ADMIN_SECRET=<secret> bash scripts/apply_hasura_metadata.sh
#
# Idempotent — re-running emits WARN on already-existing objects but does not fail.

set -euo pipefail

HASURA_URL="${HASURA_URL:-http://localhost:8080}"
HASURA_ADMIN_SECRET="${HASURA_ADMIN_SECRET:-}"

if [[ -z "$HASURA_ADMIN_SECRET" ]]; then
  echo "ERROR: HASURA_ADMIN_SECRET is not set." >&2
  exit 1
fi

# ─────────────────────────────────────────────
# Core helper — posts a metadata API payload and checks for errors
# ─────────────────────────────────────────────
hasura_api() {
  local label="$1"
  local payload="$2"
  local response
  response=$(curl -s \
    -H "Content-Type: application/json" \
    -H "x-hasura-admin-secret: ${HASURA_ADMIN_SECRET}" \
    -d "$payload" \
    "${HASURA_URL}/v1/metadata")

  if echo "$response" | grep -q '"error"'; then
    local msg
    msg=$(echo "$response" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('error','unknown'))" 2>/dev/null || echo "$response")
    echo "  WARN [$label]: $msg"
    return 0  # non-fatal — may already exist
  fi
  echo "  OK   [$label]"
}

# ─────────────────────────────────────────────
# 1. Track all 22 tables
# ─────────────────────────────────────────────
echo ""
echo "=== Step 1: Tracking tables ==="

TABLES=(
  control_definitions
  orgs
  users
  programs
  program_controls
  assignments
  assignment_events
  artifacts
  assessments
  milestones
  program_members
  program_locations
  hardware_inventory
  software_inventory
  cloud_services_inventory
  activity_log
  control_dependencies
  invites
  msps
  artifact_chunks
  control_definition_embeddings
  artifact_control_suggestions
)

for table in "${TABLES[@]}"; do
  hasura_api "track:$table" \
    "{\"type\":\"pg_track_table\",\"args\":{\"source\":\"default\",\"schema\":\"public\",\"name\":\"$table\"}}"
done

# ─────────────────────────────────────────────
# 2. Object relationships (FK → parent)
# ─────────────────────────────────────────────
echo ""
echo "=== Step 2: Object relationships ==="

obj_rel() {
  local table="$1" name="$2" fk_col="$3"
  hasura_api "obj_rel:${table}.${name}" \
    "{\"type\":\"pg_create_object_relationship\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"name\":\"$name\",\"using\":{\"foreign_key_constraint_on\":\"$fk_col\"}}}"
}

# users → org, msp
obj_rel "users" "org" "org_id"
obj_rel "users" "msp" "msp_id"

# orgs → msp
obj_rel "orgs" "msp" "msp_id"

# programs → org
obj_rel "programs" "org" "org_id"

# program_controls → program, control_definition
obj_rel "program_controls" "program"            "program_id"
obj_rel "program_controls" "control_definition" "control_definition_id"

# assignments → program_control, program, user
obj_rel "assignments" "program_control" "program_control_id"
obj_rel "assignments" "program"         "program_id"
obj_rel "assignments" "user"            "assigned_to"

# assignment_events → assignment, actor (user)
obj_rel "assignment_events" "assignment" "assignment_id"
obj_rel "assignment_events" "actor"      "actor_id"

# artifacts → program_control
obj_rel "artifacts" "program_control" "program_control_id"

# assessments → artifact, program_control
obj_rel "assessments" "artifact"        "artifact_id"
obj_rel "assessments" "program_control" "program_control_id"

# milestones → program_control, program
obj_rel "milestones" "program_control" "program_control_id"
obj_rel "milestones" "program"         "program_id"

# program_members → program, user
obj_rel "program_members" "program" "program_id"
obj_rel "program_members" "user"    "user_id"

# program_locations → program
obj_rel "program_locations" "program" "program_id"

# hardware_inventory → program
obj_rel "hardware_inventory" "program" "program_id"

# software_inventory → program
obj_rel "software_inventory" "program" "program_id"

# cloud_services_inventory → program
obj_rel "cloud_services_inventory" "program" "program_id"

# activity_log → org, program
obj_rel "activity_log" "org"     "org_id"
obj_rel "activity_log" "program" "program_id"

# invites → org, invited_by_user
obj_rel "invites" "org"             "org_id"
obj_rel "invites" "invited_by_user" "invited_by"

# artifact_chunks → artifact
obj_rel "artifact_chunks" "artifact" "artifact_id"

# control_definition_embeddings → control_definition
obj_rel "control_definition_embeddings" "control_definition" "control_definition_id"

# artifact_control_suggestions → artifact, control_definition
obj_rel "artifact_control_suggestions" "artifact"           "artifact_id"
obj_rel "artifact_control_suggestions" "control_definition" "control_definition_id"

# control_dependencies — self-referential via manual config
hasura_api "obj_rel:control_dependencies.control" \
  '{"type":"pg_create_object_relationship","args":{"source":"default","table":{"schema":"public","name":"control_dependencies"},"name":"control","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"control_definitions"},"column_mapping":{"control_id":"id"}}}}}'

hasura_api "obj_rel:control_dependencies.depends_on_control" \
  '{"type":"pg_create_object_relationship","args":{"source":"default","table":{"schema":"public","name":"control_dependencies"},"name":"depends_on_control","using":{"manual_configuration":{"remote_table":{"schema":"public","name":"control_definitions"},"column_mapping":{"depends_on_id":"id"}}}}}'

# ─────────────────────────────────────────────
# 3. Array relationships (parent → children)
# ─────────────────────────────────────────────
echo ""
echo "=== Step 3: Array relationships ==="

arr_rel() {
  local parent_table="$1" rel_name="$2" child_table="$3" fk_col="$4"
  hasura_api "arr_rel:${parent_table}.${rel_name}" \
    "{\"type\":\"pg_create_array_relationship\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$parent_table\"},\"name\":\"$rel_name\",\"using\":{\"foreign_key_constraint_on\":{\"table\":{\"schema\":\"public\",\"name\":\"$child_table\"},\"column\":\"$fk_col\"}}}}"
}

# msps
arr_rel "msps" "orgs"  "orgs"  "msp_id"
arr_rel "msps" "users" "users" "msp_id"

# orgs
arr_rel "orgs" "programs" "programs" "org_id"
arr_rel "orgs" "users"    "users"    "org_id"

# programs
arr_rel "programs" "program_controls"  "program_controls"  "program_id"
arr_rel "programs" "assignments"       "assignments"       "program_id"
arr_rel "programs" "milestones"        "milestones"        "program_id"
arr_rel "programs" "program_members"   "program_members"   "program_id"
arr_rel "programs" "program_locations" "program_locations" "program_id"
arr_rel "programs" "activity_logs"     "activity_log"      "program_id"

# program_controls
arr_rel "program_controls" "assignments" "assignments" "program_control_id"
arr_rel "program_controls" "artifacts"   "artifacts"   "program_control_id"
arr_rel "program_controls" "milestones"  "milestones"  "program_control_id"
arr_rel "program_controls" "assessments" "assessments" "program_control_id"

# assignments
arr_rel "assignments" "assignment_events" "assignment_events" "assignment_id"

# artifacts
arr_rel "artifacts" "assessments"               "assessments"               "artifact_id"
arr_rel "artifacts" "artifact_chunks"            "artifact_chunks"           "artifact_id"
arr_rel "artifacts" "artifact_control_suggestions" "artifact_control_suggestions" "artifact_id"

# control_definitions
arr_rel "control_definitions" "program_controls"             "program_controls"             "control_definition_id"
arr_rel "control_definitions" "control_dependencies"         "control_dependencies"         "control_id"
arr_rel "control_definitions" "control_definition_embeddings" "control_definition_embeddings" "control_definition_id"

# users
arr_rel "users" "assignments" "assignments" "assigned_to"

# ─────────────────────────────────────────────
# 4. Permissions
# ─────────────────────────────────────────────
echo ""
echo "=== Step 4: Permissions ==="

# ── Helper functions ──────────────────────────

sel_perm() {
  local table="$1" role="$2" filter="$3"
  hasura_api "sel:${table}:${role}" \
    "{\"type\":\"pg_create_select_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"$role\",\"permission\":{\"columns\":\"*\",\"filter\":$filter,\"allow_aggregations\":true}}}"
}

sel_perm_cols() {
  local table="$1" role="$2" filter="$3" cols="$4"
  hasura_api "sel:${table}:${role}" \
    "{\"type\":\"pg_create_select_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"$role\",\"permission\":{\"columns\":$cols,\"filter\":$filter,\"allow_aggregations\":false}}}"
}

ins_perm() {
  local table="$1" role="$2" check="$3" cols="$4"
  hasura_api "ins:${table}:${role}" \
    "{\"type\":\"pg_create_insert_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"$role\",\"permission\":{\"columns\":$cols,\"check\":$check}}}"
}

upd_perm() {
  local table="$1" role="$2" filter="$3" cols="$4"
  hasura_api "upd:${table}:${role}" \
    "{\"type\":\"pg_create_update_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"$role\",\"permission\":{\"columns\":$cols,\"filter\":$filter}}}"
}

del_perm() {
  local table="$1" role="$2" filter="$3"
  hasura_api "del:${table}:${role}" \
    "{\"type\":\"pg_create_delete_permission\",\"args\":{\"source\":\"default\",\"table\":{\"schema\":\"public\",\"name\":\"$table\"},\"role\":\"$role\",\"permission\":{\"filter\":$filter}}}"
}

# ─────────────────────────────────────────────
# 4a. super_admin — Onnex staff, unrestricted god mode
# ─────────────────────────────────────────────
echo "  [super_admin] Full CRUD on all tables (no filters)..."

SUPER_ADMIN_TABLES=(
  control_definitions orgs users programs program_controls
  assignments assignment_events artifacts assessments milestones
  program_members program_locations hardware_inventory software_inventory
  cloud_services_inventory activity_log control_dependencies
  invites msps artifact_chunks control_definition_embeddings
  artifact_control_suggestions
)

for table in "${SUPER_ADMIN_TABLES[@]}"; do
  sel_perm "$table" "super_admin" "{}"
  ins_perm "$table" "super_admin" "{}" '"*"'
  upd_perm "$table" "super_admin" "{}" '"*"'
  del_perm "$table" "super_admin" "{}"
done

# ─────────────────────────────────────────────
# 4b. msp_admin — scoped to their MSP's orgs only
# ─────────────────────────────────────────────
echo "  [msp_admin] MSP-scoped CRUD..."

# msps — can only see their own MSP record
sel_perm "msps" "msp_admin" '{"id":{"_eq":"X-Hasura-Msp-Id"}}'
ins_perm "msps" "msp_admin" '{"id":{"_eq":"X-Hasura-Msp-Id"}}' '"*"'
upd_perm "msps" "msp_admin" '{"id":{"_eq":"X-Hasura-Msp-Id"}}' '"*"'

# control_definitions / control_dependencies — global read (no org filter)
sel_perm "control_definitions" "msp_admin" "{}"
ins_perm "control_definitions" "msp_admin" "{}" '"*"'
upd_perm "control_definitions" "msp_admin" "{}" '"*"'
del_perm "control_definitions" "msp_admin" "{}"
sel_perm "control_dependencies" "msp_admin" "{}"
ins_perm "control_dependencies" "msp_admin" "{}" '"*"'
upd_perm "control_dependencies" "msp_admin" "{}" '"*"'
del_perm "control_dependencies" "msp_admin" "{}"

# orgs — scoped to msp_id
sel_perm "orgs" "msp_admin" '{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}'
ins_perm "orgs" "msp_admin" '{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}' '"*"'
upd_perm "orgs" "msp_admin" '{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}' '"*"'
del_perm "orgs" "msp_admin" '{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}'

# users — scoped via org → msp
sel_perm "users" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'
ins_perm "users" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'
upd_perm "users" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'
del_perm "users" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'

# programs — scoped via org → msp
sel_perm "programs" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'
ins_perm "programs" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'
upd_perm "programs" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'
del_perm "programs" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'

# program_controls — via program → org → msp
sel_perm "program_controls" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
ins_perm "program_controls" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
upd_perm "program_controls" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
del_perm "program_controls" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'

# assignments — via program → org → msp
sel_perm "assignments" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
ins_perm "assignments" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
upd_perm "assignments" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
del_perm "assignments" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'

# assignment_events — via assignment → program → org → msp (read-only for msp_admin)
sel_perm "assignment_events" "msp_admin" '{"assignment":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}'
ins_perm "assignment_events" "msp_admin" '{"assignment":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}' '"*"'

# artifacts — via program_control → program → org → msp
sel_perm "artifacts" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}'
ins_perm "artifacts" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}' '"*"'
upd_perm "artifacts" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}' '"*"'
del_perm "artifacts" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}'

# assessments — via program_control → program → org → msp
sel_perm "assessments" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}'
ins_perm "assessments" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}' '"*"'
upd_perm "assessments" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}' '"*"'
del_perm "assessments" "msp_admin" '{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}'

# milestones — via program → org → msp
sel_perm "milestones" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
ins_perm "milestones" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
upd_perm "milestones" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
del_perm "milestones" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'

# program_members — via program → org → msp
sel_perm "program_members" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
ins_perm "program_members" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
upd_perm "program_members" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
del_perm "program_members" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'

for tbl in program_locations hardware_inventory software_inventory cloud_services_inventory; do
  sel_perm "$tbl" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
  ins_perm "$tbl" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
  upd_perm "$tbl" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}' '"*"'
  del_perm "$tbl" "msp_admin" '{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}'
done

# activity_log — via org → msp
sel_perm "activity_log" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'
ins_perm "activity_log" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'

# invites — scoped to orgs within the MSP
sel_perm "invites" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'
ins_perm "invites" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}' '"*"'
del_perm "invites" "msp_admin" '{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}'

# artifact_chunks — via artifact → program_control → program → org → msp (read-only)
sel_perm "artifact_chunks" "msp_admin" '{"artifact":{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}}'

# control_definition_embeddings — global read (no org filter), no vectors
sel_perm_cols "control_definition_embeddings" "msp_admin" "{}" \
  '["control_definition_id","updated_at"]'

# artifact_control_suggestions — via artifact → program_control → program → org → msp
sel_perm_cols "artifact_control_suggestions" "msp_admin" \
  '{"artifact":{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}}' \
  '["id","artifact_id","control_definition_id","similarity_score","top_chunk_texts","generated_at","applied_at","applied_by"]'
upd_perm "artifact_control_suggestions" "msp_admin" \
  '{"artifact":{"program_control":{"program":{"org":{"msp_id":{"_eq":"X-Hasura-Msp-Id"}}}}}}' \
  '["applied_at","applied_by"]'

# ─────────────────────────────────────────────
# 4c. control_definitions — public read for all client roles
# ─────────────────────────────────────────────
echo "  [client_admin/client_user] control_definitions read..."
for role in client_admin client_user; do
  sel_perm "control_definitions" "$role" "{}"
done

# control_dependencies — public read
for role in client_admin client_user; do
  sel_perm "control_dependencies" "$role" "{}"
done

# ─────────────────────────────────────────────
# 4d. orgs — users see their own org row
# ─────────────────────────────────────────────
ORG_FILTER='{"id":{"_eq":"X-Hasura-Org-Id"}}'
sel_perm "orgs" "client_admin" "$ORG_FILTER"
sel_perm "orgs" "client_user"  "$ORG_FILTER"

# ─────────────────────────────────────────────
# 4e. users — scoped to own org
# ─────────────────────────────────────────────
USERS_FILTER='{"org_id":{"_eq":"X-Hasura-Org-Id"}}'
sel_perm "users" "client_admin" "$USERS_FILTER"
sel_perm "users" "client_user"  "$USERS_FILTER"

ins_perm "users" "client_admin" "$USERS_FILTER" \
  '["org_id","email","full_name","role","is_active"]'
upd_perm "users" "client_admin" "$USERS_FILTER" \
  '["full_name","email","role","is_active"]'

# ─────────────────────────────────────────────
# 4f. programs — scoped to org_id
# ─────────────────────────────────────────────
PROG_FILTER='{"org_id":{"_eq":"X-Hasura-Org-Id"}}'
sel_perm "programs" "client_admin" "$PROG_FILTER"
sel_perm "programs" "client_user"  "$PROG_FILTER"

ins_perm "programs" "client_admin" "$PROG_FILTER" \
  '["org_id","name","system_name","status"]'
upd_perm "programs" "client_admin" "$PROG_FILTER" \
  '["name","system_name","topology_narrative","ssp_system_description","ssp_environment_of_operation","ssp_information_types","ssp_security_requirements","ssp_interconnections","ssp_authoring_date","ssp_last_review_date"]'

# ─────────────────────────────────────────────
# 4g. program_controls — JOIN filter via program.org_id
# ─────────────────────────────────────────────
PC_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'
sel_perm "program_controls" "client_admin" "$PC_FILTER"
sel_perm "program_controls" "client_user"  "$PC_FILTER"

ins_perm "program_controls" "client_admin" "$PC_FILTER" \
  '["program_id","control_definition_id","status","is_applicable","implementation_notes","target_completion_date"]'
upd_perm "program_controls" "client_admin" "$PC_FILTER" \
  '["status","is_applicable","implementation_notes","score_impact","target_completion_date"]'
upd_perm "program_controls" "client_user" "$PC_FILTER" \
  '["status","implementation_notes"]'

# ─────────────────────────────────────────────
# 4h. assignments
# ─────────────────────────────────────────────
ASSIGN_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'
ASSIGN_OWN_FILTER='{"assigned_to":{"_eq":"X-Hasura-User-Id"}}'

sel_perm "assignments" "client_admin" "$ASSIGN_FILTER"
sel_perm "assignments" "client_user"  "$ASSIGN_FILTER"

ins_perm "assignments" "client_admin" "$ASSIGN_FILTER" \
  '["program_id","program_control_id","assigned_to","due_date","instructions"]'
upd_perm "assignments" "client_admin" "$ASSIGN_FILTER" \
  '["assigned_to","due_date","status","instructions"]'
upd_perm "assignments" "client_user" "$ASSIGN_OWN_FILTER" \
  '["status"]'

del_perm "assignments" "client_admin" "$ASSIGN_FILTER"

# assignment_events — read-only for client roles
AE_FILTER='{"assignment":{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}}'
sel_perm "assignment_events" "client_admin" "$AE_FILTER"
sel_perm "assignment_events" "client_user"  "$AE_FILTER"

# ─────────────────────────────────────────────
# 4i. artifacts
# ─────────────────────────────────────────────
ART_FILTER='{"program_control":{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}}'

sel_perm "artifacts" "client_admin" "$ART_FILTER"
sel_perm "artifacts" "client_user"  "$ART_FILTER"

ins_perm "artifacts" "client_admin" "$ART_FILTER" \
  '["program_control_id","assignment_id","file_name","mime_type","uploaded_by"]'
ins_perm "artifacts" "client_user" "$ART_FILTER" \
  '["program_control_id","assignment_id","file_name","mime_type","uploaded_by"]'

upd_perm "artifacts" "client_admin" "$ART_FILTER" \
  '["file_name"]'

del_perm "artifacts" "client_admin" "$ART_FILTER"

# ─────────────────────────────────────────────
# 4j. assessments — read only for client roles
# ─────────────────────────────────────────────
ASSESS_FILTER='{"program_control":{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}}'

sel_perm "assessments" "client_admin" "$ASSESS_FILTER"
sel_perm "assessments" "client_user"  "$ASSESS_FILTER"

# ─────────────────────────────────────────────
# 4k. milestones
# ─────────────────────────────────────────────
MILE_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "milestones" "client_admin" "$MILE_FILTER"
sel_perm "milestones" "client_user"  "$MILE_FILTER"

ins_perm "milestones" "client_admin" "$MILE_FILTER" \
  '["program_id","program_control_id","responsible_org","resource_estimate","remediation_plan","current_milestone_date"]'
upd_perm "milestones" "client_admin" "$MILE_FILTER" \
  '["responsible_org","resource_estimate","remediation_plan","current_milestone_date","is_complete"]'
upd_perm "milestones" "client_user" "$MILE_FILTER" \
  '["is_complete"]'
del_perm "milestones" "client_admin" "$MILE_FILTER"

# ─────────────────────────────────────────────
# 4l. program_members
# ─────────────────────────────────────────────
PM_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "program_members" "client_admin" "$PM_FILTER"
sel_perm "program_members" "client_user"  "$PM_FILTER"

ins_perm "program_members" "client_admin" "$PM_FILTER" \
  '["program_id","user_id","role"]'
upd_perm "program_members" "client_admin" "$PM_FILTER" \
  '["role"]'
del_perm "program_members" "client_admin" "$PM_FILTER"

# ─────────────────────────────────────────────
# 4m. program_locations
# ─────────────────────────────────────────────
PL_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "program_locations" "client_admin" "$PL_FILTER"
sel_perm "program_locations" "client_user"  "$PL_FILTER"

ins_perm "program_locations" "client_admin" "$PL_FILTER" \
  '["program_id","name","address","city","state","zip","is_primary"]'
upd_perm "program_locations" "client_admin" "$PL_FILTER" \
  '["name","address","city","state","zip","is_primary"]'
del_perm "program_locations" "client_admin" "$PL_FILTER"

# ─────────────────────────────────────────────
# 4n. hardware_inventory
# ─────────────────────────────────────────────
HW_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "hardware_inventory" "client_admin" "$HW_FILTER"
sel_perm "hardware_inventory" "client_user"  "$HW_FILTER"

ins_perm "hardware_inventory" "client_admin" "$HW_FILTER" \
  '["program_id","asset_name","asset_type","manufacturer","model","serial_number","ip_address","location","handles_cui","notes"]'
upd_perm "hardware_inventory" "client_admin" "$HW_FILTER" \
  '["asset_name","asset_type","manufacturer","model","serial_number","ip_address","location","handles_cui","notes"]'
del_perm "hardware_inventory" "client_admin" "$HW_FILTER"

# ─────────────────────────────────────────────
# 4o. software_inventory
# ─────────────────────────────────────────────
SW_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "software_inventory" "client_admin" "$SW_FILTER"
sel_perm "software_inventory" "client_user"  "$SW_FILTER"

ins_perm "software_inventory" "client_admin" "$SW_FILTER" \
  '["program_id","product_name","vendor","version","license_type","handles_cui"]'
upd_perm "software_inventory" "client_admin" "$SW_FILTER" \
  '["product_name","vendor","version","license_type","handles_cui"]'
del_perm "software_inventory" "client_admin" "$SW_FILTER"

# ─────────────────────────────────────────────
# 4p. cloud_services_inventory
# ─────────────────────────────────────────────
CS_FILTER='{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}'

sel_perm "cloud_services_inventory" "client_admin" "$CS_FILTER"
sel_perm "cloud_services_inventory" "client_user"  "$CS_FILTER"

ins_perm "cloud_services_inventory" "client_admin" "$CS_FILTER" \
  '["program_id","service_name","provider","service_type","fedramp_authorized","handles_cui"]'
upd_perm "cloud_services_inventory" "client_admin" "$CS_FILTER" \
  '["service_name","provider","service_type","fedramp_authorized","handles_cui"]'
del_perm "cloud_services_inventory" "client_admin" "$CS_FILTER"

# ─────────────────────────────────────────────
# 4q. activity_log — read-only audit trail for client roles
# ─────────────────────────────────────────────
AL_FILTER='{"org_id":{"_eq":"X-Hasura-Org-Id"}}'

sel_perm "activity_log" "client_admin" "$AL_FILTER"
sel_perm "activity_log" "client_user"  "$AL_FILTER"

# ─────────────────────────────────────────────
# 4r. invites — client_admin manages invites for their org
# ─────────────────────────────────────────────
INV_FILTER='{"org_id":{"_eq":"X-Hasura-Org-Id"}}'

sel_perm "invites" "client_admin" "$INV_FILTER"
ins_perm "invites" "client_admin" "$INV_FILTER" \
  '["email","role","org_id","invited_by","token_hash","expires_at"]'
del_perm "invites" "client_admin" "$INV_FILTER"

# ─────────────────────────────────────────────
# 4s. artifact_chunks — read-only for client roles (no embedding vector)
# ─────────────────────────────────────────────
CHUNKS_FILTER='{"artifact":{"program_control":{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}}}'
sel_perm_cols "artifact_chunks" "client_admin" "$CHUNKS_FILTER" \
  '["id","artifact_id","chunk_index","chunk_text","page_number","created_at"]'
sel_perm_cols "artifact_chunks" "client_user" "$CHUNKS_FILTER" \
  '["id","artifact_id","chunk_index","chunk_text","page_number","created_at"]'

# control_definition_embeddings — read-only, no vector column
for role in client_admin client_user; do
  sel_perm_cols "control_definition_embeddings" "$role" "{}" \
    '["control_definition_id","updated_at"]'
done

# artifact_control_suggestions — read for client_admin; client_user read-only
ACS_FILTER='{"artifact":{"program_control":{"program":{"org_id":{"_eq":"X-Hasura-Org-Id"}}}}}'
ACS_COLS='["id","artifact_id","control_definition_id","similarity_score","top_chunk_texts","generated_at","applied_at","applied_by"]'

sel_perm_cols "artifact_control_suggestions" "client_admin" "$ACS_FILTER" "$ACS_COLS"
sel_perm_cols "artifact_control_suggestions" "client_user"  "$ACS_FILTER" "$ACS_COLS"

upd_perm "artifact_control_suggestions" "client_admin" "$ACS_FILTER" \
  '["applied_at","applied_by"]'

# ─────────────────────────────────────────────
echo ""
echo "=== Hasura metadata applied successfully! ==="
echo "  URL: ${HASURA_URL}"
echo "  Tables tracked: 22"
echo "  Roles configured: super_admin, msp_admin, client_admin, client_user"
