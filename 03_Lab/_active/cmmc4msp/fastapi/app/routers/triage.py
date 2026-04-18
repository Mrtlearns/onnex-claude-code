"""Triage router — AI Error Triage Collector endpoints."""
from __future__ import annotations

import os
import uuid

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Query, Request
from fastapi.security import OAuth2PasswordBearer

from app.database import get_db
from app.deps import get_current_user, require_msp_admin
from app.logging_config import get_logger
from app.services import error_triage_service

logger = get_logger(__name__)
router = APIRouter()

# OAuth2 scheme with auto_error=False so that missing token yields None instead
# of raising 401 immediately — allows our webhook-secret bypass to work.
_optional_bearer = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)


# ---------------------------------------------------------------------------
# Auth helper — webhook-secret bypass for n8n (WF15)
# ---------------------------------------------------------------------------

async def _resolve_run_auth(
    x_webhook_secret: str | None = Header(default=None),
    raw_token: str | None = Depends(_optional_bearer),
) -> dict:
    """Returns a user dict if auth succeeds, else raises 401/403.

    Priority:
      1. Matching X-Webhook-Secret -> synthetic super_admin system user.
      2. Valid JWT with msp_admin or super_admin role -> that user.
      3. Otherwise -> 401 or 403.
    """
    from app.deps import _peek_alg, _decode_rs256, JWT_SECRET, ALGORITHM
    from jose import JWTError, jwt as _jwt

    webhook_secret = os.getenv("WEBHOOK_SECRET", "")
    if webhook_secret and x_webhook_secret == webhook_secret:
        return {"user_id": str(uuid.UUID(int=0)), "org_id": "", "role": "super_admin", "msp_id": ""}

    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        alg = _peek_alg(raw_token)
        if alg == "RS256":
            payload = _decode_rs256(raw_token)
        else:
            payload = _jwt.decode(raw_token, JWT_SECRET, algorithms=[ALGORITHM])
    except (JWTError, HTTPException):
        raise HTTPException(status_code=401, detail="Invalid token")

    role = payload.get("role", "client_user")
    if role not in ("msp_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="MSP admin or above required")

    return {
        "user_id": payload.get("sub", ""),
        "org_id": payload.get("org_id", ""),
        "role": role,
        "msp_id": payload.get("msp_id", ""),
    }


@router.post("/run", status_code=202)
async def run_triage(
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(_resolve_run_auth),
) -> dict:
    """Kick off AI triage over untriaged error_events. Returns report_id to poll.

    Auth (first match wins):
      1. X-Webhook-Secret header matches WEBHOOK_SECRET env var -> system call, accepted.
      2. Valid JWT with role msp_admin or super_admin -> normal user call, accepted.
      3. Anything else -> 401 / 403.
    """
    is_webhook = user["user_id"] == str(uuid.UUID(int=0))

    # Webhook system calls use None as requested_by and no msp_id scoping
    user_id: uuid.UUID | None = None if is_webhook else uuid.UUID(user["user_id"])
    msp_id: uuid.UUID | None = (
        uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
    )

    report_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO triage_reports (id, requested_by, msp_id, status)
        VALUES ($1, $2, $3, 'pending')
        """,
        report_id,
        user_id,
        msp_id,
    )

    pool = request.app.state.pool
    background_tasks.add_task(
        error_triage_service.run_triage,
        report_id=report_id,
        requested_by=user_id,
        msp_id=msp_id,
        pool=pool,
    )
    return {"report_id": str(report_id), "status": "pending"}


@router.get("/latest")
async def get_latest_triage(
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    """Returns the most recent triage_report for the caller's MSP.

    super_admin with no msp_id returns the globally latest report.
    """
    msp_id: uuid.UUID | None = (
        uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
    )

    if msp_id:
        row = await conn.fetchrow(
            """
            SELECT id, status, event_count, report, error_message, created_at, completed_at
            FROM triage_reports
            WHERE msp_id = $1
            ORDER BY created_at DESC
            LIMIT 1
            """,
            msp_id,
        )
    else:
        row = await conn.fetchrow(
            """
            SELECT id, status, event_count, report, error_message, created_at, completed_at
            FROM triage_reports
            ORDER BY created_at DESC
            LIMIT 1
            """,
        )

    if not row:
        return {"report": None}
    return _serialize_report(row)


@router.get("/reports")
async def list_triage_reports(
    request: Request,
    limit: int = Query(default=10, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> list[dict]:
    """Paginated list of triage_reports for the caller's MSP."""
    msp_id: uuid.UUID | None = (
        uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
    )

    if msp_id:
        rows = await conn.fetch(
            """
            SELECT id, status, event_count, error_message, created_at, completed_at
            FROM triage_reports
            WHERE msp_id = $1
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            """,
            msp_id, limit, offset,
        )
    else:
        rows = await conn.fetch(
            """
            SELECT id, status, event_count, error_message, created_at, completed_at
            FROM triage_reports
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            """,
            limit, offset,
        )
    return [_serialize_report(r) for r in rows]


@router.get("/{report_id}")
async def get_triage_report(
    report_id: uuid.UUID,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    """Get a specific triage report by ID."""
    msp_id: uuid.UUID | None = (
        uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
    )

    if msp_id:
        row = await conn.fetchrow(
            "SELECT * FROM triage_reports WHERE id=$1 AND msp_id=$2",
            report_id, msp_id,
        )
    else:
        row = await conn.fetchrow(
            "SELECT * FROM triage_reports WHERE id=$1",
            report_id,
        )

    if not row:
        raise HTTPException(status_code=404, detail="Triage report not found")
    return _serialize_report(row)


@router.post("/{report_id}/mark-triaged")
async def mark_triaged(
    report_id: uuid.UUID,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_msp_admin),
) -> dict:
    """Idempotent — marks all error_events linked to this report as triaged."""
    msp_id: uuid.UUID | None = (
        uuid.UUID(user["msp_id"]) if user.get("msp_id") else None
    )

    if msp_id:
        report = await conn.fetchrow(
            "SELECT id FROM triage_reports WHERE id=$1 AND msp_id=$2",
            report_id, msp_id,
        )
    else:
        report = await conn.fetchrow(
            "SELECT id FROM triage_reports WHERE id=$1",
            report_id,
        )

    if not report:
        raise HTTPException(status_code=404, detail="Triage report not found")

    count = await conn.fetchval(
        """
        WITH updated AS (
            UPDATE error_events
            SET triaged=TRUE, triaged_at=now(), triaged_by_report_id=$1
            WHERE triaged_by_report_id=$1 AND triaged=FALSE
            RETURNING id
        )
        SELECT count(*) FROM updated
        """,
        report_id,
    )
    return {"marked_triaged": int(count or 0)}


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------

def _serialize_report(row: asyncpg.Record) -> dict:
    data: dict = dict(row)
    if "id" in data:
        data["id"] = str(data["id"])
    if "msp_id" in data and data["msp_id"] is not None:
        data["msp_id"] = str(data["msp_id"])
    if "requested_by" in data and data["requested_by"] is not None:
        data["requested_by"] = str(data["requested_by"])
    if "created_at" in data and data["created_at"] is not None:
        data["created_at"] = data["created_at"].isoformat()
    if "completed_at" in data and data["completed_at"] is not None:
        data["completed_at"] = data["completed_at"].isoformat()
    return data
