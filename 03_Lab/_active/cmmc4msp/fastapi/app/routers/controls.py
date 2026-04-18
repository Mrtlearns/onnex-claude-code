"""Controls router — control definitions and program-level control management."""
from __future__ import annotations

import json
import uuid
from typing import Any, Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.logging_config import get_logger
from app.models import ControlStatusUpdate
from app.services import sprs_service
from app.services import error_events_service
from app.services.background import run_with_pool
from app.services.copilot_service import build_context, stream_chat

logger = get_logger(__name__)

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
    message: str = Field(..., max_length=4000)


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
    pool = request.app.state.pool

    async def _stream():
        async for chunk in stream_chat(system_prompt, history, body.message):
            full_response.append(chunk)
            yield chunk
        # Save assistant response after streaming completes using a fresh connection
        content = "".join(
            json.loads(c[6:])["content"]
            for c in full_response
            if c.startswith("data: ")
            and c.strip() != "data: [DONE]"
            and c[6:].strip() != "[DONE]"
            and "{" in c
        )
        if content:
            async with pool.acquire() as write_conn:
                await write_conn.execute(
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


# ---------------------------------------------------------------------------
# Policy Draft endpoints
# ---------------------------------------------------------------------------


class DraftReviewRequest(BaseModel):
    status: str  # 'reviewed' | 'rejected'
    reviewer_notes: Optional[str] = None


@router.post("/program/{program_id}/{control_id}/draft-policy", status_code=202)
async def generate_draft_policy(
    program_id: str,
    control_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Trigger async policy draft generation. Returns draft_id immediately."""
    try:
        pc_uid = uuid.UUID(control_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        "SELECT pc.id, p.org_id FROM program_controls pc JOIN programs p ON pc.program_id = p.id WHERE pc.id = $1 AND p.id = $2",
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    # Create placeholder draft record immediately
    draft_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO policy_drafts (id, program_control_id, generated_by, content_markdown, status)
        VALUES ($1, $2, $3, '', 'generating')
        """,
        draft_id, pc_uid, uuid.UUID(user["user_id"]),
    )

    pool = request.app.state.pool
    minio = request.app.state.minio
    actor_uid = uuid.UUID(user["user_id"])
    correlation_id = getattr(request.state, "correlation_id", None)
    org_id = str(pc["org_id"]) if pc["org_id"] else None

    async def _generate(conn: asyncpg.Connection) -> None:
        from app.services.policy_draft_service import generate_policy_draft
        await generate_policy_draft(pc_uid, actor_uid, conn, minio)
        await conn.execute(
            "UPDATE policy_drafts SET status = 'draft' WHERE id = $1", draft_id
        )

    async def _on_error(conn: asyncpg.Connection, exc: Exception) -> None:
        await conn.execute(
            "UPDATE policy_drafts SET status = 'error', error_message=$1 WHERE id = $2",
            str(exc)[:2000], draft_id,
        )

    background_tasks.add_task(
        run_with_pool, pool, _generate,
        component="controls.policy_draft",
        correlation_id=correlation_id,
        org_id=org_id,
        on_error=_on_error,
    )
    return {"draft_id": str(draft_id), "status": "generating"}


@router.get("/program/{program_id}/{control_id}/draft-policy")
async def list_draft_policies(
    program_id: str,
    control_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """List all drafts for a control."""
    try:
        pc_uid = uuid.UUID(control_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        "SELECT pc.id, p.org_id FROM program_controls pc JOIN programs p ON pc.program_id = p.id WHERE pc.id = $1 AND p.id = $2",
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT pd.id, pd.status, pd.created_at, pd.reviewed_at, pd.reviewer_notes,
               pd.minio_key, u.full_name AS generated_by_name, r.full_name AS reviewed_by_name
        FROM policy_drafts pd
        JOIN users u ON pd.generated_by = u.id
        LEFT JOIN users r ON pd.reviewed_by = r.id
        WHERE pd.program_control_id = $1
        ORDER BY pd.created_at DESC
        """,
        pc_uid,
    )
    return {
        "drafts": [
            {
                "id": str(r["id"]),
                "status": r["status"],
                "created_at": r["created_at"].isoformat(),
                "generated_by": r["generated_by_name"],
                "reviewed_by": r.get("reviewed_by_name"),
                "reviewed_at": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                "reviewer_notes": r["reviewer_notes"],
                "has_docx": bool(r["minio_key"]),
            }
            for r in rows
        ]
    }


@router.get("/program/{program_id}/{control_id}/draft-policy/{draft_id}")
async def get_draft_policy(
    program_id: str,
    control_id: str,
    draft_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get draft content + DOCX download URL."""
    try:
        pc_uid = uuid.UUID(control_id)
        draft_uid = uuid.UUID(draft_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    draft = await conn.fetchrow(
        """
        SELECT pd.*, p.org_id
        FROM policy_drafts pd
        JOIN program_controls pc ON pd.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE pd.id = $1 AND pd.program_control_id = $2
        """,
        draft_uid, pc_uid,
    )
    if not draft:
        raise HTTPException(404, "Draft not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(draft["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    docx_url = None
    if draft["minio_key"]:
        from app.services.minio_service import get_presigned_download_url
        docx_url = get_presigned_download_url(
            request.app.state.minio_public, "cmmc-drafts", draft["minio_key"]
        )

    return {
        "id": str(draft["id"]),
        "status": draft["status"],
        "content_markdown": draft["content_markdown"],
        "docx_url": docx_url,
        "reviewer_notes": draft["reviewer_notes"],
        "model_used": draft["model_used"],
        "created_at": draft["created_at"].isoformat(),
    }


# ---------------------------------------------------------------------------
# Gap Analysis endpoints
# ---------------------------------------------------------------------------


@router.post("/program/{program_id}/{control_id}/gap-analysis", status_code=202)
async def trigger_gap_analysis(
    program_id: str,
    control_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Trigger async gap analysis. Returns immediately; poll GET for results."""
    import uuid as _uuid
    try:
        pc_uid = _uuid.UUID(control_id)
        prog_uid = _uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        "SELECT pc.id, p.org_id FROM program_controls pc JOIN programs p ON pc.program_id = p.id WHERE pc.id = $1 AND p.id = $2",
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    gap_pool = request.app.state.pool
    gap_actor = _uuid.UUID(user["user_id"])
    gap_cid = getattr(request.state, "correlation_id", None)
    gap_org = str(pc["org_id"]) if pc["org_id"] else None

    async def _run(conn: asyncpg.Connection) -> None:
        from app.services.gap_analysis_service import run_gap_analysis
        await run_gap_analysis(pc_uid, gap_actor, conn)

    async def _on_gap_error(conn: asyncpg.Connection, exc: Exception) -> None:
        await conn.execute(
            "UPDATE control_gap_analyses SET status='failed', error_message=$1 "
            "WHERE program_control_id=$2 ORDER BY created_at DESC LIMIT 1",
            str(exc)[:2000], pc_uid,
        )

    background_tasks.add_task(
        run_with_pool, gap_pool, _run,
        component="controls.gap_analysis",
        correlation_id=gap_cid,
        org_id=gap_org,
        on_error=_on_gap_error,
    )
    return {"status": "generating", "message": "Gap analysis started. Poll GET /gap-analysis for results."}


@router.get("/program/{program_id}/{control_id}/gap-analysis")
async def list_gap_analyses(
    program_id: str,
    control_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """List gap analyses for a control."""
    import uuid as _uuid
    try:
        pc_uid = _uuid.UUID(control_id)
        prog_uid = _uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pc = await conn.fetchrow(
        "SELECT pc.id, p.org_id FROM program_controls pc JOIN programs p ON pc.program_id = p.id WHERE pc.id = $1 AND p.id = $2",
        pc_uid, prog_uid,
    )
    if not pc:
        raise HTTPException(404, "Control not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pc["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT id, status, coverage_pct, objectives_covered, objectives_total,
               overall_assessment, suggested_next_upload, created_at
        FROM control_gap_analyses
        WHERE program_control_id = $1
        ORDER BY created_at DESC LIMIT 10
        """,
        pc_uid,
    )
    return {
        "analyses": [
            {
                "id": str(r["id"]),
                "status": r["status"],
                "coverage_pct": r["coverage_pct"],
                "objectives_covered": r["objectives_covered"],
                "objectives_total": r["objectives_total"],
                "overall_assessment": r["overall_assessment"],
                "suggested_next_upload": r["suggested_next_upload"],
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/program/{program_id}/{control_id}/gap-analysis/{analysis_id}")
async def get_gap_analysis(
    program_id: str,
    control_id: str,
    analysis_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get a specific gap analysis by ID."""
    import uuid as _uuid
    try:
        pc_uid = _uuid.UUID(control_id)
        analysis_uid = _uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    row = await conn.fetchrow(
        """
        SELECT ga.*, p.org_id
        FROM control_gap_analyses ga
        JOIN program_controls pc ON ga.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ga.id = $1 AND ga.program_control_id = $2
        """,
        analysis_uid, pc_uid,
    )
    if not row:
        raise HTTPException(404, "Analysis not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(row["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    return {
        "id": str(row["id"]),
        "status": row["status"],
        "gap_report": row["gap_report"],
        "overall_assessment": row["overall_assessment"],
        "suggested_next_upload": row["suggested_next_upload"],
        "coverage_pct": row["coverage_pct"],
        "objectives_covered": row["objectives_covered"],
        "objectives_total": row["objectives_total"],
        "created_at": row["created_at"].isoformat(),
    }


@router.post("/program/{program_id}/{control_id}/draft-policy/{draft_id}/review")
async def review_draft_policy(
    program_id: str,
    control_id: str,
    draft_id: str,
    body: DraftReviewRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """MSP admin: approve or reject a policy draft."""
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(403, "MSP admin role required")
    if body.status not in ("reviewed", "rejected"):
        raise HTTPException(400, "status must be 'reviewed' or 'rejected'")
    try:
        pc_uid = uuid.UUID(control_id)
        draft_uid = uuid.UUID(draft_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    draft = await conn.fetchrow(
        "SELECT id FROM policy_drafts WHERE id = $1 AND program_control_id = $2",
        draft_uid, pc_uid,
    )
    if not draft:
        raise HTTPException(404, "Draft not found")

    await conn.execute(
        """
        UPDATE policy_drafts SET status = $1, reviewed_by = $2, reviewed_at = NOW(), reviewer_notes = $3
        WHERE id = $4
        """,
        body.status, uuid.UUID(user["user_id"]), body.reviewer_notes, draft_uid,
    )
    return {"status": body.status, "draft_id": str(draft_uid)}
