"""Programs router."""
from __future__ import annotations

import uuid
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.database import get_db
from app.deps import get_current_user, require_same_org, require_msp_owns_org
from app.models import ProgramCreate, ProgramUpdate

router = APIRouter()


def _row_to_program(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "org_id": str(row["org_id"]),
        "name": row["name"],
        "status": row.get("status"),
        "sprs_score": row.get("sprs_score"),
        "far_above_score": row.get("far_above_score"),
        "current_phase": row.get("current_phase"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


@router.get("/")
async def list_programs(
    request: Request,
    org_id: Optional[str] = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    if user["role"] == "super_admin":
        if org_id:
            rows = await conn.fetch(
                "SELECT * FROM programs WHERE org_id = $1 ORDER BY name",
                uuid.UUID(org_id),
            )
        else:
            rows = await conn.fetch("SELECT * FROM programs ORDER BY name")
    elif user["role"] == "msp_admin":
        msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
        if not msp_uid:
            return []
        if org_id:
            # Verify the requested org belongs to this MSP
            org_row = await conn.fetchrow(
                "SELECT id FROM orgs WHERE id = $1 AND msp_id = $2",
                uuid.UUID(org_id), msp_uid,
            )
            if not org_row:
                raise HTTPException(status_code=403, detail="Org not in your MSP")
            rows = await conn.fetch(
                "SELECT * FROM programs WHERE org_id = $1 ORDER BY name",
                uuid.UUID(org_id),
            )
        else:
            rows = await conn.fetch(
                """
                SELECT p.* FROM programs p
                JOIN orgs o ON p.org_id = o.id
                WHERE o.msp_id = $1
                ORDER BY p.name
                """,
                msp_uid,
            )
    else:
        # Non-admin users see only their own org's programs
        user_org = uuid.UUID(user["org_id"]) if user["org_id"] else None
        if not user_org:
            return []
        rows = await conn.fetch(
            "SELECT * FROM programs WHERE org_id = $1 ORDER BY name",
            user_org,
        )
    return [_row_to_program(r) for r in rows]


@router.get("/{program_id}")
async def get_program(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    row = await conn.fetchrow("SELECT * FROM programs WHERE id = $1", uid)
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")

    if user["role"] == "msp_admin":
        org_row = await conn.fetchrow(
            "SELECT msp_id FROM orgs WHERE id = $1", row["org_id"]
        )
        require_msp_owns_org(org_row["msp_id"] if org_row else None, user)
    else:
        require_same_org(str(row["org_id"]), user)
    return _row_to_program(row)


@router.post("/", status_code=201)
async def create_program(
    body: ProgramCreate,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    require_same_org(str(body.org_id), user)

    # Verify org exists
    org = await conn.fetchrow("SELECT id FROM orgs WHERE id = $1", body.org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    program_id = uuid.uuid4()
    row = await conn.fetchrow(
        """
        INSERT INTO programs (id, org_id, name, system_name, status, sprs_score, far_above_score)
        VALUES ($1, $2, $3, $4, 'scoping', 110, 0)
        RETURNING *
        """,
        program_id,
        body.org_id,
        body.name,
        body.system_name,
    )
    return _row_to_program(row)


@router.get("/{program_id}/reuse-summary")
async def reuse_summary(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Dashboard widget data: how many additional controls could be covered by existing artifacts."""
    try:
        uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    row = await conn.fetchrow("SELECT * FROM programs WHERE id = $1", uid)
    if not row:
        raise HTTPException(status_code=404, detail="Program not found")

    require_same_org(str(row["org_id"]), user)

    # Count distinct artifacts with ≥1 suggestion above threshold for controls
    # that are NOT already satisfied (status not in implemented/fully_implemented)
    summary = await conn.fetchrow(
        """
        SELECT
            COUNT(DISTINCT acs.artifact_id) AS artifact_count,
            COUNT(DISTINCT acs.control_definition_id) AS control_count
        FROM artifact_control_suggestions acs
        JOIN control_definitions cd ON acs.control_definition_id = cd.id
        JOIN program_controls pc ON pc.control_definition_id = cd.id AND pc.program_id = $1
        JOIN artifacts ar ON acs.artifact_id = ar.id
        JOIN program_controls ar_pc ON ar.program_control_id = ar_pc.id AND ar_pc.program_id = $1
        WHERE acs.similarity_score >= 0.78
          AND pc.status NOT IN ('implemented', 'fully_implemented', 'not_applicable')
          AND acs.artifact_id != ar_pc.id
        """,
        uid,
    )

    return {
        "program_id": program_id,
        "artifact_count": int(summary["artifact_count"] or 0),
        "control_count": int(summary["control_count"] or 0),
    }


@router.patch("/{program_id}")
async def update_program(
    program_id: str,
    body: ProgramUpdate,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    existing = await conn.fetchrow("SELECT * FROM programs WHERE id = $1", uid)
    if not existing:
        raise HTTPException(status_code=404, detail="Program not found")

    require_same_org(str(existing["org_id"]), user)

    updates: dict[str, Any] = {
        k: v for k, v in body.model_dump(exclude_none=True).items()
    }
    if not updates:
        return _row_to_program(existing)

    set_clauses = ", ".join(
        f"{col} = ${i + 2}" for i, col in enumerate(updates.keys())
    )
    values = list(updates.values())
    row = await conn.fetchrow(
        f"UPDATE programs SET {set_clauses}, updated_at = NOW() WHERE id = $1 RETURNING *",
        uid,
        *values,
    )
    return _row_to_program(row)


@router.get("/{program_id}/freshness")
async def get_freshness_report(
    program_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Return freshness status for all controls in a program."""
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    program = await conn.fetchrow(
        "SELECT id, org_id FROM programs WHERE id = $1", prog_uid
    )
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")

    if user["role"] not in ("msp_admin", "super_admin") and str(program["org_id"]) != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    rows = await conn.fetch(
        """
        SELECT id, nist_id, freshness_status, last_evidence_at, expires_at, stale_since, evidence_max_age_days
        FROM program_control_freshness
        WHERE program_id = $1
        ORDER BY nist_id
        """,
        prog_uid,
    )
    return {
        "program_id": str(program_id),
        "controls": [
            {
                "id": str(r["id"]),
                "nist_id": r["nist_id"],
                "freshness_status": r["freshness_status"],
                "last_evidence_at": r["last_evidence_at"].isoformat() if r["last_evidence_at"] else None,
                "expires_at": r["expires_at"].isoformat() if r["expires_at"] else None,
                "evidence_max_age_days": r["evidence_max_age_days"],
            }
            for r in rows
        ],
        "summary": {
            "expired": sum(1 for r in rows if r["freshness_status"] == "expired"),
            "expiring_soon": sum(1 for r in rows if r["freshness_status"] == "expiring_soon"),
            "fresh": sum(1 for r in rows if r["freshness_status"] == "fresh"),
            "no_evidence": sum(1 for r in rows if r["freshness_status"] == "no_evidence"),
        },
    }
