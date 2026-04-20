"""
setup_hasura_025.py
Tracks error_events and triage_reports in Hasura and applies
role-based select permissions + relationships via the Metadata API.
"""
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import requests
import json

from _secrets import hasura

HASURA_URL, ADMIN_SECRET = hasura()

HEADERS = {
    'X-Hasura-Admin-Secret': ADMIN_SECRET,
    'Content-Type': 'application/json',
}


def call(payload, label):
    resp = requests.post(f'{HASURA_URL}/v1/metadata', headers=HEADERS, json=payload, timeout=15)
    snippet = resp.text[:300]
    # Already-exists responses are acceptable (table already tracked, perm already set)
    if resp.status_code == 200 or 'already' in resp.text.lower() or 'exists' in resp.text.lower():
        print(f"[OK]  {label}: {resp.status_code} {snippet}")
    else:
        print(f"[ERR] {label}: {resp.status_code} {snippet}")
    return resp


def main():
    # ------------------------------------------------------------------ #
    # 1. Track tables                                                      #
    # ------------------------------------------------------------------ #
    call(
        {"type": "pg_track_table",
         "args": {"source": "default", "schema": "public", "name": "error_events"}},
        "track error_events"
    )
    call(
        {"type": "pg_track_table",
         "args": {"source": "default", "schema": "public", "name": "triage_reports"}},
        "track triage_reports"
    )

    # ------------------------------------------------------------------ #
    # 2. error_events — select permissions                                 #
    # ------------------------------------------------------------------ #
    # msp_admin and org_admin must NOT see stack_trace or context — those fields
    # can contain data from other tenants if msp_id tagging was incomplete.
    # Only super_admin has full column access.
    error_events_perms = [
        (
            "super_admin",
            "*",
            {}
        ),
        (
            "msp_admin",
            [
                "id", "msp_id", "org_id", "program_id", "correlation_id",
                "source", "severity", "component", "message",
                "triaged", "triaged_at", "triaged_by_report_id", "created_at",
            ],
            {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}
        ),
        (
            "org_admin",
            [
                "id", "org_id", "program_id", "correlation_id",
                "source", "severity", "component", "message",
                "triaged", "created_at",
            ],
            {"org_id": {"_eq": "X-Hasura-Org-Id"}}
        ),
    ]

    for role, columns, filter_clause in error_events_perms:
        if role != "super_admin":
            # Drop first so column changes take effect on re-run
            call(
                {"type": "pg_drop_select_permission",
                 "args": {"source": "default", "table": {"schema": "public", "name": "error_events"}, "role": role}},
                f"error_events drop perm [{role}]"
            )
        call(
            {
                "type": "pg_create_select_permission",
                "args": {
                    "source": "default",
                    "table": {"schema": "public", "name": "error_events"},
                    "role": role,
                    "permission": {"columns": columns, "filter": filter_clause}
                }
            },
            f"error_events select perm [{role}]"
        )

    # ------------------------------------------------------------------ #
    # 3. triage_reports — select permissions                               #
    # ------------------------------------------------------------------ #
    triage_perms = [
        ("super_admin", {}),
        ("msp_admin",   {"msp_id": {"_eq": "X-Hasura-Msp-Id"}}),
    ]

    for role, filter_clause in triage_perms:
        call(
            {
                "type": "pg_create_select_permission",
                "args": {
                    "source": "default",
                    "table": {"schema": "public", "name": "triage_reports"},
                    "role": role,
                    "permission": {"columns": "*", "filter": filter_clause}
                }
            },
            f"triage_reports select perm [{role}]"
        )

    # ------------------------------------------------------------------ #
    # 4. Relationships                                                     #
    # ------------------------------------------------------------------ #
    # Object relationship: error_events.triaged_by_report_id -> triage_reports
    call(
        {
            "type": "pg_create_object_relationship",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": "error_events"},
                "name": "triage_report",
                "using": {"foreign_key_constraint_on": "triaged_by_report_id"}
            }
        },
        "object relationship error_events.triage_report"
    )

    # Array relationship: triage_reports -> error_events
    call(
        {
            "type": "pg_create_array_relationship",
            "args": {
                "source": "default",
                "table": {"schema": "public", "name": "triage_reports"},
                "name": "error_events",
                "using": {
                    "foreign_key_constraint_on": {
                        "table": {"schema": "public", "name": "error_events"},
                        "column": "triaged_by_report_id"
                    }
                }
            }
        },
        "array relationship triage_reports.error_events"
    )

    # ------------------------------------------------------------------ #
    # 5. Smoke-test GraphQL query                                          #
    # ------------------------------------------------------------------ #
    print("\n[INFO] GraphQL smoke test ...")
    gql_resp = requests.post(
        f'{HASURA_URL}/v1/graphql',
        headers=HEADERS,
        json={"query": "{ error_events(limit: 1) { id source component } }"},
        timeout=15
    )
    print(f"[GraphQL] status={gql_resp.status_code}")
    try:
        parsed = gql_resp.json()
        if 'errors' in parsed:
            print(f"[ERR] GraphQL errors: {json.dumps(parsed['errors'], indent=2)}")
        else:
            print(f"[OK]  GraphQL result: {json.dumps(parsed, indent=2)}")
    except Exception as e:
        print(f"[ERR] Could not parse response: {e}\n{gql_resp.text[:400]}")

    print("\n[DONE] Hasura 025 setup complete.")


if __name__ == '__main__':
    main()
