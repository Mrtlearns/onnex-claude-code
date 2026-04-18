"""
seed_demo_client.py — Create a fully-populated demo organization for sales demos.

Demo org: Meridian Defense Systems LLC (slug: meridian-defense)
MSP:      AirGap Cyber (created if absent)
Program:  CMMC Level 2 — FY2026 Assessment
Controls: All 407 control_definitions seeded with realistic status distribution
Team:     3 Authentik users (client_admin, client_user ×2)
Extras:   Assignments, artifacts, assessments, milestones, activity_log

Usage:
    python seed_demo_client.py             # seed (idempotent)
    python seed_demo_client.py --teardown  # delete demo data + Authentik users
    python seed_demo_client.py --dry-run   # print what would happen, no DB writes
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _secrets import postgres, authentik

# ── Deterministic UUIDs (idempotent re-runs) ──────────────────────────────────
_NS = uuid.UUID("c3ea7b4e-1234-5678-abcd-4d5350000000")


def _uid(*parts: str) -> uuid.UUID:
    return uuid.uuid5(_NS, "|".join(parts))


MSP_ID    = _uid("msp", "airgap-cyber")
ORG_ID    = _uid("org", "meridian-defense")
PROGRAM_ID = _uid("prog", "meridian-cmmc-l2-2026")

USER_ADMIN    = _uid("user", "admin@meridian-defense.demo")
USER_ENGINEER = _uid("user", "engineer@meridian-defense.demo")
USER_AUDITOR  = _uid("user", "auditor@meridian-defense.demo")

DEMO_USERS = [
    (USER_ADMIN,    "admin@meridian-defense.demo",    "Demo Admin",      "client_admin", "DemoAdmin2026!"),
    (USER_ENGINEER, "engineer@meridian-defense.demo", "Demo Engineer",   "client_user",  "DemoUser2026!"),
    (USER_AUDITOR,  "auditor@meridian-defense.demo",  "Demo Auditor",    "client_user",  "DemoUser2026!"),
]

# ── Status distribution (target 407 controls) ─────────────────────────────────
# Ordered list — assigned cyclically by index-sorted control_definitions.
# Phase 1-2 controls → fully_implemented/begun; later phases → not addressed.
STATUS_SEQUENCE = (
    ["fully_implemented"] * 95
    + ["implementation_begun"] * 55
    + ["implementation_planned"] * 70
    + ["not_yet_addressed"] * 142
    + ["not_applicable"] * 45
)

# ── Artifacts + assessments ───────────────────────────────────────────────────
DEMO_ARTIFACTS = [
    {
        "name": "Access Control Policy v2.1",
        "verdict": "met", "confidence": 0.91,
        "rationale": "Document fully covers access control requirements for CMMC AC domain.",
        "gaps": [],
    },
    {
        "name": "Incident Response Plan v3",
        "verdict": "partial", "confidence": 0.74,
        "rationale": "IR plan covers most requirements but lacks tabletop exercise documentation.",
        "gaps": ["No documented tabletop exercise record for last 12 months"],
    },
    {
        "name": "System Security Plan (draft)",
        "verdict": "partial", "confidence": 0.61,
        "rationale": "SSP draft is incomplete — system boundary not fully described.",
        "gaps": ["System boundary diagram missing", "Personnel responsibilities section empty"],
    },
    {
        "name": "MFA Configuration Export",
        "verdict": "met", "confidence": 0.88,
        "rationale": "MFA enforced on all privileged accounts per IA.3.083 requirement.",
        "gaps": [],
    },
    {
        "name": "Vulnerability Scan Report Q1 2026",
        "verdict": "not_met", "confidence": 0.95,
        "rationale": "Scan reveals 3 critical CVEs unpatched beyond 30-day remediation SLA.",
        "gaps": ["CVE-2024-1234 unpatched", "CVE-2024-5678 unpatched", "CVE-2024-9012 unpatched"],
    },
    {
        "name": "Network Diagram v1.2",
        "verdict": "met", "confidence": 0.82,
        "rationale": "Network diagram accurately depicts CUI boundary and segmentation.",
        "gaps": [],
    },
]

# ── Milestones ────────────────────────────────────────────────────────────────
NOW = datetime.now(timezone.utc)

DEMO_MILESTONES = [
    {"label": "Phase 1 Baseline Complete",   "delta_days": -60,  "complete": True},
    {"label": "Phase 2 Kickoff",             "delta_days": -30,  "complete": True},
    {"label": "IR Plan Remediation",         "delta_days":  14,  "complete": False},
    {"label": "Vulnerability Remediation",   "delta_days":  21,  "complete": False},
    {"label": "SSP First Draft Complete",    "delta_days":  45,  "complete": False},
    {"label": "Phase 3 Kickoff",             "delta_days":  60,  "complete": False},
    {"label": "Configuration Baseline Lock", "delta_days":  90,  "complete": False},
    {"label": "Internal Readiness Review",   "delta_days": 120,  "complete": False},
    {"label": "C3PAO Assessment Scheduled",  "delta_days": 180,  "complete": False},
    {"label": "CMMC Level 2 Certification",  "delta_days": 210,  "complete": False},
]


# ── Authentik helpers ──────────────────────────────────────────────────────────

def authentik_create_user(base_url: str, token: str, email: str, name: str, password: str, dry_run: bool) -> None:
    import requests
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    if dry_run:
        print(f"  [dry-run] Authentik: would create user {email}")
        return

    # Check if user exists
    r = requests.get(f"{base_url}/api/v3/core/users/", headers=headers,
                     params={"username": email}, timeout=10)
    existing = r.json().get("results", [])
    if existing:
        uid = existing[0]["pk"]
        print(f"  Authentik user exists (pk={uid}): {email}")
    else:
        payload = {
            "username": email,
            "email": email,
            "name": name,
            "is_active": True,
            "groups": [],
            "attributes": {},
        }
        cr = requests.post(f"{base_url}/api/v3/core/users/", headers=headers, json=payload, timeout=10)
        if cr.status_code not in (200, 201):
            print(f"  WARN: Authentik create user failed for {email}: {cr.status_code} {cr.text[:200]}")
            return
        uid = cr.json()["pk"]
        print(f"  Authentik created user (pk={uid}): {email}")

    # Set password
    pr = requests.post(f"{base_url}/api/v3/core/users/{uid}/set_password/",
                       headers=headers, json={"password": password}, timeout=10)
    if pr.status_code not in (200, 201, 204):
        print(f"  WARN: set_password failed for {email}: {pr.status_code}")
    else:
        print(f"  Password set: {email}")


def authentik_delete_user(base_url: str, token: str, email: str, dry_run: bool) -> None:
    import requests
    headers = {"Authorization": f"Bearer {token}"}

    if dry_run:
        print(f"  [dry-run] Authentik: would delete user {email}")
        return

    r = requests.get(f"{base_url}/api/v3/core/users/", headers=headers,
                     params={"username": email}, timeout=10)
    results = r.json().get("results", [])
    if not results:
        print(f"  Authentik: user not found (already gone): {email}")
        return
    uid = results[0]["pk"]
    dr = requests.delete(f"{base_url}/api/v3/core/users/{uid}/", headers=headers, timeout=10)
    if dr.status_code == 204:
        print(f"  Authentik: deleted user {email}")
    else:
        print(f"  WARN: delete user failed: {dr.status_code}")


# ── Database seeding ──────────────────────────────────────────────────────────

async def seed(dry_run: bool = False) -> None:
    import asyncpg
    dsn = postgres()
    print(f"\n[DB] Connecting to Postgres...")
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=3, command_timeout=30)

    async with pool.acquire() as conn:
        # Fetch all control_definitions ordered for deterministic status assignment
        ctrl_defs = await conn.fetch(
            """
            SELECT id, nist_id, cmmc_id, family_abbrev, far_above_phase, dod_score_value
            FROM control_definitions
            ORDER BY nist_sort_order, nist_id
            """
        )
        total_ctrls = len(ctrl_defs)
        print(f"[DB] Found {total_ctrls} control_definitions")

        if dry_run:
            print(f"[dry-run] Would seed:")
            print(f"  MSP:     AirGap Cyber ({MSP_ID})")
            print(f"  Org:     Meridian Defense Systems LLC ({ORG_ID})")
            print(f"  Program: CMMC Level 2 — FY2026 ({PROGRAM_ID})")
            print(f"  Controls: {total_ctrls} program_controls")
            print(f"  Users:   {len(DEMO_USERS)}")
            print(f"  Artifacts: {len(DEMO_ARTIFACTS)}")
            print(f"  Milestones: {len(DEMO_MILESTONES)}")
            await pool.close()
            return

        async with conn.transaction():
            # 1. MSP
            await conn.execute(
                """
                INSERT INTO msps (id, name, slug, status, created_at)
                VALUES ($1, $2, $3, 'active', NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                MSP_ID, "AirGap Cyber", "airgap-cyber",
            )
            print(f"  MSP: AirGap Cyber ({MSP_ID})")

            # 2. Org
            await conn.execute(
                """
                INSERT INTO orgs (id, msp_id, name, slug, status, cage_code, created_at)
                VALUES ($1, $2, $3, $4, 'active', 'DEMO1', NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                ORG_ID, MSP_ID,
                "Meridian Defense Systems LLC", "meridian-defense",
            )
            print(f"  Org: Meridian Defense Systems LLC ({ORG_ID})")

            # 3. Users (DB records)
            for uid, email, name, role, _ in DEMO_USERS:
                org_fk  = ORG_ID if role in ("client_admin", "client_user") else None
                msp_fk  = MSP_ID if role == "msp_admin" else None
                await conn.execute(
                    """
                    INSERT INTO users (id, org_id, msp_id, email, full_name, role, is_active, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, TRUE, NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    uid, org_fk, msp_fk, email, name, role,
                )
            print(f"  Users: {len(DEMO_USERS)} DB records inserted")

            # 4. Program
            await conn.execute(
                """
                INSERT INTO programs (
                    id, org_id, name, system_name, status, current_phase,
                    sprs_score, far_above_score, created_at
                )
                VALUES ($1, $2, $3, $4, 'in_progress', 2, -42, -42, NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                PROGRAM_ID, ORG_ID,
                "CMMC Level 2 — FY2026 Assessment",
                "Meridian Enterprise CUI Network",
            )
            print(f"  Program: CMMC Level 2 — FY2026 ({PROGRAM_ID})")

            # 5. Program controls (all 407)
            seq = STATUS_SEQUENCE[:total_ctrls]
            if total_ctrls > len(STATUS_SEQUENCE):
                seq += ["not_yet_addressed"] * (total_ctrls - len(STATUS_SEQUENCE))

            records = []
            for i, cd in enumerate(ctrl_defs):
                status = seq[i]
                is_applicable = (status != "not_applicable")
                is_unlocked = cd["far_above_phase"] in (None, "1", "2", 1, 2)
                pc_id = _uid("pc", str(PROGRAM_ID), str(cd["id"]))
                records.append((
                    pc_id, PROGRAM_ID, cd["id"],
                    status, is_applicable, is_unlocked,
                ))

            await conn.executemany(
                """
                INSERT INTO program_controls
                    (id, program_id, control_definition_id, status, is_applicable, is_phase_unlocked, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())
                ON CONFLICT (id) DO NOTHING
                """,
                records,
            )
            print(f"  Program controls: {len(records)} inserted")

            # 6. Assignments (25 across engineer + auditor, mix of open/overdue/complete)
            # Pick the first 25 non-fully-implemented program_controls
            pc_rows = await conn.fetch(
                """
                SELECT id FROM program_controls
                WHERE program_id = $1 AND status != 'fully_implemented'
                ORDER BY created_at LIMIT 25
                """,
                PROGRAM_ID,
            )
            assignees = [USER_ENGINEER, USER_AUDITOR]
            assignment_statuses = ["open"] * 15 + ["completed"] * 7 + ["overdue"] * 3
            for j, row in enumerate(pc_rows):
                a_id = _uid("assign", str(row["id"]))
                due = NOW + timedelta(days=[-14, 7, 14, 30, 45][j % 5])
                await conn.execute(
                    """
                    INSERT INTO assignments
                        (id, program_control_id, program_id, assigned_to, assigned_by,
                         status, due_date, instructions, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    a_id, row["id"], PROGRAM_ID,
                    assignees[j % 2], USER_ADMIN,
                    assignment_statuses[j % len(assignment_statuses)],
                    due.date(),
                    "Gather evidence and upload supporting documentation.",
                )
            print(f"  Assignments: {len(pc_rows)} inserted")

            # 7. Artifacts + assessments (6)
            # Pin to first 6 not-yet-addressed / partially-done controls
            art_pcs = await conn.fetch(
                """
                SELECT id FROM program_controls
                WHERE program_id = $1 AND status IN ('implementation_begun','not_yet_addressed')
                ORDER BY created_at LIMIT 6
                """,
                PROGRAM_ID,
            )
            for k, art_def in enumerate(DEMO_ARTIFACTS):
                pc_row = art_pcs[k] if k < len(art_pcs) else art_pcs[0]
                art_id = _uid("artifact", art_def["name"])
                assess_id = _uid("assess", art_def["name"])

                await conn.execute(
                    """
                    INSERT INTO artifacts
                        (id, program_control_id, org_id, file_name, file_path,
                         mime_type, file_size, assessment_status, created_at)
                    VALUES ($1, $2, $3, $4, $5, 'application/pdf', 204800, 'assessed', NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    art_id, pc_row["id"], ORG_ID,
                    art_def["name"] + ".pdf",
                    f"cmmc-artifacts/{ORG_ID}/demo/{art_id}.pdf",
                )
                await conn.execute(
                    """
                    INSERT INTO assessments
                        (id, artifact_id, org_id, verdict, confidence, rationale,
                         gaps, model_used, reviewer_override, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, 'openrouter/auto', FALSE, NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    assess_id, art_id, ORG_ID,
                    art_def["verdict"], art_def["confidence"],
                    art_def["rationale"], art_def["gaps"],
                )
            print(f"  Artifacts + assessments: {len(DEMO_ARTIFACTS)} pairs inserted")

            # 8. Milestones
            milestone_pcs = await conn.fetch(
                "SELECT id FROM program_controls WHERE program_id = $1 LIMIT $2",
                PROGRAM_ID, len(DEMO_MILESTONES),
            )
            for m, ms in enumerate(DEMO_MILESTONES):
                pc_id = milestone_pcs[m]["id"] if m < len(milestone_pcs) else milestone_pcs[0]["id"]
                ms_id = _uid("milestone", ms["label"])
                target = (NOW + timedelta(days=ms["delta_days"])).date()
                await conn.execute(
                    """
                    INSERT INTO milestones
                        (id, program_control_id, responsible_org, resource_estimate,
                         remediation_plan, current_milestone_date, is_complete, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                    ON CONFLICT (id) DO NOTHING
                    """,
                    ms_id, pc_id,
                    "Meridian Defense Systems LLC",
                    "2 engineer-weeks",
                    ms["label"],
                    target,
                    ms["complete"],
                )
            print(f"  Milestones: {len(DEMO_MILESTONES)} inserted")

            # 9. Activity log (40 entries)
            actions = [
                ("artifact_uploaded",      USER_ENGINEER),
                ("control_status_changed", USER_ADMIN),
                ("assignment_created",     USER_ADMIN),
                ("artifact_assessed",      None),
                ("team_member_invited",    USER_ADMIN),
            ]
            for n in range(40):
                action, actor = actions[n % len(actions)]
                al_id = _uid("activity", str(n))
                ts = NOW - timedelta(hours=n * 6)
                await conn.execute(
                    """
                    INSERT INTO activity_log
                        (id, org_id, program_id, action, actor_id, metadata, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    al_id, ORG_ID, PROGRAM_ID,
                    action, actor,
                    json.dumps({"demo": True, "index": n}),
                    ts,
                )
            print(f"  Activity log: 40 entries inserted")

    await pool.close()
    print("\n[DB] Done.")


async def teardown(dry_run: bool = False) -> None:
    import asyncpg
    dsn = postgres()
    print(f"\n[DB] Connecting for teardown...")
    pool = await asyncpg.create_pool(dsn, min_size=1, max_size=3, command_timeout=30)

    if dry_run:
        print("[dry-run] Would DELETE org cascade for Meridian Defense + AirGap Cyber MSP")
        await pool.close()
        return

    async with pool.acquire() as conn:
        async with conn.transaction():
            # Cascade deletes via FK (program_controls → assignments, artifacts, etc.)
            deleted = await conn.fetchval(
                "DELETE FROM orgs WHERE id = $1 RETURNING id", ORG_ID
            )
            print(f"  Org deleted: {deleted}")

            deleted_msp = await conn.fetchval(
                "DELETE FROM msps WHERE id = $1 RETURNING id", MSP_ID
            )
            print(f"  MSP deleted: {deleted_msp}")

            for uid, email, _, _, _ in DEMO_USERS:
                await conn.execute("DELETE FROM users WHERE id = $1", uid)
                print(f"  User deleted: {email}")

    await pool.close()
    print("[DB] Teardown done.")


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Seed demo client data")
    parser.add_argument("--teardown", action="store_true", help="Delete demo data")
    parser.add_argument("--dry-run", action="store_true", help="Print plan, no writes")
    parser.add_argument("--skip-authentik", action="store_true",
                        help="Skip Authentik user creation (DB-only)")
    args = parser.parse_args()

    dry_run = args.dry_run

    if args.teardown:
        print("=" * 60)
        print("TEARDOWN: Meridian Defense demo data")
        print("=" * 60)
        asyncio.run(teardown(dry_run=dry_run))

        if not args.skip_authentik:
            print("\n[Authentik] Removing users...")
            try:
                auth_url, auth_token = authentik()
                for _, email, _, _, _ in DEMO_USERS:
                    authentik_delete_user(auth_url, auth_token, email, dry_run)
            except SystemExit:
                print("  Skipping Authentik (no credentials)")
        return

    print("=" * 60)
    print("SEED: Meridian Defense Systems LLC demo client")
    print("=" * 60)

    print("\n[DB] Seeding...")
    asyncio.run(seed(dry_run=dry_run))

    if not args.skip_authentik:
        print("\n[Authentik] Creating users...")
        try:
            auth_url, auth_token = authentik()
            for _, email, name, _, password in DEMO_USERS:
                authentik_create_user(auth_url, auth_token, email, name, password, dry_run)
        except SystemExit:
            print("  Skipping Authentik (no credentials configured)")
            print("  Set AUTHENTIK_URL + AUTHENTIK_API_TOKEN to enable user creation")

    print("\n" + "=" * 60)
    print("Demo Data Summary:")
    print("  Org:     Meridian Defense Systems LLC  (slug: meridian-defense)")
    print("  MSP:     AirGap Cyber")
    print("  Program: CMMC Level 2 — FY2026 Assessment")
    print("  SPRS:    ~-42 (realistic mid-progress state)")
    print()
    print("  Users:")
    for _, email, _, role, password in DEMO_USERS:
        print(f"    {email}  ({role})  password: {password}")
    print()
    print("  URL:  https://app.cmmc4msp.on-nex.us/meridian-defense/dashboard")
    print("=" * 60)

    if dry_run:
        print("  [DRY RUN — no changes were made]")


if __name__ == "__main__":
    main()
