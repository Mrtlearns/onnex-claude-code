#!/usr/bin/env python3
"""
apply_metadata.py
-----------------
Applies Hasura metadata incrementally for the cmmc4msp platform.
Mirrors the logic in apply_hasura_metadata.sh using the same Hasura v1/metadata
API calls via Python requests — no external dependencies beyond stdlib + requests.

Usage:
    # From the VM (Hasura on localhost):
    HASURA_ADMIN_SECRET=<secret> python scripts/apply_metadata.py

    # From an external host:
    HASURA_URL=https://gql.cmmc4msp.on-nex.us HASURA_ADMIN_SECRET=<secret> python scripts/apply_metadata.py

    # Dry-run (print payloads, do not POST):
    HASURA_ADMIN_SECRET=<secret> python scripts/apply_metadata.py --dry-run

Exit codes:
    0  — all calls succeeded or returned non-fatal warnings (already exists)
    1  — fatal error (missing secret, connection failure, hard error response)
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any

try:
    import requests
except ImportError:
    print("ERROR: 'requests' package is required. Install with: pip install requests", file=sys.stderr)
    sys.exit(1)

# ─────────────────────────────────────────────
# Config from environment
# ─────────────────────────────────────────────
HASURA_URL = os.environ.get("HASURA_URL", "http://localhost:8080")
HASURA_ADMIN_SECRET = os.environ.get("HASURA_ADMIN_SECRET", "")

METADATA_ENDPOINT = f"{HASURA_URL.rstrip('/')}/v1/metadata"

WARN_COUNT = 0
OK_COUNT = 0
DRY_RUN = False


def hasura_api(label: str, payload: dict[str, Any]) -> None:
    """POST a single metadata API call. Prints OK or WARN; never raises on soft errors."""
    global WARN_COUNT, OK_COUNT

    if DRY_RUN:
        print(f"  DRY  [{label}]: {json.dumps(payload)}")
        return

    try:
        response = requests.post(
            METADATA_ENDPOINT,
            headers={
                "Content-Type": "application/json",
                "x-hasura-admin-secret": HASURA_ADMIN_SECRET,
            },
            json=payload,
            timeout=30,
        )
    except requests.exceptions.ConnectionError as exc:
        print(f"  FATAL [{label}]: connection error — {exc}", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.Timeout:
        print(f"  FATAL [{label}]: request timed out", file=sys.stderr)
        sys.exit(1)

    try:
        data = response.json()
    except ValueError:
        print(f"  WARN [{label}]: non-JSON response: {response.text[:200]}")
        WARN_COUNT += 1
        return

    if "error" in data:
        msg = data.get("error", "unknown")
        print(f"  WARN [{label}]: {msg}")
        WARN_COUNT += 1
    else:
        print(f"  OK   [{label}]")
        OK_COUNT += 1


# ─────────────────────────────────────────────
# Relationship helpers
# ─────────────────────────────────────────────

def obj_rel(table: str, name: str, fk_col: str) -> None:
    hasura_api(
        f"obj_rel:{table}.{name}",
        {
            "type": "pg_create_object_relationship",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "name": name,
                "using": {"foreign_key_constraint_on": fk_col},
            },
        },
    )


def obj_rel_manual(table: str, name: str, remote_table: str, col_mapping: dict[str, str]) -> None:
    hasura_api(
        f"obj_rel:{table}.{name}",
        {
            "type": "pg_create_object_relationship",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "name": name,
                "using": {
                    "manual_configuration": {
                        "remote_table": {"schema": "public", "name": remote_table},
                        "column_mapping": col_mapping,
                    }
                },
            },
        },
    )


def arr_rel(parent: str, rel_name: str, child: str, fk_col: str) -> None:
    hasura_api(
        f"arr_rel:{parent}.{rel_name}",
        {
            "type": "pg_create_array_relationship",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": parent},
                "name": rel_name,
                "using": {
                    "foreign_key_constraint_on": {
                        "table": {"schema": "public", "name": child},
                        "column": fk_col,
                    }
                },
            },
        },
    )


# ─────────────────────────────────────────────
# Permission helpers
# ─────────────────────────────────────────────

def sel_perm(table: str, role: str, filter_: dict, columns: str | list = "*", allow_agg: bool = True) -> None:
    hasura_api(
        f"sel:{table}:{role}",
        {
            "type": "pg_create_select_permission",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "role": role,
                "permission": {
                    "columns": columns,
                    "filter": filter_,
                    "allow_aggregations": allow_agg,
                },
            },
        },
    )


def ins_perm(table: str, role: str, check: dict, columns: str | list = "*") -> None:
    hasura_api(
        f"ins:{table}:{role}",
        {
            "type": "pg_create_insert_permission",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "role": role,
                "permission": {"columns": columns, "check": check},
            },
        },
    )


def upd_perm(table: str, role: str, filter_: dict, columns: str | list = "*") -> None:
    hasura_api(
        f"upd:{table}:{role}",
        {
            "type": "pg_create_update_permission",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "role": role,
                "permission": {"columns": columns, "filter": filter_},
            },
        },
    )


def del_perm(table: str, role: str, filter_: dict) -> None:
    hasura_api(
        f"del:{table}:{role}",
        {
            "type": "pg_create_delete_permission",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": table},
                "role": role,
                "permission": {"filter": filter_},
            },
        },
    )


# ─────────────────────────────────────────────
# Shorthand filter expressions
# ─────────────────────────────────────────────

MSP_FILTER: dict = {"id": {"_eq": "X-Hasura-Msp-Id"}}
MSP_ORG_FILTER: dict = {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}
MSP_USER_FILTER: dict = {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}
MSP_PROG_FILTER: dict = {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}
MSP_PC_FILTER: dict = {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}
MSP_ASSIGN_FILTER: dict = {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}
MSP_AE_FILTER: dict = {"assignment": {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}}
MSP_ART_FILTER: dict = {"program_control": {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}}
MSP_INV_FILTER: dict = {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}
MSP_CHUNK_FILTER: dict = {"artifact": {"program_control": {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}}}
MSP_ACS_FILTER: dict = {"artifact": {"program_control": {"program": {"org": {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}}}}}

ORG_FILTER: dict = {"id": {"_eq": "X-Hasura-Org-Id"}}
USERS_FILTER: dict = {"org_id": {"_eq": "X-Hasura-Org-Id"}}
PROG_FILTER: dict = {"org_id": {"_eq": "X-Hasura-Org-Id"}}
PC_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
ASSIGN_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
ASSIGN_OWN_FILTER: dict = {"assigned_to": {"_eq": "X-Hasura-User-Id"}}
AE_FILTER: dict = {"assignment": {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}}
ART_FILTER: dict = {"program_control": {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}}
ASSESS_FILTER: dict = {"program_control": {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}}
MILE_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
PM_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
PL_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
HW_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
SW_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
CS_FILTER: dict = {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}
AL_FILTER: dict = {"org_id": {"_eq": "X-Hasura-Org-Id"}}
INV_FILTER: dict = {"org_id": {"_eq": "X-Hasura-Org-Id"}}
CHUNKS_FILTER: dict = {"artifact": {"program_control": {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}}}
ACS_FILTER: dict = {"artifact": {"program_control": {"program": {"org_id": {"_eq": "X-Hasura-Org-Id"}}}}}

ACS_COLS = ["id", "artifact_id", "control_definition_id", "similarity_score",
            "top_chunk_texts", "generated_at", "applied_at", "applied_by"]
CHUNK_COLS = ["id", "artifact_id", "chunk_index", "chunk_text", "page_number", "created_at"]
EMBED_COLS = ["control_definition_id", "updated_at"]


# ─────────────────────────────────────────────
# Step 1 — Track tables
# ─────────────────────────────────────────────

def step1_track_tables() -> None:
    print("\n=== Step 1: Tracking tables ===")
    tables = [
        "control_definitions", "orgs", "users", "programs", "program_controls",
        "assignments", "assignment_events", "artifacts", "assessments", "milestones",
        "program_members", "program_locations", "hardware_inventory",
        "software_inventory", "cloud_services_inventory", "activity_log",
        "control_dependencies", "invites", "msps",
        "artifact_chunks", "control_definition_embeddings", "artifact_control_suggestions",
    ]
    for table in tables:
        hasura_api(
            f"track:{table}",
            {
                "type": "pg_track_table",
                "args": {"source": "default", "schema": "public", "name": table},
            },
        )


# ─────────────────────────────────────────────
# Step 2 — Object relationships
# ─────────────────────────────────────────────

def step2_object_relationships() -> None:
    print("\n=== Step 2: Object relationships ===")

    obj_rel("users", "org", "org_id")
    obj_rel("users", "msp", "msp_id")
    obj_rel("orgs", "msp", "msp_id")
    obj_rel("programs", "org", "org_id")
    obj_rel("program_controls", "program", "program_id")
    obj_rel("program_controls", "control_definition", "control_definition_id")
    obj_rel("assignments", "program_control", "program_control_id")
    obj_rel("assignments", "program", "program_id")
    obj_rel("assignments", "user", "assigned_to")
    obj_rel("assignment_events", "assignment", "assignment_id")
    obj_rel("assignment_events", "actor", "actor_id")
    obj_rel("artifacts", "program_control", "program_control_id")
    obj_rel("assessments", "artifact", "artifact_id")
    obj_rel("assessments", "program_control", "program_control_id")
    obj_rel("milestones", "program_control", "program_control_id")
    obj_rel("milestones", "program", "program_id")
    obj_rel("program_members", "program", "program_id")
    obj_rel("program_members", "user", "user_id")
    obj_rel("program_locations", "program", "program_id")
    obj_rel("hardware_inventory", "program", "program_id")
    obj_rel("software_inventory", "program", "program_id")
    obj_rel("cloud_services_inventory", "program", "program_id")
    obj_rel("activity_log", "org", "org_id")
    obj_rel("activity_log", "program", "program_id")
    obj_rel("invites", "org", "org_id")
    obj_rel("invites", "invited_by_user", "invited_by")
    obj_rel("artifact_chunks", "artifact", "artifact_id")
    obj_rel("control_definition_embeddings", "control_definition", "control_definition_id")
    obj_rel("artifact_control_suggestions", "artifact", "artifact_id")
    obj_rel("artifact_control_suggestions", "control_definition", "control_definition_id")

    # control_dependencies — self-referential, manual config
    obj_rel_manual("control_dependencies", "control", "control_definitions", {"control_id": "id"})
    obj_rel_manual("control_dependencies", "depends_on_control", "control_definitions", {"depends_on_id": "id"})


# ─────────────────────────────────────────────
# Step 3 — Array relationships
# ─────────────────────────────────────────────

def step3_array_relationships() -> None:
    print("\n=== Step 3: Array relationships ===")

    arr_rel("msps", "orgs", "orgs", "msp_id")
    arr_rel("msps", "users", "users", "msp_id")
    arr_rel("orgs", "programs", "programs", "org_id")
    arr_rel("orgs", "users", "users", "org_id")
    arr_rel("programs", "program_controls", "program_controls", "program_id")
    arr_rel("programs", "assignments", "assignments", "program_id")
    arr_rel("programs", "milestones", "milestones", "program_id")
    arr_rel("programs", "program_members", "program_members", "program_id")
    arr_rel("programs", "program_locations", "program_locations", "program_id")
    arr_rel("programs", "activity_logs", "activity_log", "program_id")
    arr_rel("program_controls", "assignments", "assignments", "program_control_id")
    arr_rel("program_controls", "artifacts", "artifacts", "program_control_id")
    arr_rel("program_controls", "milestones", "milestones", "program_control_id")
    arr_rel("program_controls", "assessments", "assessments", "program_control_id")
    arr_rel("assignments", "assignment_events", "assignment_events", "assignment_id")
    arr_rel("artifacts", "assessments", "assessments", "artifact_id")
    arr_rel("artifacts", "artifact_chunks", "artifact_chunks", "artifact_id")
    arr_rel("artifacts", "artifact_control_suggestions", "artifact_control_suggestions", "artifact_id")
    arr_rel("control_definitions", "program_controls", "program_controls", "control_definition_id")
    arr_rel("control_definitions", "control_dependencies", "control_dependencies", "control_id")
    arr_rel("control_definitions", "control_definition_embeddings", "control_definition_embeddings", "control_definition_id")
    arr_rel("users", "assignments", "assignments", "assigned_to")


# ─────────────────────────────────────────────
# Step 4 — Permissions
# ─────────────────────────────────────────────

def step4a_super_admin() -> None:
    print("  [super_admin] Full CRUD on all tables (no filters)...")
    tables = [
        "control_definitions", "orgs", "users", "programs", "program_controls",
        "assignments", "assignment_events", "artifacts", "assessments", "milestones",
        "program_members", "program_locations", "hardware_inventory",
        "software_inventory", "cloud_services_inventory", "activity_log",
        "control_dependencies", "invites", "msps",
        "artifact_chunks", "control_definition_embeddings", "artifact_control_suggestions",
    ]
    for table in tables:
        sel_perm(table, "super_admin", {})
        ins_perm(table, "super_admin", {})
        upd_perm(table, "super_admin", {})
        del_perm(table, "super_admin", {})


def step4b_msp_admin() -> None:
    print("  [msp_admin] MSP-scoped CRUD...")

    sel_perm("msps", "msp_admin", MSP_FILTER)
    ins_perm("msps", "msp_admin", MSP_FILTER)
    upd_perm("msps", "msp_admin", MSP_FILTER)

    sel_perm("control_definitions", "msp_admin", {})
    ins_perm("control_definitions", "msp_admin", {})
    upd_perm("control_definitions", "msp_admin", {})
    del_perm("control_definitions", "msp_admin", {})

    sel_perm("control_dependencies", "msp_admin", {})
    ins_perm("control_dependencies", "msp_admin", {})
    upd_perm("control_dependencies", "msp_admin", {})
    del_perm("control_dependencies", "msp_admin", {})

    sel_perm("orgs", "msp_admin", MSP_ORG_FILTER)
    ins_perm("orgs", "msp_admin", MSP_ORG_FILTER)
    upd_perm("orgs", "msp_admin", MSP_ORG_FILTER)
    del_perm("orgs", "msp_admin", MSP_ORG_FILTER)

    sel_perm("users", "msp_admin", MSP_USER_FILTER)
    ins_perm("users", "msp_admin", MSP_USER_FILTER)
    upd_perm("users", "msp_admin", MSP_USER_FILTER)
    del_perm("users", "msp_admin", MSP_USER_FILTER)

    sel_perm("programs", "msp_admin", MSP_PROG_FILTER)
    ins_perm("programs", "msp_admin", MSP_PROG_FILTER)
    upd_perm("programs", "msp_admin", MSP_PROG_FILTER)
    del_perm("programs", "msp_admin", MSP_PROG_FILTER)

    sel_perm("program_controls", "msp_admin", MSP_PC_FILTER)
    ins_perm("program_controls", "msp_admin", MSP_PC_FILTER)
    upd_perm("program_controls", "msp_admin", MSP_PC_FILTER)
    del_perm("program_controls", "msp_admin", MSP_PC_FILTER)

    sel_perm("assignments", "msp_admin", MSP_ASSIGN_FILTER)
    ins_perm("assignments", "msp_admin", MSP_ASSIGN_FILTER)
    upd_perm("assignments", "msp_admin", MSP_ASSIGN_FILTER)
    del_perm("assignments", "msp_admin", MSP_ASSIGN_FILTER)

    sel_perm("assignment_events", "msp_admin", MSP_AE_FILTER)
    ins_perm("assignment_events", "msp_admin", MSP_AE_FILTER)

    sel_perm("artifacts", "msp_admin", MSP_ART_FILTER)
    ins_perm("artifacts", "msp_admin", MSP_ART_FILTER)
    upd_perm("artifacts", "msp_admin", MSP_ART_FILTER)
    del_perm("artifacts", "msp_admin", MSP_ART_FILTER)

    sel_perm("assessments", "msp_admin", MSP_ART_FILTER)
    ins_perm("assessments", "msp_admin", MSP_ART_FILTER)
    upd_perm("assessments", "msp_admin", MSP_ART_FILTER)
    del_perm("assessments", "msp_admin", MSP_ART_FILTER)

    sel_perm("milestones", "msp_admin", MSP_ASSIGN_FILTER)
    ins_perm("milestones", "msp_admin", MSP_ASSIGN_FILTER)
    upd_perm("milestones", "msp_admin", MSP_ASSIGN_FILTER)
    del_perm("milestones", "msp_admin", MSP_ASSIGN_FILTER)

    sel_perm("program_members", "msp_admin", MSP_ASSIGN_FILTER)
    ins_perm("program_members", "msp_admin", MSP_ASSIGN_FILTER)
    upd_perm("program_members", "msp_admin", MSP_ASSIGN_FILTER)
    del_perm("program_members", "msp_admin", MSP_ASSIGN_FILTER)

    for table in ("program_locations", "hardware_inventory", "software_inventory", "cloud_services_inventory"):
        sel_perm(table, "msp_admin", MSP_ASSIGN_FILTER)
        ins_perm(table, "msp_admin", MSP_ASSIGN_FILTER)
        upd_perm(table, "msp_admin", MSP_ASSIGN_FILTER)
        del_perm(table, "msp_admin", MSP_ASSIGN_FILTER)

    sel_perm("activity_log", "msp_admin", MSP_INV_FILTER)
    ins_perm("activity_log", "msp_admin", MSP_INV_FILTER)

    sel_perm("invites", "msp_admin", MSP_INV_FILTER)
    ins_perm("invites", "msp_admin", MSP_INV_FILTER)
    del_perm("invites", "msp_admin", MSP_INV_FILTER)

    sel_perm("artifact_chunks", "msp_admin", MSP_CHUNK_FILTER)

    sel_perm("control_definition_embeddings", "msp_admin", {}, EMBED_COLS, allow_agg=False)

    sel_perm("artifact_control_suggestions", "msp_admin", MSP_ACS_FILTER, ACS_COLS, allow_agg=False)
    upd_perm("artifact_control_suggestions", "msp_admin", MSP_ACS_FILTER, ["applied_at", "applied_by"])


def step4c_client_read_globals() -> None:
    print("  [client_admin/client_user] global read (control_definitions, control_dependencies)...")
    for role in ("client_admin", "client_user"):
        sel_perm("control_definitions", role, {})
        sel_perm("control_dependencies", role, {})


def step4d_client_orgs() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("orgs", role, ORG_FILTER)


def step4e_client_users() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("users", role, USERS_FILTER)

    ins_perm("users", "client_admin", USERS_FILTER,
             ["org_id", "email", "display_name", "role", "is_active"])
    upd_perm("users", "client_admin", USERS_FILTER,
             ["display_name", "email", "role", "is_active"])


def step4f_client_programs() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("programs", role, PROG_FILTER)

    ins_perm("programs", "client_admin", PROG_FILTER,
             ["org_id", "name", "system_name", "status"])
    upd_perm("programs", "client_admin", PROG_FILTER,
             ["name", "system_name", "topology_narrative", "ssp_system_description",
              "ssp_environment_of_operation", "ssp_information_types",
              "ssp_security_requirements", "ssp_interconnections",
              "ssp_authoring_date", "ssp_last_review_date"])


def step4g_client_program_controls() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("program_controls", role, PC_FILTER)

    ins_perm("program_controls", "client_admin", PC_FILTER,
             ["program_id", "control_definition_id", "status", "implementation_status",
              "responsibility", "implementation_narrative", "plan_of_action", "target_date", "phase"])
    upd_perm("program_controls", "client_admin", PC_FILTER,
             ["status", "implementation_status", "responsibility", "implementation_narrative",
              "plan_of_action", "target_date", "phase", "score_override"])
    upd_perm("program_controls", "client_user", PC_FILTER,
             ["status", "implementation_status", "implementation_narrative", "plan_of_action"])


def step4h_client_assignments() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("assignments", role, ASSIGN_FILTER)

    ins_perm("assignments", "client_admin", ASSIGN_FILTER,
             ["program_id", "program_control_id", "assigned_to", "due_date", "priority", "notes"])
    upd_perm("assignments", "client_admin", ASSIGN_FILTER,
             ["assigned_to", "due_date", "priority", "status", "notes"])
    upd_perm("assignments", "client_user", ASSIGN_OWN_FILTER, ["status", "notes"])
    del_perm("assignments", "client_admin", ASSIGN_FILTER)

    for role in ("client_admin", "client_user"):
        sel_perm("assignment_events", role, AE_FILTER)


def step4i_client_artifacts() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("artifacts", role, ART_FILTER)

    artifact_ins_cols = [
        "program_control_id", "assignment_id", "file_name", "file_path",
        "file_size", "mime_type", "description", "uploaded_by",
    ]
    ins_perm("artifacts", "client_admin", ART_FILTER, artifact_ins_cols)
    ins_perm("artifacts", "client_user", ART_FILTER, artifact_ins_cols)
    upd_perm("artifacts", "client_admin", ART_FILTER, ["description", "file_name"])
    del_perm("artifacts", "client_admin", ART_FILTER)


def step4j_client_assessments() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("assessments", role, ASSESS_FILTER)


def step4k_client_milestones() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("milestones", role, MILE_FILTER)

    ins_perm("milestones", "client_admin", MILE_FILTER,
             ["program_id", "program_control_id", "title", "description",
              "due_date", "status", "resources_required", "estimated_cost"])
    upd_perm("milestones", "client_admin", MILE_FILTER,
             ["title", "description", "due_date", "status",
              "resources_required", "estimated_cost", "completion_date"])
    upd_perm("milestones", "client_user", MILE_FILTER, ["status", "completion_date"])
    del_perm("milestones", "client_admin", MILE_FILTER)


def step4l_client_program_members() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("program_members", role, PM_FILTER)

    ins_perm("program_members", "client_admin", PM_FILTER, ["program_id", "user_id", "member_role"])
    upd_perm("program_members", "client_admin", PM_FILTER, ["member_role"])
    del_perm("program_members", "client_admin", PM_FILTER)


def step4m_client_program_locations() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("program_locations", role, PL_FILTER)

    ins_perm("program_locations", "client_admin", PL_FILTER,
             ["program_id", "name", "address", "city", "state", "zip", "is_primary"])
    upd_perm("program_locations", "client_admin", PL_FILTER,
             ["name", "address", "city", "state", "zip", "is_primary"])
    del_perm("program_locations", "client_admin", PL_FILTER)


def step4n_client_hardware() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("hardware_inventory", role, HW_FILTER)

    cols = ["program_id", "asset_name", "asset_type", "manufacturer", "model",
            "serial_number", "ip_address", "location", "handles_cui", "notes"]
    ins_perm("hardware_inventory", "client_admin", HW_FILTER, cols)
    upd_perm("hardware_inventory", "client_admin", HW_FILTER, cols[1:])  # exclude program_id
    del_perm("hardware_inventory", "client_admin", HW_FILTER)


def step4o_client_software() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("software_inventory", role, SW_FILTER)

    cols = ["program_id", "product_name", "vendor", "version", "license_type", "handles_cui"]
    ins_perm("software_inventory", "client_admin", SW_FILTER, cols)
    upd_perm("software_inventory", "client_admin", SW_FILTER, cols[1:])
    del_perm("software_inventory", "client_admin", SW_FILTER)


def step4p_client_cloud() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("cloud_services_inventory", role, CS_FILTER)

    cols = ["program_id", "service_name", "provider", "service_type", "fedramp_authorized", "handles_cui"]
    ins_perm("cloud_services_inventory", "client_admin", CS_FILTER, cols)
    upd_perm("cloud_services_inventory", "client_admin", CS_FILTER, cols[1:])
    del_perm("cloud_services_inventory", "client_admin", CS_FILTER)


def step4q_client_activity_log() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("activity_log", role, AL_FILTER)


def step4r_client_invites() -> None:
    sel_perm("invites", "client_admin", INV_FILTER)
    ins_perm("invites", "client_admin", INV_FILTER,
             ["email", "role", "org_id", "invited_by", "token_hash", "expires_at"])
    del_perm("invites", "client_admin", INV_FILTER)


def step4s_client_embedding_tables() -> None:
    for role in ("client_admin", "client_user"):
        sel_perm("artifact_chunks", role, CHUNKS_FILTER, CHUNK_COLS, allow_agg=False)
        sel_perm("control_definition_embeddings", role, {}, EMBED_COLS, allow_agg=False)
        sel_perm("artifact_control_suggestions", role, ACS_FILTER, ACS_COLS, allow_agg=False)

    upd_perm("artifact_control_suggestions", "client_admin", ACS_FILTER, ["applied_at", "applied_by"])


def step4_permissions() -> None:
    print("\n=== Step 4: Permissions ===")
    step4a_super_admin()
    step4b_msp_admin()
    step4c_client_read_globals()
    step4d_client_orgs()
    step4e_client_users()
    step4f_client_programs()
    step4g_client_program_controls()
    step4h_client_assignments()
    step4i_client_artifacts()
    step4j_client_assessments()
    step4k_client_milestones()
    step4l_client_program_members()
    step4m_client_program_locations()
    step4n_client_hardware()
    step4o_client_software()
    step4p_client_cloud()
    step4q_client_activity_log()
    step4r_client_invites()
    step4s_client_embedding_tables()


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────

def main() -> None:
    global DRY_RUN

    parser = argparse.ArgumentParser(
        description="Apply Hasura metadata incrementally for cmmc4msp."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print all payloads without making any API calls.",
    )
    args = parser.parse_args()
    DRY_RUN = args.dry_run

    if not DRY_RUN and not HASURA_ADMIN_SECRET:
        print("ERROR: HASURA_ADMIN_SECRET is not set.", file=sys.stderr)
        sys.exit(1)

    if DRY_RUN:
        print("DRY RUN mode — no API calls will be made.")
    else:
        print(f"Applying Hasura metadata to: {HASURA_URL}")

    step1_track_tables()
    step2_object_relationships()
    step3_array_relationships()
    step4_permissions()

    if not DRY_RUN:
        print(f"\n=== Done ===")
        print(f"  OK:   {OK_COUNT}")
        print(f"  WARN: {WARN_COUNT}  (non-fatal, usually 'already exists')")
        print(f"  URL:  {HASURA_URL}")


if __name__ == "__main__":
    main()
