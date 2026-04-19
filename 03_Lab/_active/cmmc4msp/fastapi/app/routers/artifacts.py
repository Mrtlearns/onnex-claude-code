"""Artifacts router — presigned upload, status, and text extraction."""
from __future__ import annotations

import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, File, Header, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.services import embeddings_service, n8n_service
from app.services.extraction_service import chunk_text, extract_text
from app.services.minio_service import (
    download_bytes,
    get_presigned_download_url,
    upload_bytes,
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        pc_uid = uuid.UUID(program_control_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_control_id")

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

    file_name = file.filename or "artifact"
    mime_type = file.content_type or "application/octet-stream"
    artifact_id = uuid.uuid4()
    minio_key = f"{pc['program_id']}/{pc_uid}/{artifact_id}/{file_name}"

    MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
    if file.size and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")
    file_bytes = await file.read()
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 50 MB)")

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
    upload_bytes(minio_client, ARTIFACTS_BUCKET, minio_key, file_bytes, mime_type)

    download_presigned = get_presigned_download_url(minio_client, ARTIFACTS_BUCKET, minio_key)
    background_tasks.add_task(
        n8n_service.trigger_assessment,
        str(artifact_id), str(pc_uid), download_presigned,
    )
    background_tasks.add_task(
        _chunk_and_embed,
        request.app.state.pool, artifact_id, minio_client, minio_key, file_name, mime_type,
    )

    return {
        "artifact_id": str(artifact_id),
        "minio_key": minio_key,
    }


@router.post("/bulk-upload-zip", status_code=201)
async def bulk_upload_zip(
    program_id: str,
    file: UploadFile = File(...),
    request: Request = None,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Accept a ZIP from the harvester script with manifest.json mapping files to NIST IDs."""
    import io
    import json
    import zipfile

    from app.services.minio_service import ensure_bucket, upload_bytes

    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    program = await conn.fetchrow("SELECT id, org_id FROM programs WHERE id = $1", prog_uid)
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(program["org_id"]) != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    data = await file.read()
    try:
        with zipfile.ZipFile(io.BytesIO(data)) as zf:
            names = zf.namelist()
            if "manifest.json" not in names:
                raise HTTPException(status_code=400, detail="ZIP missing manifest.json")
            manifest = json.loads(zf.read("manifest.json"))
            files_map = manifest.get("files", [])  # [{filename, nist_ids: []}]

            minio_client = request.app.state.minio
            ensure_bucket(minio_client, ARTIFACTS_BUCKET)

            artifacts_created = 0
            for entry in files_map:
                fname = entry.get("filename")
                nist_ids = entry.get("nist_ids", [])
                if not fname or not nist_ids or fname not in names:
                    continue
                content = zf.read(fname)
                # Find program_controls matching the NIST IDs
                pc_rows = await conn.fetch(
                    """
                    SELECT pc.id FROM program_controls pc
                    JOIN control_definitions cd ON pc.control_definition_id = cd.id
                    WHERE pc.program_id = $1 AND cd.nist_id = ANY($2)
                    """,
                    prog_uid, nist_ids,
                )
                for pc_row in pc_rows:
                    art_id = uuid.uuid4()
                    minio_key = f"harvester/{art_id}_{fname.replace('/', '_')}"
                    upload_bytes(minio_client, ARTIFACTS_BUCKET, minio_key, content, "application/octet-stream")
                    await conn.execute(
                        """
                        INSERT INTO artifacts (id, program_control_id, file_name, mime_type,
                                              minio_key, assessment_status, source_type)
                        VALUES ($1, $2, $3, 'application/octet-stream', $4, 'pending', 'harvester')
                        """,
                        art_id, pc_row["id"], fname, minio_key,
                    )
                    artifacts_created += 1
            return {"artifacts_created": artifacts_created}
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid ZIP file")


async def _chunk_and_embed(pool, artifact_id: uuid.UUID, minio_client, minio_key: str, file_name: str, mime_type: str) -> None:
    """Background task: extract text, chunk, embed, store in artifact_chunks."""
    import logging as _log
    _logger = _log.getLogger(__name__)
    try:
        file_bytes = download_bytes(minio_client, ARTIFACTS_BUCKET, minio_key)
        extraction = extract_text(file_bytes, mime_type, file_name)
        text = extraction.get("extracted_text", "")
        if not text:
            return

        chunks = chunk_text(text)
        if not chunks:
            return

        texts = [c["chunk_text"] for c in chunks]
        vectors = await embeddings_service.embed_batch(texts)

        def _fmt_vec(v: list) -> str:
            return "[" + ",".join(str(x) for x in v) + "]"

        async with pool.acquire() as conn:
            for c, vec in zip(chunks, vectors):
                await conn.execute(
                    """
                    INSERT INTO artifact_chunks (artifact_id, chunk_index, chunk_text, page_number, embedding)
                    VALUES ($1, $2, $3, $4, $5::vector)
                    ON CONFLICT (artifact_id, chunk_index) DO UPDATE
                      SET embedding = EXCLUDED.embedding, chunk_text = EXCLUDED.chunk_text
                    """,
                    artifact_id, c["chunk_index"], c["chunk_text"], c["page_number"], _fmt_vec(vec),
                )
        _logger.info("Chunked and embedded artifact %s — %d chunks", artifact_id, len(chunks))
    except Exception as exc:
        _logger.warning("Background chunk/embed failed for artifact %s: %s", artifact_id, exc)


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


# ---------------------------------------------------------------------------
# A3 — Evidence Drift Detection: dismiss drift
# ---------------------------------------------------------------------------


class DismissDriftRequest(BaseModel):
    note: str


@router.post("/{artifact_id}/dismiss-drift")
async def dismiss_drift(
    artifact_id: str,
    body: DismissDriftRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Mark a drifted artifact as reviewed and dismissed by the current user."""
    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid UUID")

    artifact = await conn.fetchrow(
        """
        SELECT ar.id, p.org_id
        FROM artifacts ar
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ar.id = $1
        """,
        art_uid,
    )
    if not artifact:
        raise HTTPException(status_code=404, detail="Artifact not found")

    if user["role"] not in ("msp_admin", "super_admin") and str(artifact["org_id"]) != user.get("org_id"):
        raise HTTPException(status_code=403, detail="Access denied")

    await conn.execute(
        """
        UPDATE artifacts SET
            drift_status        = 'dismissed',
            drift_dismissed_by  = $1,
            drift_dismissed_at  = NOW(),
            drift_dismiss_note  = $2
        WHERE id = $3
        """,
        uuid.UUID(user["user_id"]),
        body.note,
        art_uid,
    )
    return {"status": "dismissed", "artifact_id": artifact_id}


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
