"""Invites router — team member invite lifecycle.

Flow:
  1. msp_admin / client_admin sends POST /api/invites → creates invite record,
     fires n8n to email the magic link.
  2. Front-end loads /invite/{token} → GET /api/invites/{token}/validate to show
     invite context (org name, role, expiry) without consuming the token.
  3. User submits name + password → POST /api/invites/{token}/accept → creates
     Authentik user + users record + marks invite accepted.

Tokens are single-use, 72-hour TTL. Only sha256 hash is stored in DB.
"""
from __future__ import annotations

import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr

from app.database import get_db
from app.deps import get_current_user, require_client_admin_or_above
from app.services import authentik_service, n8n_service

router = APIRouter()

_TOKEN_TTL_HOURS = 72


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _make_token() -> str:
    return os.urandom(32).hex()  # 64 hex chars — unguessable


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------

class CreateInviteRequest(BaseModel):
    email: str
    role: str = "contributor"
    org_id: str


class AcceptInviteRequest(BaseModel):
    full_name: str
    password: str


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("", status_code=201)
async def create_invite(
    body: CreateInviteRequest,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_client_admin_or_above),
) -> dict:
    """Create an invite and send a magic-link email via n8n."""
    valid_roles = {"contributor", "viewer", "client_admin"}
    if body.role not in valid_roles:
        raise HTTPException(400, f"Role must be one of: {', '.join(sorted(valid_roles))}")

    try:
        org_uid = uuid.UUID(body.org_id)
    except ValueError:
        raise HTTPException(422, "Invalid org_id")

    org = await conn.fetchrow("SELECT id, name FROM orgs WHERE id = $1", org_uid)
    if not org:
        raise HTTPException(404, "Org not found")

    if user["role"] not in ("msp_admin", "super_admin"):
        if str(org_uid) != user.get("org_id"):
            raise HTTPException(403, "Cannot invite to a different org")

    # Check for existing active invite for this email + org
    existing = await conn.fetchrow(
        """
        SELECT id FROM invites
        WHERE email = $1 AND org_id = $2 AND accepted_at IS NULL AND expires_at > NOW()
        """,
        body.email.lower(),
        org_uid,
    )
    if existing:
        raise HTTPException(409, "An active invite already exists for this email")

    # Check if user already exists
    existing_user = await conn.fetchrow(
        "SELECT id FROM users WHERE email = $1", body.email.lower()
    )
    if existing_user:
        raise HTTPException(409, "A user with this email already exists")

    raw_token = _make_token()
    token_hash = _hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=_TOKEN_TTL_HOURS)

    invite_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO invites (id, email, role, org_id, invited_by, token_hash, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        invite_id,
        body.email.lower(),
        body.role,
        org_uid,
        uuid.UUID(user["user_id"]),
        token_hash,
        expires_at,
    )

    inviter = await conn.fetchrow(
        "SELECT full_name, email FROM users WHERE id = $1", uuid.UUID(user["user_id"])
    )

    background_tasks.add_task(
        n8n_service.trigger_invite,
        email=body.email.lower(),
        invite_token=raw_token,
        org_name=org["name"],
        invited_by_name=inviter["full_name"] if inviter else user.get("email", ""),
        role=body.role,
    )

    return {
        "invite_id": str(invite_id),
        "email": body.email.lower(),
        "role": body.role,
        "expires_at": expires_at.isoformat(),
    }


@router.get("/{token}/validate")
async def validate_invite(
    token: str,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Return invite context (org, role) without consuming the token.
    Called by the front-end invite-accept page on load."""
    token_hash = _hash_token(token)
    invite = await conn.fetchrow(
        """
        SELECT i.id, i.email, i.role, i.expires_at, i.accepted_at,
               o.name AS org_name, u.full_name AS invited_by_name
        FROM invites i
        JOIN orgs o ON i.org_id = o.id
        LEFT JOIN users u ON i.invited_by = u.id
        WHERE i.token_hash = $1
        """,
        token_hash,
    )
    if not invite:
        raise HTTPException(404, "Invite not found or already used")

    if invite["accepted_at"]:
        raise HTTPException(410, "This invite has already been accepted")

    if invite["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(410, "This invite has expired")

    return {
        "email": invite["email"],
        "role": invite["role"],
        "org_name": invite["org_name"],
        "invited_by": invite["invited_by_name"],
        "expires_at": invite["expires_at"].isoformat(),
    }


@router.post("/{token}/accept", status_code=201)
async def accept_invite(
    token: str,
    body: AcceptInviteRequest,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Accept an invite: create Authentik account + local user record."""
    token_hash = _hash_token(token)
    invite = await conn.fetchrow(
        """
        SELECT i.*, o.name AS org_name
        FROM invites i
        JOIN orgs o ON i.org_id = o.id
        WHERE i.token_hash = $1
        """,
        token_hash,
    )
    if not invite:
        raise HTTPException(404, "Invite not found or already used")

    if invite["accepted_at"]:
        raise HTTPException(410, "This invite has already been accepted")

    if invite["expires_at"] < datetime.now(timezone.utc):
        raise HTTPException(410, "This invite has expired")

    # Create Authentik user first (outside transaction — Authentik is external)
    try:
        authentik_id = await authentik_service.create_user(
            email=invite["email"],
            full_name=body.full_name,
            password=body.password,
        )
    except authentik_service.AuthentikError as exc:
        raise HTTPException(502, f"Failed to create account: {exc}")

    # Atomically create local user + mark invite accepted
    user_id = uuid.uuid4()
    try:
        async with conn.transaction():
            await conn.execute(
                """
                INSERT INTO users (id, authentik_id, email, full_name, role, org_id, is_active)
                VALUES ($1, $2, $3, $4, $5, $6, TRUE)
                """,
                user_id,
                authentik_id,
                invite["email"],
                body.full_name,
                invite["role"],
                invite["org_id"],
            )
            await conn.execute(
                "UPDATE invites SET accepted_at = NOW() WHERE id = $1",
                invite["id"],
            )
    except Exception as exc:
        # DB write failed after Authentik user was already created — best-effort cleanup
        import asyncio as _asyncio
        _asyncio.create_task(authentik_service._delete_user_best_effort(authentik_id))
        raise HTTPException(500, "Account created but failed to save locally — contact support") from exc

    return {
        "user_id": str(user_id),
        "email": invite["email"],
        "role": invite["role"],
        "org_name": invite["org_name"],
    }


@router.get("")
async def list_invites(
    org_id: Optional[str] = None,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(require_client_admin_or_above),
) -> dict:
    """List pending invites for an org. Returns active (not expired, not accepted)."""
    if org_id:
        try:
            org_uid = uuid.UUID(org_id)
        except ValueError:
            raise HTTPException(422, "Invalid org_id")
    else:
        if not user.get("org_id"):
            raise HTTPException(400, "org_id required")
        org_uid = uuid.UUID(user["org_id"])

    if user["role"] not in ("msp_admin", "super_admin"):
        if str(org_uid) != user.get("org_id"):
            raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT i.id, i.email, i.role, i.expires_at, i.created_at,
               u.full_name AS invited_by_name
        FROM invites i
        LEFT JOIN users u ON i.invited_by = u.id
        WHERE i.org_id = $1
          AND i.accepted_at IS NULL
          AND i.expires_at > NOW()
        ORDER BY i.created_at DESC
        """,
        org_uid,
    )

    return {
        "invites": [
            {
                "id": str(r["id"]),
                "email": r["email"],
                "role": r["role"],
                "invited_by": r["invited_by_name"],
                "expires_at": r["expires_at"].isoformat(),
                "created_at": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }
