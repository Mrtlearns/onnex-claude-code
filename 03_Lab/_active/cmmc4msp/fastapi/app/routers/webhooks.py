"""Webhooks router — n8n callback endpoints (no JWT auth, shared secret only)."""
from __future__ import annotations

import json
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request

from app.config import settings
from app.database import get_db
from app.models import WebhookAssessmentComplete, WebhookOnboardComplete
from app.services import sprs_service

router = APIRouter()

# Verdict → program_control status mapping
_VERDICT_TO_STATUS = {
    "pass": "fully_implemented",
    "met": "fully_implemented",
    "partial": "implementation_begun",
    "fail": "not_yet_addressed",
    "not_met": "not_yet_addressed",
    "not_applicable": "not_applicable",
}


def _validate_secret(secret: Optional[str]) -> None:
    if secret != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


@router.post("/n8n/assessment-complete")
async def assessment_complete(
    body: WebhookAssessmentComplete,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Called by n8n after Claude LLM assessment completes.
    Updates artifact status, inserts assessment record, updates control status,
    triggers SPRS recalculation, and writes an activity log entry.
    """
    provided_secret = x_webhook_secret or body.secret
    if provided_secret != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    artifact_id = body.artifact_id
    program_control_id = body.program_control_id

    # 1. Update artifact assessment status (n8n Postgres node may already have done this)
    artifact = await conn.fetchrow(
        """
        UPDATE artifacts
        SET assessment_status = 'assessed',
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        """,
        artifact_id,
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    # 2. Insert assessment record only if not already inserted by n8n Postgres node
    existing = await conn.fetchrow(
        "SELECT id FROM assessments WHERE artifact_id = $1 ORDER BY created_at DESC LIMIT 1",
        artifact_id,
    )
    if existing:
        assessment_id = existing["id"]
    else:
        assessment_id = uuid.uuid4()
        await conn.execute(
            """
            INSERT INTO assessments (
                id, artifact_id, verdict, confidence, rationale, gaps,
                model_used, reviewer_override
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
            """,
            assessment_id,
            artifact_id,
            body.verdict,
            body.confidence,
            body.rationale or "",
            body.gaps,
            body.model_used or "openrouter/auto",
        )

    # 3. Update program_control status based on verdict
    new_status = _VERDICT_TO_STATUS.get(body.verdict)
    if new_status:
        await conn.execute(
            """
            UPDATE program_controls
            SET status = $1, updated_at = NOW()
            WHERE id = $2
            """,
            new_status,
            program_control_id,
        )

    # 4. Resolve program_id and recalculate SPRS
    pc_row = await conn.fetchrow(
        "SELECT program_id FROM program_controls WHERE id = $1",
        program_control_id,
    )
    if pc_row:
        await sprs_service.calculate_and_save_sprs(str(pc_row["program_id"]), conn)

    # 5. Log to activity_log
    await conn.execute(
        """
        INSERT INTO activity_log (id, entity_type, entity_id, event_type, metadata)
        VALUES ($1, 'artifact', $2, 'assessment_complete', $3)
        """,
        uuid.uuid4(),
        artifact_id,
        json.dumps({
            "assessment_id": str(assessment_id),
            "verdict": body.verdict,
            "confidence": body.confidence,
            "model_used": body.model_used,
        }),
    )

    return {"ok": True, "assessment_id": str(assessment_id)}


@router.post("/n8n/onboard-complete")
async def onboard_complete(
    body: WebhookOnboardComplete,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """
    Called by n8n after control seeding for a new org/program is complete.
    Marks program as in_progress and logs the activity.
    """
    _validate_secret(x_webhook_secret)

    result = await conn.execute(
        """
        UPDATE programs
        SET status = 'in_progress', updated_at = NOW()
        WHERE id = $1
        """,
        body.program_id,
    )

    await conn.execute(
        """
        INSERT INTO activity_log (id, entity_type, entity_id, event_type, metadata)
        VALUES ($1, 'program', $2, 'onboard_complete', $3)
        """,
        uuid.uuid4(),
        body.program_id,
        json.dumps({
            "org_id": str(body.org_id),
            "controls_seeded": body.controls_seeded,
        }),
    )

    return {"ok": True, "program_id": str(body.program_id), "controls_seeded": body.controls_seeded}
