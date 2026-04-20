"""Reports router — SSP, POA&M PDF generation and download listing."""
from __future__ import annotations

import hashlib
import hmac as _hmac
import time
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import StreamingResponse

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.services.report_service import (
    REPORTS_BUCKET, EXPORTS_BUCKET,
    generate_poam_pdf, generate_ssp_pdf,
    generate_sprs_xlsx, generate_audit_package_zip,
)

router = APIRouter()


async def _resolve_user(
    request: Request,
    x_webhook_secret: Optional[str] = Header(None, alias="X-Webhook-Secret"),
) -> dict:
    """Authenticate via webhook secret (n8n internal) or JWT (user-facing)."""
    if x_webhook_secret and x_webhook_secret == settings.webhook_secret:
        return {"role": "msp_admin", "org_id": "", "msp_id": "", "user_id": "00000000-0000-0000-0000-000000000000"}
    # Fall back to JWT
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = auth_header[7:]
    try:
        return await get_current_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


async def _check_program_access(program_id: uuid.UUID, user: dict, conn: asyncpg.Connection):
    prog = await conn.fetchrow("SELECT org_id FROM programs WHERE id = $1", program_id)
    if not prog:
        raise HTTPException(status_code=404, detail="Program not found")
    if user.get("role") not in ("super_admin", "msp_admin"):
        require_same_org(str(prog["org_id"]), user)
    return prog


_ALLOWED_BUCKETS = frozenset({"cmmc-reports", "cmmc-artifacts", "cmmc-exports"})


@router.get("/download")
async def proxy_download(
    request: Request,
    bucket: str = Query(...),
    key: str = Query(...),
    exp: int = Query(...),
    sig: str = Query(...),
) -> StreamingResponse:
    """Proxy-download a MinIO object. URL must be signed by get_proxy_download_url()."""
    if int(time.time()) > exp:
        raise HTTPException(status_code=403, detail="Download link expired")

    payload = f"{bucket}:{key}:{exp}"
    expected = _hmac.new(
        settings.webhook_secret.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    if not _hmac.compare_digest(sig, expected):
        raise HTTPException(status_code=403, detail="Invalid signature")

    if bucket not in _ALLOWED_BUCKETS:
        raise HTTPException(status_code=400, detail="Invalid bucket")

    try:
        minio_client = request.app.state.minio
        obj = minio_client.get_object(bucket, key)
        filename = key.split("/")[-1]
        if filename.endswith(".xlsx"):
            media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif filename.endswith(".zip"):
            media = "application/zip"
        else:
            media = "application/pdf"
        return StreamingResponse(
            obj,
            media_type=media,
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not retrieve file: {exc}")


@router.post("/{program_id}/ssp")
async def generate_ssp(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(_resolve_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    await _check_program_access(prog_uid, user, conn)

    download_url = await generate_ssp_pdf(
        str(prog_uid),
        conn,
        request.app.state.minio,
        request.app.state.minio_public,
    )
    return {"download_url": download_url}


@router.post("/{program_id}/poam")
async def generate_poam(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(_resolve_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    await _check_program_access(prog_uid, user, conn)

    download_url = await generate_poam_pdf(
        str(prog_uid),
        conn,
        request.app.state.minio,
        request.app.state.minio_public,
    )
    return {"download_url": download_url}


@router.get("/{program_id}/downloads")
async def list_downloads(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")

    await _check_program_access(prog_uid, user, conn)

    minio_client = request.app.state.minio
    prefix = f"{program_id}/"
    objects = []

    try:
        for obj in minio_client.list_objects(REPORTS_BUCKET, prefix=prefix, recursive=True):
            objects.append({
                "key": obj.object_name,
                "file_name": obj.object_name.split("/")[-1],
                "size_bytes": obj.size,
                "last_modified": obj.last_modified.isoformat() if obj.last_modified else None,
                "type": "ssp" if "ssp_" in obj.object_name else "poam" if "poam_" in obj.object_name else "other",
            })
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Could not list reports: {exc}")

    return sorted(objects, key=lambda x: x.get("last_modified") or "", reverse=True)


@router.post("/{program_id}/sprs-sheet")
async def generate_sprs_sheet(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(_resolve_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")
    await _check_program_access(prog_uid, user, conn)
    download_url = await generate_sprs_xlsx(
        str(prog_uid), conn, request.app.state.minio, request.app.state.minio_public,
    )
    return {"download_url": download_url}


@router.post("/{program_id}/audit-package")
async def generate_audit_package(
    program_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(_resolve_user),
) -> dict:
    try:
        prog_uid = uuid.UUID(program_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid program_id")
    await _check_program_access(prog_uid, user, conn)
    download_url = await generate_audit_package_zip(
        str(prog_uid), conn, request.app.state.minio, request.app.state.minio_public,
    )
    return {"download_url": download_url}
