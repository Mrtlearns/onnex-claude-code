"""Assessments router — view and override AI assessments."""
from __future__ import annotations

import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.database import get_db
from app.deps import get_current_user, require_msp_admin
from app.models import AssessmentOverride

router = APIRouter()

# Map assessment verdict to program_control status
_VERDICT_TO_STATUS = {
    "met": "fully_implemented",
    "partial": "partially_implemented",
    "not_met": "not_implemented",
    "not_applicable": "not_applicable",
}


def _row_to_assessment(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "artifact_id": str(row["artifact_id"]),
        "verdict": row.get("verdict"),
        "confidence": row.get("confidence"),
        "rationale": row.get("rationale"),
        "gaps": row.get("gaps") or [],
        "model_used": row.get("model_used"),
        "reviewer_override": row.get("reviewer_override"),
        "reviewer_notes": row.get("reviewer_notes"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


@router.get("/")
async def list_assessments(
    request: Request,
    program_control_id: Optional[str] = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    if program_control_id:
        try:
            pc_uid = uuid.UUID(program_control_id)
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid program_control_id")

        # Authz check via program → org
        pc = await conn.fetchrow(
            """
            SELECT p.org_id
            FROM program_controls pc
            JOIN programs p ON pc.program_id = p.id
            WHERE pc.id = $1
            """,
            pc_uid,
        )
        if not pc:
            raise HTTPException(status_code=404, detail="Program control not found")

        if user["role"] != "msp_admin" and user.get("org_id") != str(pc["org_id"]):
            raise HTTPException(status_code=403, detail="Access denied")

        rows = await conn.fetch(
            """
            SELECT a.*
            FROM assessments a
            JOIN artifacts ar ON a.artifact_id = ar.id
            WHERE ar.program_control_id = $1
            ORDER BY a.created_at DESC
            """,
            pc_uid,
        )
    else:
        if user["role"] == "super_admin":
            rows = await conn.fetch("SELECT * FROM assessments ORDER BY created_at DESC")
        elif user["role"] == "msp_admin":
            msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
            if not msp_uid:
                raise HTTPException(status_code=403, detail="MSP context required")
            rows = await conn.fetch(
                """
                SELECT a.* FROM assessments a
                JOIN artifacts ar ON a.artifact_id = ar.id
                JOIN program_controls pc ON ar.program_control_id = pc.id
                JOIN programs p ON pc.program_id = p.id
                JOIN orgs o ON p.org_id = o.id
                WHERE o.msp_id = $1
                ORDER BY a.created_at DESC
                """,
                msp_uid,
            )
        else:
            raise HTTPException(status_code=403, detail="MSP admin required for unfiltered listing")

    return [_row_to_assessment(r) for r in rows]


@router.get("/{assessment_id}")
async def get_assessment(
    assessment_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        assess_uid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid assessment_id")

    row = await conn.fetchrow(
        """
        SELECT a.*, p.org_id
        FROM assessments a
        JOIN artifacts ar ON a.artifact_id = ar.id
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE a.id = $1
        """,
        assess_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if user["role"] != "msp_admin" and user.get("org_id") != str(row["org_id"]):
        raise HTTPException(status_code=403, detail="Access denied")

    return _row_to_assessment(row)


@router.post("/{assessment_id}/override")
async def override_assessment(
    assessment_id: str,
    body: AssessmentOverride,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    try:
        assess_uid = uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid assessment_id")

    row = await conn.fetchrow(
        "SELECT * FROM assessments WHERE id = $1",
        assess_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Assessment not found")

    if user["role"] == "msp_admin":
        msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
        if msp_uid:
            owner = await conn.fetchrow(
                """
                SELECT o.msp_id FROM assessments a
                JOIN artifacts ar ON a.artifact_id = ar.id
                JOIN program_controls pc ON ar.program_control_id = pc.id
                JOIN programs p ON pc.program_id = p.id
                JOIN orgs o ON p.org_id = o.id
                WHERE a.id = $1
                """,
                assess_uid,
            )
            if not owner or str(owner["msp_id"]) != str(msp_uid):
                raise HTTPException(status_code=403, detail="Access denied")

    # Update assessment
    updated = await conn.fetchrow(
        """
        UPDATE assessments
        SET verdict = $1,
            reviewer_notes = $2,
            reviewer_override = TRUE,
            updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        body.verdict,
        body.reviewer_notes,
        assess_uid,
    )

    # Propagate verdict to program_control status
    new_status = _VERDICT_TO_STATUS.get(body.verdict)
    if new_status:
        # Resolve program_control_id from the artifact
        artifact = await conn.fetchrow(
            "SELECT program_control_id FROM artifacts WHERE id = $1",
            row["artifact_id"],
        )
        if artifact:
            await conn.execute(
                """
                UPDATE program_controls
                SET status = $1, updated_at = NOW()
                WHERE id = $2
                """,
                new_status,
                artifact["program_control_id"],
            )

    return _row_to_assessment(updated)
