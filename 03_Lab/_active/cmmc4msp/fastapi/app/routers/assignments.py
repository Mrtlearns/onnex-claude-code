"""Assignments router — disbursement loop state machine.

Handles bulk control assignment, per-assignment state transitions (with
audit event logging), and enriched assignment detail fetching.

State machine:
  unassigned → assigned → in_progress → submitted → in_review → accepted
                                                             → rejected → reassigned (loop)

All status transitions go through this router (not Hasura direct) so the
state machine is enforced and every transition is logged to assignment_events.
"""
from __future__ import annotations

import asyncio
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user, require_client_admin_or_above
from app.services import n8n_service

router = APIRouter()

# ---------------------------------------------------------------------------
# State machine definition
# ---------------------------------------------------------------------------

_VALID_TRANSITIONS: dict[str, set[str]] = {
    "unassigned": {"assigned"},
    "assigned": {"in_progress", "submitted"},
    "in_progress": {"submitted"},
    "submitted": {"in_review"},
    "in_review": {"accepted", "rejected"},
    "rejected": {"reassigned"},
    "reassigned": {"assigned"},
}

_ADMIN_ROLES = {"msp_admin", "client_admin", "super_admin"}
_CONTRIB_OR_ABOVE = {"contributor", "client_admin", "msp_admin", "super_admin"}


def _can_transition_to(to_status: str, user: dict, row: asyncpg.Record) -> bool:
    """Return True if this user is authorised to trigger the given transition."""
    if to_status in ("assigned", "reassigned"):
        return user["role"] in _ADMIN_ROLES
    if to_status in ("in_progress", "submitted"):
        if user["role"] not in _CONTRIB_OR_ABOVE:
            return False
        # Contributors can only advance their own assignment
        if user["role"] == "contributor":
            return str(row["assigned_to"]) == user["user_id"]
        return True
    if to_status in ("in_review", "accepted", "rejected"):
        return user["role"] in _ADMIN_ROLES
    return False


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class BulkAssignRequest(BaseModel):
    program_id: str
    control_ids: list[str]
    assignee_id: str
    due_date: Optional[str] = None
    instructions: Optional[str] = None


