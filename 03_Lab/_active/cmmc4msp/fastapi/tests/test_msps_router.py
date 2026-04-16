"""Tests for /api/msps router."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import make_token, MSP_ID, ORG_ID


def _make_msp_record(overrides=None):
    data = {
        "id": uuid.UUID(MSP_ID),
        "name": "Acme MSP",
        "slug": "acme-msp",
        "status": "active",
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": None,
    }
    if overrides:
        data.update(overrides)
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, default=None: data.get(k, default)
    return rec


# ---------------------------------------------------------------------------
# list_msps
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_msps_requires_super_admin(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID)
    resp = await client.get("/api/msps/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_msps_requires_auth(async_client):
    client, _ = async_client
    resp = await client.get("/api/msps/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_list_msps_super_admin_sees_all(async_client):
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetch = AsyncMock(return_value=[_make_msp_record()])
    resp = await client.get("/api/msps/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body) == 1
    assert body[0]["slug"] == "acme-msp"


# ---------------------------------------------------------------------------
# create_msp
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_msp_blocked_for_msp_admin(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID)
    resp = await client.post(
        "/api/msps/",
        json={"name": "New MSP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_msp_super_admin_succeeds(async_client):
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetchval = AsyncMock(return_value=None)  # slug not taken
    conn.fetchrow = AsyncMock(return_value=_make_msp_record())
    resp = await client.post(
        "/api/msps/",
        json={"name": "Acme MSP"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert resp.json()["slug"] == "acme-msp"


# ---------------------------------------------------------------------------
# invite_msp_admin
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_invite_msp_admin_blocked_for_msp_admin(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID)
    resp = await client.post(
        f"/api/msps/{MSP_ID}/admins",
        json={"email": "admin@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_invite_msp_admin_msp_not_found(async_client):
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetchrow = AsyncMock(return_value=None)  # MSP doesn't exist
    resp = await client.post(
        f"/api/msps/{MSP_ID}/admins",
        json={"email": "admin@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_invite_msp_admin_duplicate_email(async_client):
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetchrow = AsyncMock(return_value=_make_msp_record())  # MSP exists
    conn.fetchval = AsyncMock(return_value=str(uuid.uuid4()))   # email already taken
    resp = await client.post(
        f"/api/msps/{MSP_ID}/admins",
        json={"email": "existing@acme.com"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 409
