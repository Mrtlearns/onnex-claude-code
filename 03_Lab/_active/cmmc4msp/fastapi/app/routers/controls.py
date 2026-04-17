"""Controls router — control definitions and program-level control management."""
from __future__ import annotations

import json
import uuid
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.models import ControlStatusUpdate
from app.services import sprs_service
from app.services.copilot_service import build_context, stream_chat

router = APIRouter()


def _row_to_definition(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "nist_id": row["nist_id"],
        "cmmc_id": row.get("cmmc_id"),
        "family": row.get("family"),
        "family_abbrev": row.get("family_abbrev"),
        "far_above_phase": row.get("far_above_phase"),
        "dod_score_value": row.get("dod_score_value"),
        "requirement_text": row.get("requirement_text"),
        "assessment_objective": row.get("assessment_objective"),
        "acceptable_proof_guidance": row.get("acceptable_proof_guidance"),
        "is_objective": row.get("is_objective"),
        "is_basic": row.get("is_basic"),
    }


def _row_to_program_control(row: asyncpg.Record) -> dict:
    target = row.get("target_completion_date")
    return {
        "id": str(row["id"]),
        "program_id": str(row["program_id"]),
        "control_definition_id": str(row["control_definition_id"]),
        "status": row.get("status"),
        "is_applicable": row.get("is_applicable"),
        "is_phase_unlocked": row.get("is_phase_unlocked"),
        "implementation_notes": row.get("implementation_notes"),
        "score_impact": row.get("score_impact"),
        "target_completion_date": target.isoformat() if target else None,
        # joined fields
        "nist_id": row.get("nist_id"),
        "cmmc_id": row.get("cmmc_id"),
        "family": row.get("family"),
        "family_abbrev": row.get("family_abbrev"),
        "far_above_phase": row.get("far_above_phase"),
        "dod_score_value": row.get("dod_score_value"),
        "requirement_text": row.get("requirement_text"),
    }


