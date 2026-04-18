"""Integration-style tests for the /api/orgs router (mocked DB)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import ORG_ID, MSP_ID, make_token


def _make_org_record(overrides: dict | None = None) -> MagicMock:
    data = {
        "id": uuid.UUID(ORG_ID),
        "name": "Acme Defense",
        "slug": "acme-defense",
        "status": "pending_onboard",
        "cage_code": "12ABC",
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "updated_at": None,
        "primary_contact_name": None,
        "primary_contact_email": None,
        "primary_contact_phone": None,
        "primary_contact_title": None,
        "scoping_config": None,
    }
    if overrides:
        data.update(overrides)
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, default=None: data.get(k, default)
    return rec


@pytest.mark.asyncio
async def test_list_orgs_msp_admin_sees_all(async_client):
    """MSP admin GET /api/orgs should return orgs for their MSP."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetch = AsyncMock(return_value=[_make_org_record()])

    resp = await client.get(
        "/api/orgs/",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["slug"] == "acme-defense"


@pytest.mark.asyncio
async def test_list_orgs_requires_auth(async_client):
    """GET /api/orgs without token should return 401."""
    client, _ = async_client
    resp = await client.get("/api/orgs/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_get_org_by_uuid(async_client):
    """GET /api/orgs/{org_id} should return the org record."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    conn.fetchrow = AsyncMock(return_value=_make_org_record())

    resp = await client.get(
        f"/api/orgs/{ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == ORG_ID


@pytest.mark.asyncio
async def test_get_org_not_found(async_client):
    """GET /api/orgs/{unknown_id} should return 404."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/orgs/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_org_msp_admin_only(async_client):
    """POST /api/orgs by non-admin should return 403."""
    client, _ = async_client
    token = make_token(role="client_admin")

    resp = await client.post(
        "/api/orgs/",
        json={"name": "New Org"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_create_org_auto_generates_slug(async_client):
    """POST /api/orgs without slug should auto-generate one from name."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    mock_record = _make_org_record({"slug": "acme-defense-llc"})

    conn.fetchval = AsyncMock(return_value=None)  # slug not taken
    conn.fetchrow = AsyncMock(return_value=mock_record)

    resp = await client.post(
        "/api/orgs/",
        json={"name": "Acme Defense LLC"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201
    assert "slug" in resp.json()


@pytest.mark.asyncio
async def test_create_org_accepts_custom_slug(async_client):
    """POST /api/orgs with explicit slug should use that slug."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    mock_record = _make_org_record({"slug": "my-custom-slug"})

    conn.fetchval = AsyncMock(return_value=None)
    conn.fetchrow = AsyncMock(return_value=mock_record)

    resp = await client.post(
        "/api/orgs/",
        json={"name": "My Org", "slug": "my-custom-slug"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_patch_org_forbidden_for_wrong_org(async_client):
    """PATCH /api/orgs/{org_id} by a user from a different org should return 403."""
    client, conn = async_client
    other_org_id = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org_id)
    conn.fetchrow = AsyncMock(return_value=_make_org_record())  # org exists

    resp = await client.patch(
        f"/api/orgs/{ORG_ID}",
        json={"name": "Hijacked"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
