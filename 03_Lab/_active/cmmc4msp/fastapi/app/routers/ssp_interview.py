"""SSP Interview router — conversational SSP narrative generation."""
from __future__ import annotations

import json
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.services.ssp_interview_service import (
    SECTIONS,
    SSP_FIELD_MAP,
    generate_section,
    pre_populate_from_inventory,
)

router = APIRouter()


class AnswersRequest(BaseModel):
    responses: dict[str, str]


class ReviewRequest(BaseModel):
    section: str
    decision: str  # 'approved' | 'rejected'
    notes: Optional[str] = None


@router.post("", status_code=201)
async def start_interview(
    program_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Start a new SSP interview. Pre-populates answers from inventory."""
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    program = await conn.fetchrow(
        "SELECT id, org_id FROM programs WHERE id = $1", prog_uid
    )
    if not program:
        raise HTTPException(404, "Program not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(program["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    pre_populated = await pre_populate_from_inventory(prog_uid, conn)
    interview_id = uuid.uuid4()

    await conn.execute(
        """
        INSERT INTO ssp_interviews (id, program_id, started_by, responses)
        VALUES ($1, $2, $3, $4)
        """,
        interview_id, prog_uid, uuid.UUID(user["user_id"]),
        json.dumps(pre_populated),
    )

    return {
        "interview_id": str(interview_id),
        "status": "in_progress",
        "sections": list(SECTIONS.keys()),
        "pre_populated_questions": list(pre_populated.keys()),
        "questions": {
            section: [{"id": q["id"], "text": q["text"]} for q in data["questions"]]
            for section, data in SECTIONS.items()
        },
        "responses": pre_populated,
    }


@router.get("/{interview_id}")
async def get_interview(
    program_id: str,
    interview_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get current interview state."""
    try:
        prog_uid = uuid.UUID(program_id)
        interview_uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    interview = await conn.fetchrow(
        """
        SELECT si.*, p.org_id
        FROM ssp_interviews si
        JOIN programs p ON si.program_id = p.id
        WHERE si.id = $1 AND si.program_id = $2
        """,
        interview_uid, prog_uid,
    )
    if not interview:
        raise HTTPException(404, "Interview not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(interview["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    return {
        "id": str(interview["id"]),
        "status": interview["status"],
        "responses": interview["responses"],
        "generated_sections": interview["generated_sections"],
        "sections_reviewed": interview["sections_reviewed"],
        "reviewer_notes": interview["reviewer_notes"],
    }


@router.patch("/{interview_id}")
async def update_answers(
    program_id: str,
    interview_id: str,
    body: AnswersRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Submit or update answers for any questions."""
    try:
        prog_uid = uuid.UUID(program_id)
        interview_uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    interview = await conn.fetchrow(
        """
        SELECT si.id, si.responses, p.org_id
        FROM ssp_interviews si
        JOIN programs p ON si.program_id = p.id
        WHERE si.id = $1 AND si.program_id = $2
        """,
        interview_uid, prog_uid,
    )
    if not interview:
        raise HTTPException(404, "Interview not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(interview["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    existing = dict(interview["responses"]) if interview["responses"] else {}
    existing.update(body.responses)

    await conn.execute(
        "UPDATE ssp_interviews SET responses = $1, updated_at = NOW() WHERE id = $2",
        json.dumps(existing), interview_uid,
    )
    return {"interview_id": str(interview_uid), "responses": existing}


@router.post("/{interview_id}/generate")
async def generate_narratives(
    program_id: str,
    interview_id: str,
    background_tasks: BackgroundTasks,
    sections: Optional[list[str]] = None,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Generate narrative sections. Background task — poll GET for results."""
    try:
        prog_uid = uuid.UUID(program_id)
        interview_uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    interview = await conn.fetchrow(
        """
        SELECT si.responses, p.org_id, p.id AS program_id, p.name AS program_name,
               p.system_name, o.name AS org_name, o.cage_code
        FROM ssp_interviews si
        JOIN programs p ON si.program_id = p.id
        JOIN orgs o ON p.org_id = o.id
        WHERE si.id = $1 AND si.program_id = $2
        """,
        interview_uid, prog_uid,
    )
    if not interview:
        raise HTTPException(404, "Interview not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(interview["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    target_sections = sections or list(SECTIONS.keys())
    responses = dict(interview["responses"]) if interview["responses"] else {}
    program = dict(interview)

    async def _generate_all():
        generated: dict[str, str] = {}
        for section in target_sections:
            try:
                text = await generate_section(section, responses, program, conn)
                generated[section] = text
            except Exception:
                generated[section] = f"[Generation failed for {section}]"

        # Merge with existing generated sections
        existing_gen: dict = {}
        current = await conn.fetchrow(
            "SELECT generated_sections FROM ssp_interviews WHERE id = $1", interview_uid
        )
        if current and current["generated_sections"]:
            existing_gen = dict(current["generated_sections"])
        existing_gen.update(generated)

        await conn.execute(
            "UPDATE ssp_interviews SET generated_sections = $1, status = 'awaiting_review', updated_at = NOW() WHERE id = $2",
            json.dumps(existing_gen), interview_uid,
        )

    background_tasks.add_task(_generate_all)
    return {"status": "generating", "sections": target_sections}


@router.post("/{interview_id}/review")
async def review_section(
    program_id: str,
    interview_id: str,
    body: ReviewRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """MSP admin: approve or reject a section."""
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(403, "MSP admin role required")
    try:
        prog_uid = uuid.UUID(program_id)
        interview_uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    if body.decision not in ("approved", "rejected"):
        raise HTTPException(400, "decision must be 'approved' or 'rejected'")
    if body.section not in SECTIONS:
        raise HTTPException(400, f"Unknown section: {body.section}")

    interview = await conn.fetchrow(
        """
        SELECT si.sections_reviewed, si.reviewer_notes
        FROM ssp_interviews si
        WHERE si.id = $1 AND si.program_id = $2
        """,
        interview_uid, prog_uid,
    )
    if not interview:
        raise HTTPException(404, "Interview not found")

    reviewed = dict(interview["sections_reviewed"]) if interview["sections_reviewed"] else {}
    notes = dict(interview["reviewer_notes"]) if interview["reviewer_notes"] else {}
    reviewed[body.section] = body.decision
    if body.notes:
        notes[body.section] = body.notes

    await conn.execute(
        "UPDATE ssp_interviews SET sections_reviewed = $1, reviewer_notes = $2, updated_at = NOW() WHERE id = $3",
        json.dumps(reviewed), json.dumps(notes), interview_uid,
    )
    return {"section": body.section, "decision": body.decision}


@router.post("/{interview_id}/commit")
async def commit_narratives(
    program_id: str,
    interview_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """MSP admin: commit all approved sections to programs.ssp_* columns."""
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(403, "MSP admin role required")
    try:
        prog_uid = uuid.UUID(program_id)
        interview_uid = uuid.UUID(interview_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    interview = await conn.fetchrow(
        """
        SELECT si.generated_sections, si.sections_reviewed
        FROM ssp_interviews si
        WHERE si.id = $1 AND si.program_id = $2
        """,
        interview_uid, prog_uid,
    )
    if not interview:
        raise HTTPException(404, "Interview not found")

    generated = dict(interview["generated_sections"]) if interview["generated_sections"] else {}
    reviewed = dict(interview["sections_reviewed"]) if interview["sections_reviewed"] else {}

    committed = []
    for section, db_field in SSP_FIELD_MAP.items():
        if reviewed.get(section) == "approved" and section in generated:
            await conn.execute(
                f"UPDATE programs SET {db_field} = $1 WHERE id = $2",
                generated[section], prog_uid,
            )
            committed.append(section)

    await conn.execute(
        "UPDATE ssp_interviews SET status = 'completed', completed_at = NOW() WHERE id = $1",
        interview_uid,
    )

    # Activity log
    await conn.execute(
        """
        INSERT INTO activity_log (org_id, program_id, actor_id, event_type, event_data)
        SELECT p.org_id, p.id, $1, 'ssp_narratives_committed',
               jsonb_build_object('sections_committed', $2::jsonb, 'interview_id', $3::text)
        FROM programs p WHERE p.id = $4
        """,
        uuid.UUID(user["user_id"]), json.dumps(committed), str(interview_uid), prog_uid,
    )

    return {"committed_sections": committed, "status": "completed"}
