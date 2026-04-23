"""Library — global document library with folder/file tree and PDF storage."""
from __future__ import annotations

import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.services.minio_service import ensure_bucket, get_presigned_download_url, upload_bytes

router = APIRouter()

LIBRARY_BUCKET = "cmmc-library"
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
ALLOWED_MIME = {"application/pdf"}


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _resolve_user(conn: asyncpg.Connection, user: dict) -> Optional[uuid.UUID]:
    email = (user.get("email") or "").strip().lower()
    raw_sub = user.get("user_id") or ""
    if email:
        row = await conn.fetchrow("SELECT id FROM users WHERE lower(email) = $1", email)
        if row:
            return row["id"]
    try:
        sub_uid = uuid.UUID(raw_sub)
        row = await conn.fetchrow("SELECT id FROM users WHERE id = $1", sub_uid)
        if row:
            return row["id"]
    except (ValueError, TypeError):
        pass
    return None


def _require_admin(user: dict) -> None:
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(403, "MSP admin or above required")


# ─── Tree ─────────────────────────────────────────────────────────────────────

@router.get("/tree")
async def get_tree(
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Return flat lists of all folders and files — client builds the tree."""
    folders = await conn.fetch(
        "SELECT id, name, parent_id, created_at FROM library_folders ORDER BY name"
    )
    files = await conn.fetch(
        """
        SELECT lf.id, lf.name, lf.folder_id, lf.size_bytes, lf.created_at,
               u.email AS uploaded_by_email
        FROM library_files lf
        LEFT JOIN users u ON lf.uploaded_by = u.id
        ORDER BY lf.name
        """
    )
    return {
        "folders": [dict(f) for f in folders],
        "files": [dict(f) for f in files],
    }


# ─── Folder CRUD ──────────────────────────────────────────────────────────────

class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[str] = None


@router.post("/folders")
async def create_folder(
    body: FolderCreate,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    parent_uid: Optional[uuid.UUID] = None
    if body.parent_id:
        try:
            parent_uid = uuid.UUID(body.parent_id)
        except ValueError:
            raise HTTPException(422, "Invalid parent_id")
        if not await conn.fetchval("SELECT id FROM library_folders WHERE id = $1", parent_uid):
            raise HTTPException(404, "Parent folder not found")

    user_uid = await _resolve_user(conn, user)
    row = await conn.fetchrow(
        "INSERT INTO library_folders (name, parent_id, created_by) VALUES ($1, $2, $3) "
        "RETURNING id, name, parent_id",
        body.name.strip(), parent_uid, user_uid,
    )
    return dict(row)


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    try:
        fid = uuid.UUID(folder_id)
    except ValueError:
        raise HTTPException(422, "Invalid folder_id")
    if not await conn.fetchval("DELETE FROM library_folders WHERE id = $1 RETURNING id", fid):
        raise HTTPException(404, "Folder not found")
    return {"deleted": True}


# ─── File upload ─────────────────────────────────────────────────────────────

@router.post("/upload")
async def upload_files(
    request: Request,
    folder_id: Optional[str] = Form(None),
    files: list[UploadFile] = File(...),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require_admin(user)

    folder_uid: Optional[uuid.UUID] = None
    if folder_id and folder_id not in ("null", "undefined", ""):
        try:
            folder_uid = uuid.UUID(folder_id)
        except ValueError:
            raise HTTPException(422, "Invalid folder_id")
        if not await conn.fetchval("SELECT id FROM library_folders WHERE id = $1", folder_uid):
            raise HTTPException(404, "Folder not found")

    minio = request.app.state.minio
    ensure_bucket(minio, LIBRARY_BUCKET)
    user_uid = await _resolve_user(conn, user)
    results = []

    for upload in files:
        if upload.content_type not in ALLOWED_MIME:
            raise HTTPException(422, f"'{upload.filename}' is not a PDF — only PDF files are supported")
        data = await upload.read()
        if len(data) > MAX_FILE_SIZE:
            raise HTTPException(413, f"'{upload.filename}' exceeds 50 MB limit")

        file_id = uuid.uuid4()
        folder_path = str(folder_uid) if folder_uid else "root"
        minio_key = f"library/{folder_path}/{file_id}/{upload.filename}"
        upload_bytes(minio, LIBRARY_BUCKET, minio_key, data, "application/pdf")

        row = await conn.fetchrow(
            """
            INSERT INTO library_files (id, folder_id, name, minio_key, size_bytes, mime_type, uploaded_by)
            VALUES ($1, $2, $3, $4, $5, 'application/pdf', $6)
            RETURNING id, folder_id, name, size_bytes, created_at
            """,
            file_id, folder_uid, upload.filename, minio_key, len(data), user_uid,
        )
        results.append(dict(row))

    return {"uploaded": results}


# ─── File view + delete ───────────────────────────────────────────────────────

@router.get("/files/{file_id}/view")
async def get_view_url(
    file_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(422, "Invalid file_id")
    row = await conn.fetchrow("SELECT minio_key, name FROM library_files WHERE id = $1", fid)
    if not row:
        raise HTTPException(404, "File not found")
    url = get_presigned_download_url(
        request.app.state.minio_public, LIBRARY_BUCKET, row["minio_key"], 3600
    )
    return {"url": url, "name": row["name"]}


@router.delete("/files/{file_id}")
async def delete_file(
    file_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    _require_admin(user)
    try:
        fid = uuid.UUID(file_id)
    except ValueError:
        raise HTTPException(422, "Invalid file_id")
    row = await conn.fetchrow("SELECT minio_key FROM library_files WHERE id = $1", fid)
    if not row:
        raise HTTPException(404, "File not found")
    try:
        request.app.state.minio.remove_object(LIBRARY_BUCKET, row["minio_key"])
    except Exception:
        pass
    await conn.execute("DELETE FROM library_files WHERE id = $1", fid)
    return {"deleted": True}