class TransitionRequest(BaseModel):
    to_status: str
    note: Optional[str] = None
    assignee_id: Optional[str] = None  # supply when transitioning to 'assigned' with a new owner


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/bulk", status_code=201)
async def bulk_assign_controls(
    body: BulkAssignRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_client_admin_or_above),
) -> dict:
    """Create or re-assign controls in bulk. Idempotent — updates existing
    assignment if one already exists for a control in this program."""
    try:
        prog_uid = uuid.UUID(body.program_id)
        assignee_uid = uuid.UUID(body.assignee_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID in request")

    program = await conn.fetchrow(
        """
        SELECT p.id, p.org_id, o.msp_id
        FROM programs p
        JOIN orgs o ON p.org_id = o.id
        WHERE p.id = $1
        """,
        prog_uid,
    )
    if not program:
        raise HTTPException(404, "Program not found")

    if user["role"] not in ("msp_admin", "super_admin"):
        if str(program["org_id"]) != user.get("org_id"):
            raise HTTPException(403, "Access denied to this program")

    assignee = await conn.fetchrow(
        "SELECT id, email, full_name FROM users WHERE id = $1 AND is_active = TRUE",
        assignee_uid,
    )
    if not assignee:
        raise HTTPException(404, "Assignee user not found or inactive")

    assignment_ids: list[str] = []
    actor_uid = uuid.UUID(user["user_id"])

    for ctrl_id_str in body.control_ids:
        try:
            ctrl_uid = uuid.UUID(ctrl_id_str)
        except ValueError:
            raise HTTPException(422, f"Invalid control UUID: {ctrl_id_str}")

        existing = await conn.fetchrow(
            "SELECT id, status FROM assignments WHERE program_control_id = $1 AND program_id = $2",
            ctrl_uid,
            prog_uid,
        )
        if existing:
            old_status = existing["status"]
            await conn.execute(
                """
                UPDATE assignments
                SET assigned_to = $1, assigned_by = $2, status = 'assigned',
                    due_date = $3, instructions = $4, updated_at = NOW()
                WHERE id = $5
                """,
                assignee_uid,
                actor_uid,
                body.due_date,
                body.instructions,
                existing["id"],
            )
            await _write_event(conn, str(existing["id"]), user["user_id"], old_status, "assigned")
            assignment_ids.append(str(existing["id"]))
        else:
            new_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO assignments
                  (id, program_id, program_control_id, assigned_to, assigned_by,
                   status, due_date, instructions)
                VALUES ($1, $2, $3, $4, $5, 'assigned', $6, $7)
                """,
                new_id,
                prog_uid,
                ctrl_uid,
                assignee_uid,
                actor_uid,
                body.due_date,
                body.instructions,
            )
            await _write_event(conn, str(new_id), user["user_id"], "unassigned", "assigned")
            assignment_ids.append(str(new_id))

    for aid in assignment_ids:
        asyncio.create_task(
            n8n_service.trigger_assignment_notification(
                assignment_id=aid,
                to_status="assigned",
                assignee_email=assignee["email"],
                context={"assignee_name": assignee["full_name"]},
            )
        )

    return {"created": len(assignment_ids), "assignment_ids": assignment_ids}


@router.post("/{assignment_id}/transition")
async def transition_assignment(
    assignment_id: str,
    body: TransitionRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Advance an assignment through the state machine. Writes an audit event
    and fires an n8n email notification for every transition."""
    try:
        aid = uuid.UUID(assignment_id)
    except ValueError:
        raise HTTPException(422, "Invalid assignment ID")

    row = await conn.fetchrow(
        """
        SELECT a.*, p.org_id
        FROM assignments a
        JOIN programs p ON a.program_id = p.id
        WHERE a.id = $1
        """,
        aid,
    )
    if not row:
        raise HTTPException(404, "Assignment not found")

    if user["role"] not in ("msp_admin", "super_admin"):
        if str(row["org_id"]) != user.get("org_id"):
            raise HTTPException(403, "Access denied")

    from_status = row["status"]
    to_status = body.to_status

    if to_status not in _VALID_TRANSITIONS.get(from_status, set()):
        raise HTTPException(400, f"Cannot transition '{from_status}' → '{to_status}'")

    if not _can_transition_to(to_status, user, row):
        raise HTTPException(403, f"Insufficient role to transition to '{to_status}'")

    actor_uid = uuid.UUID(user["user_id"])
    set_parts: list[str] = ["status = $1", "updated_at = NOW()"]
    vals: list = [to_status, aid]

    if to_status == "submitted":
        set_parts.append("submitted_at = NOW()")

    elif to_status in ("accepted", "rejected"):
        set_parts.append("reviewed_at = NOW()")
        vals.append(actor_uid)
        set_parts.append(f"reviewer_id = ${len(vals)}")
        if body.note:
            vals.append(body.note)
            set_parts.append(f"review_note = ${len(vals)}")

    elif to_status == "assigned" and body.assignee_id:
        try:
            vals.append(uuid.UUID(body.assignee_id))
        except ValueError:
            raise HTTPException(422, "Invalid assignee_id UUID")
        set_parts.append(f"assigned_to = ${len(vals)}")

    await conn.execute(
        f"UPDATE assignments SET {', '.join(set_parts)} WHERE id = $2",
        *vals,
    )

    await _write_event(conn, assignment_id, user["user_id"], from_status, to_status, body.note)

    assignee_row = None
    if row["assigned_to"]:
        assignee_row = await conn.fetchrow(
            "SELECT email FROM users WHERE id = $1", row["assigned_to"]
        )

    asyncio.create_task(
        n8n_service.trigger_assignment_notification(
            assignment_id=assignment_id,
            to_status=to_status,
            assignee_email=assignee_row["email"] if assignee_row else None,
        )
    )

    return {"assignment_id": assignment_id, "from": from_status, "to": to_status}


@router.get("/{assignment_id}")
async def get_assignment(
    assignment_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Enriched assignment detail: control info, assignee, reviewer, events, artifacts."""
    try:
        aid = uuid.UUID(assignment_id)
    except ValueError:
        raise HTTPException(422, "Invalid assignment ID")

    row = await conn.fetchrow(
        """
        SELECT
          a.*,
          p.org_id,
          u.email   AS assignee_email,
          u.full_name AS assignee_name,
          r.email   AS reviewer_email,
          r.full_name AS reviewer_name,
          b.full_name AS assigner_name,
          cd.nist_id, cd.cmmc_id, cd.requirement_text,
          cd.family, cd.family_abbrev, cd.far_above_phase
        FROM assignments a
        JOIN programs p ON a.program_id = p.id
        LEFT JOIN users u ON a.assigned_to = u.id
        LEFT JOIN users r ON a.reviewer_id = r.id
        LEFT JOIN users b ON a.assigned_by = b.id
        JOIN program_controls pc ON a.program_control_id = pc.id
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE a.id = $1
        """,
        aid,
    )
    if not row:
        raise HTTPException(404, "Assignment not found")

    if user["role"] not in ("msp_admin", "super_admin"):
        if str(row["org_id"]) != user.get("org_id"):
            raise HTTPException(403, "Access denied")

    events = await conn.fetch(
        """
        SELECT ae.id, ae.old_status, ae.new_status, ae.note, ae.created_at,
               u.full_name AS actor_name, u.email AS actor_email
        FROM assignment_events ae
        LEFT JOIN users u ON ae.actor_id = u.id
        WHERE ae.assignment_id = $1
        ORDER BY ae.created_at ASC
        """,
        aid,
    )

    artifacts = await conn.fetch(
        """
        SELECT ar.id, ar.file_name, ar.assessment_status, ar.created_at,
               u.full_name AS uploaded_by_name
        FROM artifacts ar
        LEFT JOIN users u ON ar.uploaded_by = u.id
        WHERE ar.program_control_id = $1
        ORDER BY ar.created_at DESC
        """,
        row["program_control_id"],
    )

    return {
        "id": str(row["id"]),
        "status": row["status"],
        "program_control_id": str(row["program_control_id"]),
        "program_id": str(row["program_id"]),
        "control": {
            "nist_id": row["nist_id"],
            "cmmc_id": row["cmmc_id"],
            "requirement_text": row["requirement_text"],
            "family": row["family"],
            "family_abbrev": row["family_abbrev"],
            "phase": row["far_above_phase"],
        },
        "assignee": {
            "id": str(row["assigned_to"]) if row["assigned_to"] else None,
            "email": row["assignee_email"],
            "name": row["assignee_name"],
        },
        "assigner_name": row["assigner_name"],
        "reviewer": {
            "id": str(row["reviewer_id"]) if row["reviewer_id"] else None,
            "email": row["reviewer_email"],
            "name": row["reviewer_name"],
            "review_note": row["review_note"],
            "reviewed_at": row["reviewed_at"].isoformat() if row.get("reviewed_at") else None,
        } if row["reviewer_id"] else None,
        "due_date": row["due_date"].isoformat() if row.get("due_date") else None,
        "instructions": row["instructions"],
        "submitted_at": row["submitted_at"].isoformat() if row.get("submitted_at") else None,
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
        "valid_next_statuses": sorted(_VALID_TRANSITIONS.get(row["status"], set())),
        "events": [
            {
                "id": str(e["id"]),
                "old_status": e["old_status"],
                "new_status": e["new_status"],
                "note": e["note"],
                "actor_name": e["actor_name"],
                "actor_email": e["actor_email"],
                "created_at": e["created_at"].isoformat(),
            }
            for e in events
        ],
        "artifacts": [
            {
                "id": str(a["id"]),
                "file_name": a["file_name"],
                "assessment_status": a["assessment_status"],
                "uploaded_by": a["uploaded_by_name"],
                "created_at": a["created_at"].isoformat(),
            }
            for a in artifacts
        ],
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

async def _write_event(
    conn: asyncpg.Connection,
    assignment_id: str,
    actor_id: str,
    old_status: str | None,
    new_status: str,
    note: str | None = None,
) -> None:
    await conn.execute(
        """
        INSERT INTO assignment_events (assignment_id, actor_id, old_status, new_status, note)
        VALUES ($1, $2, $3, $4, $5)
        """,
        uuid.UUID(assignment_id),
        uuid.UUID(actor_id),
        old_status,
        new_status,
        note,
    )
