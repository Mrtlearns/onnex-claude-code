"""Audit package export router — P3 C3PAO Audit Package Export."""
from __future__ import annotations

import hashlib
import io
import json
import uuid
import zipfile

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from app.database import get_db
from app.deps import get_current_user, require_msp_admin
from app.logging_config import get_logger
from app.services import error_events_service
from app.services.background import run_with_pool
from app.services.minio_service import download_bytes, get_presigned_download_url, upload_bytes

logger = get_logger(__name__)

router = APIRouter()

EXPORTS_BUCKET = "cmmc-exports"
ARTIFACTS_BUCKET = "cmmc-artifacts"


@router.post("/programs/{program_id}/audit-package", status_code=202)
async def create_audit_package(
    program_id: str,
    background_tasks: BackgroundTasks,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    """Trigger audit package generation (async). Returns package_id."""
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    program = await conn.fetchrow("SELECT id, org_id FROM programs WHERE id = $1", prog_uid)
    if not program:
        raise HTTPException(404, "Program not found")

    if user["role"] == "msp_admin":
        msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
        if msp_uid:
            org_msp = await conn.fetchval("SELECT msp_id FROM orgs WHERE id=$1", program["org_id"])
            if not org_msp or str(org_msp) != str(msp_uid):
                raise HTTPException(403, "Access denied")

    package_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO audit_packages (id, program_id, created_by, status)
        VALUES ($1, $2, $3, 'generating')
        """,
        package_id,
        prog_uid,
        uuid.UUID(user["user_id"]),
    )

    pool = request.app.state.pool
    minio = request.app.state.minio
    correlation_id = getattr(request.state, "correlation_id", None)
    org_id = str(program["org_id"]) if program["org_id"] else None

    async def _build(conn: asyncpg.Connection) -> None:
        await _generate_audit_package(package_id, prog_uid, conn, minio)

    async def _on_audit_error(conn: asyncpg.Connection, exc: Exception) -> None:
        await conn.execute(
            "UPDATE audit_packages SET status = 'error', error_message=$1 WHERE id = $2",
            str(exc)[:2000], package_id,
        )

    background_tasks.add_task(
        run_with_pool, pool, _build,
        component="audit.generate_audit_package",
        correlation_id=correlation_id,
        org_id=org_id,
        on_error=_on_audit_error,
    )
    return {"package_id": str(package_id), "status": "generating"}


@router.get("/programs/{program_id}/audit-package")
async def list_audit_packages(
    program_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """List all audit packages for a program."""
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    program = await conn.fetchrow("SELECT id, org_id FROM programs WHERE id = $1", prog_uid)
    if not program:
        raise HTTPException(404, "Program not found")
    if user["role"] == "super_admin":
        pass
    elif user["role"] == "msp_admin":
        msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
        if msp_uid:
            org_msp = await conn.fetchval("SELECT msp_id FROM orgs WHERE id=$1", program["org_id"])
            if not org_msp or str(org_msp) != str(msp_uid):
                raise HTTPException(403, "Access denied")
    else:
        if str(program["org_id"]) != user.get("org_id"):
            raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT ap.id, ap.status, ap.artifact_count, ap.file_size_bytes, ap.created_at, ap.completed_at,
               u.full_name AS created_by_name
        FROM audit_packages ap
        JOIN users u ON ap.created_by = u.id
        WHERE ap.program_id = $1
        ORDER BY ap.created_at DESC
        """,
        prog_uid,
    )
    return {
        "packages": [
            {
                "id": str(r["id"]),
                "status": r["status"],
                "artifact_count": r["artifact_count"],
                "file_size_bytes": r["file_size_bytes"],
                "created_by": r["created_by_name"],
                "created_at": r["created_at"].isoformat(),
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            }
            for r in rows
        ]
    }


@router.get("/programs/{program_id}/audit-package/{package_id}/download")
async def download_audit_package(
    program_id: str,
    package_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get a presigned download URL for a ready audit package."""
    try:
        pkg_uid = uuid.UUID(package_id)
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    pkg = await conn.fetchrow(
        """
        SELECT ap.*, p.org_id
        FROM audit_packages ap
        JOIN programs p ON ap.program_id = p.id
        WHERE ap.id = $1 AND ap.program_id = $2
        """,
        pkg_uid,
        prog_uid,
    )
    if not pkg:
        raise HTTPException(404, "Package not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(pkg["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")
    if pkg["status"] != "ready":
        raise HTTPException(409, f"Package is not ready (status: {pkg['status']})")

    url = get_presigned_download_url(
        request.app.state.minio_public,
        EXPORTS_BUCKET,
        pkg["minio_key"],
        expires_seconds=3600,
    )
    return {"download_url": url, "expires_in": 3600}


async def _generate_audit_package(
    package_id: uuid.UUID,
    program_id: uuid.UUID,
    conn: asyncpg.Connection,
    minio,
) -> None:
    """Build ZIP: all assessed artifacts + SHA256 manifest. Updates DB on completion."""
    try:
        artifacts = await conn.fetch(
            """
            SELECT ar.id, ar.file_name, ar.minio_key, ar.mime_type
            FROM artifacts ar
            JOIN program_controls pc ON ar.program_control_id = pc.id
            WHERE pc.program_id = $1 AND ar.assessment_status = 'assessed'
            """,
            program_id,
        )

        zip_buf = io.BytesIO()
        manifest: dict[str, str] = {}
        artifact_count = 0

        with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
            for artifact in artifacts:
                try:
                    data = download_bytes(minio, ARTIFACTS_BUCKET, artifact["minio_key"])
                    safe_name = f"evidence/{artifact['file_name']}"
                    zf.writestr(safe_name, data)
                    manifest[safe_name] = hashlib.sha256(data).hexdigest()
                    artifact_count += 1
                except Exception:
                    continue

            manifest_json = json.dumps(manifest, indent=2)
            zf.writestr("SHA256MANIFEST.json", manifest_json)

        zip_bytes = zip_buf.getvalue()
        minio_key = f"{program_id}/{package_id}/audit-package.zip"
        upload_bytes(minio, EXPORTS_BUCKET, minio_key, zip_bytes, content_type="application/zip")

        await conn.execute(
            """
            UPDATE audit_packages SET
                status = 'ready',
                minio_key = $1,
                file_size_bytes = $2,
                sha256_manifest = $3,
                artifact_count = $4,
                completed_at = NOW()
            WHERE id = $5
            """,
            minio_key,
            len(zip_bytes),
            json.dumps(manifest),
            artifact_count,
            package_id,
        )
    except Exception:
        raise
