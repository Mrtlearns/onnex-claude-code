"""Artifacts router — presigned upload, status, and text extraction."""
from __future__ import annotations

import asyncio
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.services import n8n_service
from app.services.extraction_service import extract_text
from app.services.minio_service import (
    download_bytes,
    get_presigned_download_url,
    get_presigned_upload_url,
)

ARTIFACTS_BUCKET = "cmmc-artifacts"

router = APIRouter()


def _row_to_artifact(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "program_control_id": str(row["program_control_id"]),
        "file_name": row.get("file_name"),
        "assessment_status": row.get("assessment_status"),
        "assessment_attempts": row.get("assessment_attempts"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


class ExtractRequest(BaseModel):
    artifact_id: str
    secret: Optional[str] = None


@router.post("/extract")
async def extract_artifact_text_n8n(
    body: ExtractRequest,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """JSON body extract endpoint for n8n (static URL, POST, JSON body + header auth).
    Accepts both X-Webhook-Secret header and body.secret for dual compatibility.
    """
    provided_secret = x_webhook_secret or getattr(body, "secret", None)
    if provided_secret != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        art_uid = uuid.UUID(body.artifact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid artifact_id")

    row = await conn.fetchrow(
        "SELECT * FROM artifacts WHERE id = $1",
        art_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")

    minio_client = request.app.state.minio
    file_bytes = download_bytes(minio_client, ARTIFACTS_BUCKET, row["minio_key"])
    extraction = extract_text(file_bytes, row.get("mime_type") or "", row.get("file_name") or "")

    await conn.execute(
        "UPDATE artifacts SET extracted_text = $1, updated_at = NOW() WHERE id = $2",
        extraction["extracted_text"],
        art_uid,
    )

    return {
        "artifact_id": body.artifact_id,
        "extracted_text": extraction["extracted_text"],
        "page_count": extraction["page_count"],
    }


@router.post("/{program_control_id}/upload", status_code=201)
async def initiate_upload(
    program_control_id: str,
    request: Request,
    file_name: str = "artifact",
    mime_type: str = "application/octet-stream",
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        pc_uid = uuid.UUID(program_control_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_control_id")

    # Resolve program + org for authz
    pc = await conn.fetchrow(
        """
        SELECT pc.*, p.org_id
        FROM program_controls pc
        JOIN programs p ON pc.program_id = p.id
        WHERE pc.id = $1
        """,
        pc_uid,
    )
    if not pc:
        raise HTTPException(status_code=404, detail="Program control not found")

    require_same_org(str(pc["org_id"]), user)

    artifact_id = uuid.uuid4()
    minio_key = f"{pc['program_id']}/{pc_uid}/{artifact_id}/{file_name}"

    # Insert artifact record
    await conn.execute(
        """
        INSERT INTO artifacts (id, program_control_id, file_name, minio_key, mime_type, assessment_status, assessment_attempts)
        VALUES ($1, $2, $3, $4, $5, 'pending', 0)
        """,
        artifact_id,
        pc_uid,
        file_name,
        minio_key,
        mime_type,
    )

    minio_client = request.app.state.minio
    presigned_url = get_presigned_upload_url(minio_client, ARTIFACTS_BUCKET, minio_key)

    # Fire-and-forget assessment trigger
    download_presigned = get_presigned_download_url(minio_client, ARTIFACTS_BUCKET, minio_key)
    asyncio.create_task(
        n8n_service.trigger_assessment(
            str(artifact_id),
            str(pc_uid),
            download_presigned,
        )
    )

    return {
        "presigned_url": presigned_url,
        "artifact_id": str(artifact_id),
        "minio_key": minio_key,
    }


@router.get("/{artifact_id}")
async def get_artifact(
    artifact_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid artifact_id")

    row = await conn.fetchrow(
        """
        SELECT ar.*, p.org_id
        FROM artifacts ar
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ar.id = $1
        """,
        art_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")

    require_same_org(str(row["org_id"]), user)

    result = _row_to_artifact(row)

    # Attach latest assessment
    assessment = await conn.fetchrow(
        "SELECT * FROM assessments WHERE artifact_id = $1 ORDER BY created_at DESC LIMIT 1",
        art_uid,
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


@router.get("/{artifact_id}/status")
async def get_artifact_status(
    artifact_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid artifact_id")

    row = await conn.fetchrow(
        """
        SELECT ar.id, ar.assessment_status, p.org_id
        FROM artifacts ar
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ar.id = $1
        """,
        art_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")

    require_same_org(str(row["org_id"]), user)
    return {"artifact_id": artifact_id, "assessment_status": row["assessment_status"]}


@router.api_route("/{artifact_id}/extract", methods=["GET", "POST"])
async def extract_artifact_text(
    artifact_id: str,
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
    secret: Optional[str] = None,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Called by n8n after upload to extract text from the artifact."""
    provided_secret = x_webhook_secret or secret
    if provided_secret != settings.webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid webhook secret")

    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid artifact_id")

    row = await conn.fetchrow(
        "SELECT * FROM artifacts WHERE id = $1",
        art_uid,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Artifact not found")

    minio_client = request.app.state.minio
    file_bytes = download_bytes(minio_client, ARTIFACTS_BUCKET, row["minio_key"])
    extraction = extract_text(file_bytes, row.get("mime_type") or "", row.get("file_name") or "")

    await conn.execute(
        "UPDATE artifacts SET extracted_text = $1, updated_at = NOW() WHERE id = $2",
        extraction["extracted_text"],
        art_uid,
    )

    return {
        "artifact_id": artifact_id,
        "extracted_text": extraction["extracted_text"],
        "page_count": extraction["page_count"],
    }
