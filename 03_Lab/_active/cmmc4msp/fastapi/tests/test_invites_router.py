"""Tests for /api/invites router — invite lifecycle."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from freezegun import freeze_time

from tests.conftest import make_token, ORG_ID, MSP_ID, USER_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

INVITE_ID = str(uuid.uuid4())
INVITE_TOKEN = "a" * 64  # 64-char hex token (fake, just for routing)


def make_row(**kwargs):
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _tok(role, org_id=ORG_ID, msp_id=""):
    """Token with valid UUID sub — required by routes that call uuid.UUID(user_id)."""
    return make_token(role=role, org_id=org_id, msp_id=msp_id, sub=USER_ID)


def _make_org_row(org_id=ORG_ID):
    return make_row(id=uuid.UUID(org_id), name="Acme Defense")


def _make_invite_row(
    *,
    accepted_at=None,
    expires_at=None,
    org_id=ORG_ID,
):
    now = datetime.now(timezone.utc)
    return make_row(
        id=uuid.UUID(INVITE_ID),
        email="invite@example.com",
        role="contributor",
        org_id=uuid.UUID(org_id),
        org_name="Acme Defense",
        accepted_at=accepted_at,
        expires_at=expires_at or (now + timedelta(hours=72)),
        invited_by_name="Admin User",
        created_at=now,
        invited_by=uuid.uuid4(),
    )


def _make_inviter_row():
    return make_row(full_name="Admin User", email="admin@example.com")


def _make_transaction_ctx():
    """Return a mock async context manager for conn.transaction()."""
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=None)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


# ---------------------------------------------------------------------------
# POST /api/invites — create invite
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_invite_happy_path(async_client):
    """client_admin creates an invite — token returned and n8n triggered."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_org_row(),       # org lookup
        None,                  # no existing invite
        None,                  # user doesn't exist yet
        _make_inviter_row(),   # inviter lookup
    ])
    conn.execute = AsyncMock(return_value="INSERT 1")

    resp = await client.post(
        "/api/invites",
        json={"email": "new@example.com", "role": "contributor", "org_id": ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 201
    body = resp.json()
    assert "invite_id" in body
    assert body["email"] == "new@example.com"
    assert body["role"] == "contributor"
    assert "expires_at" in body


@pytest.mark.asyncio
async def test_create_invite_invalid_role_400(async_client):
    """POST /api/invites with role=msp_admin returns 400."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    resp = await client.post(
        "/api/invites",
        json={"email": "new@example.com", "role": "msp_admin", "org_id": ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_invite_409_active_invite_exists(async_client):
    """Returns 409 when an active invite for that email + org already exists."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_org_row(),                        # org lookup
        make_row(id=uuid.UUID(INVITE_ID)),      # existing active invite
    ])

    resp = await client.post(
        "/api/invites",
        json={"email": "existing@example.com", "role": "contributor", "org_id": ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
    assert "active invite" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_invite_409_user_already_exists(async_client):
    """Returns 409 when a user with that email already exists."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_org_row(),                    # org lookup
        None,                               # no existing invite
        make_row(id=uuid.uuid4()),          # user already exists
    ])

    resp = await client.post(
        "/api/invites",
        json={"email": "existing@example.com", "role": "contributor", "org_id": ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
    assert "user" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_invite_403_different_org(async_client):
    """client_admin cannot invite to a different org."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = _tok(role="client_admin", org_id=other_org)

    conn.fetchrow = AsyncMock(return_value=_make_org_row(org_id=ORG_ID))

    resp = await client.post(
        "/api/invites",
        json={"email": "new@example.com", "role": "contributor", "org_id": ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/invites/{token}/validate
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_validate_invite_happy_path(async_client):
    """Returns org/role/expiry for a valid token."""
    client, conn = async_client
    invite = _make_invite_row()
    conn.fetchrow = AsyncMock(return_value=invite)

    resp = await client.get(f"/api/invites/{INVITE_TOKEN}/validate")

    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "invite@example.com"
    assert body["role"] == "contributor"
    assert "org_name" in body
    assert "expires_at" in body


@pytest.mark.asyncio
async def test_validate_invite_404_unknown_token(async_client):
    """Returns 404 for a token not found in DB."""
    client, conn = async_client
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get("/api/invites/unknowntoken/validate")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_validate_invite_410_expired(async_client):
    """Returns 410 for an expired invite (freezegun freezes time past expiry)."""
    client, conn = async_client
    past = datetime(2025, 1, 1, tzinfo=timezone.utc)
    invite = _make_invite_row(expires_at=past)
    conn.fetchrow = AsyncMock(return_value=invite)

    with freeze_time("2026-04-16"):
        resp = await client.get(f"/api/invites/{INVITE_TOKEN}/validate")

    assert resp.status_code == 410
    assert "expired" in resp.json()["detail"].lower()


@pytest.mark.asyncio
async def test_validate_invite_410_already_accepted(async_client):
    """Returns 410 for an already-accepted invite."""
    client, conn = async_client
    accepted = datetime(2026, 1, 1, tzinfo=timezone.utc)
    invite = _make_invite_row(accepted_at=accepted)
    conn.fetchrow = AsyncMock(return_value=invite)

    resp = await client.get(f"/api/invites/{INVITE_TOKEN}/validate")
    assert resp.status_code == 410
    assert "accepted" in resp.json()["detail"].lower()


# ---------------------------------------------------------------------------
# POST /api/invites/{token}/accept
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_accept_invite_happy_path(async_client):
    """accept creates Authentik user + local user record."""
    client, conn = async_client
    invite = _make_invite_row()
    conn.fetchrow = AsyncMock(return_value=invite)
    conn.execute = AsyncMock(return_value="INSERT 1")
    conn.transaction = MagicMock(return_value=_make_transaction_ctx())

    with patch(
        "app.routers.invites.authentik_service.create_user",
        new=AsyncMock(return_value=str(uuid.uuid4())),
    ):
        resp = await client.post(
            f"/api/invites/{INVITE_TOKEN}/accept",
            json={"full_name": "New User", "password": "Str0ng!pass"},
        )

    assert resp.status_code == 201
    body = resp.json()
    assert "user_id" in body
    assert body["email"] == "invite@example.com"
    assert body["role"] == "contributor"


@pytest.mark.asyncio
async def test_accept_invite_502_authentik_error(async_client):
    """Returns 502 when Authentik raises AuthentikError."""
    client, conn = async_client
    invite = _make_invite_row()
    conn.fetchrow = AsyncMock(return_value=invite)

    from app.services.authentik_service import AuthentikError

    with patch(
        "app.routers.invites.authentik_service.create_user",
        new=AsyncMock(side_effect=AuthentikError("Authentik down")),
    ):
        resp = await client.post(
            f"/api/invites/{INVITE_TOKEN}/accept",
            json={"full_name": "New User", "password": "Str0ng!pass"},
        )

    assert resp.status_code == 502
    assert "Failed to create account" in resp.json()["detail"]


# ---------------------------------------------------------------------------
# GET /api/invites — list invites
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_invites_client_admin(async_client):
    """client_admin can list active invites for their own org."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    invite_row = _make_invite_row()
    conn.fetch = AsyncMock(return_value=[invite_row])

    resp = await client.get(
        f"/api/invites?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "invites" in body
    assert len(body["invites"]) == 1
    assert body["invites"][0]["email"] == "invite@example.com"


@pytest.mark.asyncio
async def test_list_invites_403_viewer(async_client):
    """viewer role cannot list invites."""
    client, _ = async_client
    token = make_token(role="viewer", org_id=ORG_ID)

    resp = await client.get(
        f"/api/invites?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
