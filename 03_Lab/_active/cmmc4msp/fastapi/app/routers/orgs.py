"""Organizations router."""
from __future__ import annotations

import os
import re
import uuid
from typing import Any, List, Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user, require_msp_admin, require_same_org, require_msp_owns_org
from app.models import OrgCreate, OrgResponse, OrgUpdate
from app.services import n8n_service

router = APIRouter()


class OnboardRequest(BaseModel):
    """Frontend-facing onboard payload — wraps org + program creation."""
    org_name: str
    cage_code: Optional[str] = None
    primary_contact_name: Optional[str] = None
    primary_contact_email: Optional[str] = None
    primary_contact_phone: Optional[str] = None
    system_name: str
    system_description: Optional[str] = None
    cui_types: Optional[str] = None
    user_count: Optional[int] = None
    na_control_ids: List[str] = []
    msp_id: Optional[uuid.UUID] = None


def _slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9-]+", "-", name.lower()).strip("-")


def _row_to_org(row: asyncpg.Record) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "slug": row["slug"],
        "status": row.get("status"),
        "cage_code": row.get("cage_code"),
        "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
    }


@router.get("/")
async def list_orgs(
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> list[dict]:
    if user["role"] == "super_admin":
        rows = await conn.fetch("SELECT * FROM orgs ORDER BY name")
    elif user["role"] == "msp_admin":
        msp_uid = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
        if not msp_uid:
            return []
        rows = await conn.fetch(
            "SELECT * FROM orgs WHERE msp_id = $1 ORDER BY name",
            msp_uid,
        )
    else:
        rows = await conn.fetch(
            "SELECT * FROM orgs WHERE id = $1",
            uuid.UUID(user["org_id"]) if user["org_id"] else uuid.uuid4(),
        )
    return [_row_to_org(r) for r in rows]


@router.get("/{org_id}")
async def get_org(
    org_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    # Support lookup by UUID or slug
    try:
        uid = uuid.UUID(org_id)
        row = await conn.fetchrow("SELECT * FROM orgs WHERE id = $1", uid)
    except ValueError:
        row = await conn.fetchrow("SELECT * FROM orgs WHERE slug = $1", org_id)

    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")

    if user["role"] == "msp_admin":
        require_msp_owns_org(row.get("msp_id"), user)
    else:
        require_same_org(str(row["id"]), user)
    return _row_to_org(row)


@router.post("/onboard", status_code=201)
async def onboard_org(
    body: OnboardRequest,
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Single-call client onboard: creates org + program + seeds 110 controls.
    Protected by X-Api-Key matching INTERNAL_API_KEY env var (or unprotected
    when INTERNAL_API_KEY is unset, for local dev).
    """
    api_key_required = os.getenv("INTERNAL_API_KEY", "")
    if api_key_required:
        sent_key = request.headers.get("X-Api-Key", "")
        if sent_key != api_key_required:
            raise HTTPException(status_code=401, detail="Invalid API key")

    slug = _slugify(body.org_name)
    existing = await conn.fetchval("SELECT id FROM orgs WHERE slug = $1", slug)
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    org_id = uuid.uuid4()
    program_id = uuid.uuid4()

    async with conn.transaction():
        org_row = await conn.fetchrow(
            """
            INSERT INTO orgs (
                id, name, slug, cage_code,
                primary_contact_name, primary_contact_email,
                primary_contact_phone, msp_id, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
            RETURNING *
            """,
            org_id,
            body.org_name,
            slug,
            body.cage_code,
            body.primary_contact_name,
            body.primary_contact_email,
            body.primary_contact_phone,
            body.msp_id,
        )

        # Compose scoping config from NA control IDs + system details
        scoping_config = {
            "system_name": body.system_name,
            "system_description": body.system_description,
            "cui_types": body.cui_types,
            "user_count": body.user_count,
            "na_control_ids": body.na_control_ids,
        }

        await conn.execute(
            """
            INSERT INTO programs (
                id, org_id, name, system_name, status, current_phase
            )
            VALUES ($1, $2, $3, $4, 'scoping', '1')
            """,
            program_id,
            org_id,
            f"{body.org_name} CMMC Program",
            body.system_name,
        )

        # Seed all 110 controls for this program; mark N/A where specified
        await conn.execute(
            """
            INSERT INTO program_controls (
                id, program_id, control_definition_id, status, is_applicable
            )
            SELECT
                uuid_generate_v4(),
                $1,
                cd.id,
                'not_yet_assessed',
                NOT (cd.nist_id = ANY($2::text[]))
            FROM control_definitions cd
            WHERE cd.parent_control_id IS NULL AND cd.is_objective = false
            """,
            program_id,
            body.na_control_ids,
        )

    # Trigger n8n onboard workflow (fire-and-forget)
    background_tasks.add_task(
        n8n_service.trigger_onboard, str(org_id), str(program_id), scoping_config
    )

    return {"org_id": str(org_id), "org_slug": slug, "program_id": str(program_id)}


@router.post("/", status_code=201)
async def create_org(
    body: OrgCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    slug = body.slug or _slugify(body.name)

    # Ensure slug uniqueness
    existing = await conn.fetchval("SELECT id FROM orgs WHERE slug = $1", slug)
    if existing:
        slug = f"{slug}-{str(uuid.uuid4())[:8]}"

    # Determine msp_id: super_admin can specify explicitly; msp_admin uses their own
    if user["role"] == "super_admin":
        msp_id_to_use = body.msp_id
    else:
        msp_id_to_use = uuid.UUID(user["msp_id"]) if user.get("msp_id") else None

    org_id = uuid.uuid4()
    row = await conn.fetchrow(
        """
        INSERT INTO orgs (
            id, name, slug, cage_code,
            primary_contact_name, primary_contact_email,
            primary_contact_phone, primary_contact_title,
            msp_id, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'active')
        RETURNING *
        """,
        org_id,
        body.name,
        slug,
        body.cage_code,
        body.primary_contact_name,
        body.primary_contact_email,
        body.primary_contact_phone,
        body.primary_contact_title,
        msp_id_to_use,
    )

    # Fire-and-forget — create a placeholder program_id for the onboard trigger
    placeholder_program_id = str(uuid.uuid4())
    background_tasks.add_task(
        n8n_service.trigger_onboard,
        str(org_id),
        placeholder_program_id,
        body.scoping_config or {},
    )

    return _row_to_org(row)


@router.patch("/{org_id}")
async def update_org(
    org_id: str,
    body: OrgUpdate,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    try:
        uid = uuid.UUID(org_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid org_id")

    # Fetch existing row to check ownership before applying updates
    existing = await conn.fetchrow("SELECT * FROM orgs WHERE id = $1", uid)
    if not existing:
        raise HTTPException(status_code=404, detail="Organization not found")

    if user["role"] == "msp_admin":
        require_msp_owns_org(existing.get("msp_id"), user)
    else:
        require_same_org(org_id, user)

    updates: dict[str, Any] = {
        k: v for k, v in body.model_dump(exclude_none=True).items()
    }
    if not updates:
        return _row_to_org(existing)

    set_clauses = ", ".join(
        f"{col} = ${i + 2}" for i, col in enumerate(updates.keys())
    )
    values = list(updates.values())
    row = await conn.fetchrow(
        f"UPDATE orgs SET {set_clauses}, updated_at = NOW() WHERE id = $1 RETURNING *",
        uid,
        *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Organization not found")
    return _row_to_org(row)
