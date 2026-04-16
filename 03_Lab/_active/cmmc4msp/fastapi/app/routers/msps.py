"""MSPs router — Onnex-only CRUD for MSP entities and their admin users."""
from __future__ import annotations

import re
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.deps import require_super_admin, require_msp_admin

router = APIRouter()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class MspCreate(BaseModel):
    name: str
    slug: str | None = None


class MspUpdate(BaseModel):
    name: str | None = None
    status: str | None = None


class MspAdminInvite(BaseModel):
    email: str
    full_name: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")


def _row_to_msp(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "slug": row["slug"],
        "status": row["status"],
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/", summary="List all MSPs (super_admin only)")
async def list_msps(
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_super_admin),
) -> list[dict]:
    rows = await conn.fetch("SELECT * FROM msps ORDER BY name")
    return [_row_to_msp(r) for r in rows]


@router.get("/{msp_id}", summary="Get a single MSP")
async def get_msp(
    msp_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    try:
        uid = uuid.UUID(msp_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid msp_id")

    if user["role"] == "msp_admin" and user.get("msp_id") != str(uid):
        raise HTTPException(status_code=403, detail="Access denied")

    row = await conn.fetchrow("SELECT * FROM msps WHERE id = $1", uid)
    if not row:
        raise HTTPException(status_code=404, detail="MSP not found")
    return _row_to_msp(row)


@router.post("/", status_code=201, summary="Create a new MSP (super_admin only)")
async def create_msp(
    body: MspCreate,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_super_admin),
) -> dict:
    slug = body.slug or _slugify(body.name)

    existing = await conn.fetchval("SELECT id FROM msps WHERE slug = $1", slug)
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    row = await conn.fetchrow(
        """
        INSERT INTO msps (id, name, slug, status)
        VALUES ($1, $2, $3, 'active')
        RETURNING *
        """,
        uuid.uuid4(),
        body.name,
        slug,
    )
    return _row_to_msp(row)


@router.patch("/{msp_id}", summary="Update an MSP (super_admin only)")
async def update_msp(
    msp_id: str,
    body: MspUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_super_admin),
) -> dict:
    try:
        uid = uuid.UUID(msp_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid msp_id")

    updates = {k: v for k, v in body.model_dump(exclude_none=True).items()}
    if not updates:
        row = await conn.fetchrow("SELECT * FROM msps WHERE id = $1", uid)
        if not row:
            raise HTTPException(status_code=404, detail="MSP not found")
        return _row_to_msp(row)

    set_clauses = ", ".join(
        f"{col} = ${i + 2}" for i, col in enumerate(updates.keys())
    )
    row = await conn.fetchrow(
        f"UPDATE msps SET {set_clauses}, updated_at = NOW() WHERE id = $1 RETURNING *",
        uid,
        *updates.values(),
    )
    if not row:
        raise HTTPException(status_code=404, detail="MSP not found")
    return _row_to_msp(row)


@router.post("/{msp_id}/admins", status_code=201, summary="Invite an MSP admin user (super_admin only)")
async def invite_msp_admin(
    msp_id: str,
    body: MspAdminInvite,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_super_admin),
) -> dict:
    """
    Creates a DB user record with role=msp_admin linked to the given MSP.
    Password / invite flow is handled by Authentik — this only creates the DB record.
    """
    try:
        msp_uid = uuid.UUID(msp_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid msp_id")

    msp = await conn.fetchrow("SELECT id FROM msps WHERE id = $1", msp_uid)
    if not msp:
        raise HTTPException(status_code=404, detail="MSP not found")

    existing = await conn.fetchval(
        "SELECT id FROM users WHERE email = $1", body.email
    )
    if existing:
        raise HTTPException(status_code=409, detail="User with this email already exists")

    row = await conn.fetchrow(
        """
        INSERT INTO users (id, email, full_name, role, msp_id, org_id, is_msp_staff, is_active)
        VALUES ($1, $2, $3, 'msp_admin', $4, NULL, TRUE, TRUE)
        RETURNING id, email, full_name, role, msp_id
        """,
        uuid.uuid4(),
        body.email,
        body.full_name,
        msp_uid,
    )
    return {
        "id": str(row["id"]),
        "email": row["email"],
        "full_name": row["full_name"],
        "role": row["role"],
        "msp_id": str(row["msp_id"]),
    }