@router.get("/definitions")
async def list_definitions(
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    rows = await conn.fetch(
        """
        SELECT * FROM control_definitions
        ORDER BY far_above_phase, nist_sort_order
        """
    )
    return [_row_to_definition(r) for r in rows]


@router.get("/program/{program_id}")
async def list_program_controls(
    program_id: str,
    request: Request,
    phase: Optional[str] = Query(None),
    family: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    prog = await conn.fetchrow("SELECT org_id FROM programs WHERE id = $1", prog_uid)
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    require_same_org(str(prog["org_id"]), user)

    conditions = ["pc.program_id = $1"]
    params: list[Any] = [prog_uid]
    idx = 2

    if phase:
        conditions.append(f"cd.far_above_phase = ${idx}")
        params.append(phase)
        idx += 1
    if family:
        conditions.append(f"cd.family_abbrev = ${idx}")
        params.append(family)
        idx += 1
    if status:
        conditions.append(f"pc.status = ${idx}")
        params.append(status)
        idx += 1

    where = " AND ".join(conditions)
    rows = await conn.fetch(
        f"""
        SELECT
            pc.*,
            cd.nist_id, cd.cmmc_id, cd.family, cd.family_abbrev,
            cd.far_above_phase, cd.dod_score_value, cd.requirement_text
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE {where}
        ORDER BY cd.far_above_phase, cd.nist_sort_order
        """,
        *params,
    )
    return [_row_to_program_control(r) for r in rows]


@router.get("/program/{program_id}/{control_id}")
async def get_program_control(
    program_id: str,
    control_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
        ctrl_uid = uuid.UUID(control_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    prog = await conn.fetchrow("SELECT org_id FROM programs WHERE id = $1", prog_uid)
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    require_same_org(str(prog["org_id"]), user)

    row = await conn.fetchrow(
        """
        SELECT
            pc.*,
            cd.nist_id, cd.cmmc_id, cd.family, cd.family_abbrev,
            cd.far_above_phase, cd.dod_score_value, cd.requirement_text
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.id = $1 AND pc.program_id = $2
        """,
        ctrl_uid,
        prog_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Program control not found")

    result = _row_to_program_control(row)

    # Attach latest assessment
    assessment = await conn.fetchrow(
        """
        SELECT a.*
        FROM assessments a
        JOIN artifacts ar ON a.artifact_id = ar.id
        WHERE ar.program_control_id = $1
        ORDER BY a.created_at DESC
        LIMIT 1
        """,
        ctrl_uid,
    )
    if assessment:
        result["latest_assessment"] = {
            "id": str(assessment["id"]),
            "verdict": assessment.get("verdict"),
            "confidence": assessment.get("confidence"),
            "rationale": assessment.get("rationale"),
            "gaps": assessment.get("gaps") or [],
            "model_used": assessment.get("model_used"),
            "reviewer_override": assessment.get("reviewer_override"),
            "created_at": assessment["created_at"].isoformat() if assessment.get("created_at") else None,
        }

    return result


@router.patch("/program/{program_id}/{control_id}")
async def update_program_control(
    program_id: str,
    control_id: str,
    body: ControlStatusUpdate,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
        ctrl_uid = uuid.UUID(control_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    prog = await conn.fetchrow("SELECT org_id FROM programs WHERE id = $1", prog_uid)
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    require_same_org(str(prog["org_id"]), user)

    updates: dict[str, Any] = {
        k: v for k, v in body.model_dump(exclude_none=True).items()
    }
    if not updates:
        row = await conn.fetchrow(
            """
            SELECT pc.*, cd.nist_id, cd.cmmc_id, cd.family, cd.family_abbrev,
                   cd.far_above_phase, cd.dod_score_value, cd.requirement_text
            FROM program_controls pc
            JOIN control_definitions cd ON pc.control_definition_id = cd.id
            WHERE pc.id = $1
            """,
            ctrl_uid,
        )
        return _row_to_program_control(row) if row else {}

    set_clauses = ", ".join(
        f"{col} = ${i + 2}" for i, col in enumerate(updates.keys())
    )
    values = list(updates.values())
    row = await conn.fetchrow(
        f"""
        UPDATE program_controls
        SET {set_clauses}, updated_at = NOW()
        WHERE id = $1 AND program_id = $2
        RETURNING *
        """,
        ctrl_uid,
        prog_uid,
        *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Program control not found")

    # Recalculate SPRS after status change
    await sprs_service.calculate_and_save_sprs(str(prog_uid), conn)

    # Re-fetch with joined definition fields for response
    updated = await conn.fetchrow(
        """
        SELECT pc.*, cd.nist_id, cd.cmmc_id, cd.family, cd.family_abbrev,
               cd.far_above_phase, cd.dod_score_value, cd.requirement_text
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.id = $1
        """,
        ctrl_uid,
    )
    return _row_to_program_control(updated)


# ---------------------------------------------------------------------------
# Copilot chat endpoints
# ---------------------------------------------------------------------------


class ChatMessageRequest(BaseModel):
    message: str


@router.post("/program/{program_id}/{control_id}/chat")
async def send_chat_message(
    program_id: str,
    control_id: str,
    body: ChatMessageRequest,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Send a message to the compliance copilot for this control."""
    try:
        pc_uid = uuid.UUID(control_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    # Verify access
    pc = await conn.fetchrow(
        """
        SELECT pc.id, p.org_id
        FROM program_controls pc
        JOIN programs p ON pc.program_id = p.id
        WHERE pc.id = $1 AND p.id = $2
        """,
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    # Get prior history (last 10 pairs = 20 messages)
    history_rows = await conn.fetch(
        """
        SELECT role, content FROM control_chat_messages
        WHERE program_control_id = $1 AND user_id = $2
        ORDER BY created_at DESC LIMIT 20
        """,
        pc_uid, uuid.UUID(user["user_id"]),
    )
    history = [{"role": r["role"], "content": r["content"]} for r in reversed(history_rows)]

    system_prompt, _ = await build_context(pc_uid, body.message, user.get("org_id", ""), conn)

    # Save user message
    await conn.execute(
        """
        INSERT INTO control_chat_messages (program_control_id, user_id, role, content)
        VALUES ($1, $2, 'user', $3)
        """,
        pc_uid, uuid.UUID(user["user_id"]), body.message,
    )

    full_response: list[str] = []

    async def _stream():
        async for chunk in stream_chat(system_prompt, history, body.message):
            full_response.append(chunk)
            yield chunk
        # Save assistant response after streaming completes
        content = "".join(
            json.loads(c[6:])["content"]
            for c in full_response
            if c.startswith("data: ")
            and c.strip() != "data: [DONE]"
            and c[6:].strip() != "[DONE]"
            and "{" in c
        )
        if content:
            await conn.execute(
                """
                INSERT INTO control_chat_messages
                    (program_control_id, user_id, role, content, model_used)
                VALUES ($1, $2, 'assistant', $3, $4)
                """,
                pc_uid, uuid.UUID(user["user_id"]), content, "anthropic/claude-sonnet-4-6",
            )

    return StreamingResponse(_stream(), media_type="text/event-stream")


@router.get("/program/{program_id}/{control_id}/chat")
async def get_chat_history(
    program_id: str,
    control_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get conversation history for this control/user."""
    try:
        pc_uid = uuid.UUID(control_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        """
        SELECT pc.id, p.org_id
        FROM program_controls pc
        JOIN programs p ON pc.program_id = p.id
        WHERE pc.id = $1 AND p.id = $2
        """,
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT id, role, content, created_at, model_used, tokens_used
        FROM control_chat_messages
        WHERE program_control_id = $1 AND user_id = $2
        ORDER BY created_at ASC
        """,
        pc_uid, uuid.UUID(user["user_id"]),
    )
    return {
        "messages": [
            {
                "id": str(r["id"]),
                "role": r["role"],
                "content": r["content"],
                "created_at": r["created_at"].isoformat(),
                "model_used": r.get("model_used"),
            }
            for r in rows
        ]
    }


@router.delete("/program/{program_id}/{control_id}/chat", status_code=204)
async def clear_chat_history(
    program_id: str,
    control_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
):
    """Clear conversation history for this user/control pair."""
    try:
        pc_uid = uuid.UUID(control_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        """
        SELECT pc.id, p.org_id
        FROM program_controls pc
        JOIN programs p ON pc.program_id = p.id
        WHERE pc.id = $1 AND p.id = $2
        """,
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    await conn.execute(
        "DELETE FROM control_chat_messages WHERE program_control_id = $1 AND user_id = $2",
        pc_uid, uuid.UUID(user["user_id"]),
    )
