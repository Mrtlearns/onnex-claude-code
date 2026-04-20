"""Tests for the /api/programs router (mocked DB)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import ORG_ID, MSP_ID, PROGRAM_ID, make_token


def _make_program_record(overrides: dict | None = None) -> MagicMock:
    data = {
        "id": uuid.UUID(PROGRAM_ID),
        "org_id": uuid.UUID(ORG_ID),
        "name": "Canopy CMMC Program",
        "status": "scoping",
        "sprs_score": -203,
        "far_above_score": 0,
        "current_phase": "phase_1",
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
    }
    if overrides:
        data.update(overrides)
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, default=None: data.get(k, default)
    return rec


# ---------------------------------------------------------------------------
# GET /api/programs/
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_programs_super_admin_sees_all(async_client):
    """super_admin with no org_id filter gets all programs."""
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetch = AsyncMock(return_value=[_make_program_record()])

    resp = await client.get("/api/programs/", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["name"] == "Canopy CMMC Program"


@pytest.mark.asyncio
async def test_list_programs_super_admin_filtered_by_org(async_client):
    """super_admin with ?org_id= returns programs for that org."""
    client, conn = async_client
    token = make_token(role="super_admin", org_id="", msp_id="")
    conn.fetch = AsyncMock(return_value=[_make_program_record()])

    resp = await client.get(
        f"/api/programs/?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()[0]["org_id"] == ORG_ID


@pytest.mark.asyncio
async def test_list_programs_msp_admin_sees_own_msp(async_client):
    """msp_admin sees all programs across their MSP's orgs."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetch = AsyncMock(return_value=[_make_program_record()])

    resp = await client.get("/api/programs/", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.asyncio
async def test_list_programs_msp_admin_wrong_org_returns_403(async_client):
    """msp_admin requesting an org not in their MSP gets 403."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    # org lookup returns None → not in this MSP
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/programs/?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_programs_client_sees_own_org_only(async_client):
    """client_admin sees only programs for their org_id."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetch = AsyncMock(return_value=[_make_program_record()])

    resp = await client.get("/api/programs/", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    assert resp.json()[0]["org_id"] == ORG_ID


@pytest.mark.asyncio
async def test_list_programs_requires_auth(async_client):
    client, _ = async_client
    resp = await client.get("/api/programs/")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/programs/{program_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_program_happy_path_msp_admin(async_client):
    """msp_admin can fetch a program when org belongs to their MSP."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    org_rec = MagicMock()
    org_rec.__getitem__ = lambda self, k: {"msp_id": uuid.UUID(MSP_ID)}[k]
    org_rec.get = lambda k, d=None: {"msp_id": uuid.UUID(MSP_ID)}.get(k, d)

    conn.fetchrow = AsyncMock(side_effect=[_make_program_record(), org_rec])

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()["id"] == PROGRAM_ID


@pytest.mark.asyncio
async def test_get_program_client_admin_same_org(async_client):
    """client_admin from same org can fetch their program."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_program_wrong_org_returns_403(async_client):
    """client_admin from a different org gets 403."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # org_id = ORG_ID

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_program_not_found(async_client):
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/programs/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_program_invalid_uuid(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    resp = await client.get(
        "/api/programs/not-a-uuid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/programs/
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_program_happy_path(async_client):
    """msp_admin creates a program — org exists, INSERT returns new row."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    org_rec = MagicMock()
    org_rec.__getitem__ = lambda self, k: {"id": uuid.UUID(ORG_ID)}[k]

    conn.fetchrow = AsyncMock(side_effect=[org_rec, _make_program_record()])

    resp = await client.post(
        "/api/programs/",
        json={"org_id": ORG_ID, "name": "Canopy CMMC Program", "system_name": "CUI System"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Canopy CMMC Program"
    assert body["status"] == "scoping"


@pytest.mark.asyncio
async def test_create_program_org_not_found(async_client):
    """POST /api/programs/ with unknown org_id returns 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=None)  # org lookup → None

    resp = await client.post(
        "/api/programs/",
        json={"org_id": str(uuid.uuid4()), "name": "Ghost Program"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_program_wrong_org_returns_403(async_client):
    """client_admin cannot create a program for a different org."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=ORG_ID)

    resp = await client.post(
        "/api/programs/",
        json={"org_id": other_org, "name": "Hijack Program"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/programs/{program_id}/reuse-summary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_reuse_summary_happy_path(async_client):
    """Returns artifact_count and control_count from DB query."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    summary_rec = MagicMock()
    summary_rec.__getitem__ = lambda self, k: {"artifact_count": 3, "control_count": 7}[k]
    summary_rec.get = lambda k, d=None: {"artifact_count": 3, "control_count": 7}.get(k, d)

    conn.fetchrow = AsyncMock(side_effect=[_make_program_record(), summary_rec])

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}/reuse-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["artifact_count"] == 3
    assert body["control_count"] == 7
    assert body["program_id"] == PROGRAM_ID


@pytest.mark.asyncio
async def test_reuse_summary_not_found(async_client):
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/programs/{uuid.uuid4()}/reuse-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_reuse_summary_wrong_org_returns_403(async_client):
    other_org = str(uuid.uuid4())
    client, conn = async_client
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # org_id = ORG_ID

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}/reuse-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# PATCH /api/programs/{program_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_program_happy_path(async_client):
    """PATCH with valid fields returns updated program."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    updated = _make_program_record({"name": "Renamed Program"})
    conn.fetchrow = AsyncMock(side_effect=[_make_program_record(), updated])

    resp = await client.patch(
        f"/api/programs/{PROGRAM_ID}",
        json={"system_name": "Updated CUI System"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_update_program_no_fields_returns_existing(async_client):
    """PATCH with empty body returns existing record unchanged."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    resp = await client.patch(
        f"/api/programs/{PROGRAM_ID}",
        json={},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()["id"] == PROGRAM_ID


@pytest.mark.asyncio
async def test_update_program_not_found(async_client):
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.patch(
        f"/api/programs/{uuid.uuid4()}",
        json={"system_name": "Ghost"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_update_program_wrong_org_returns_403(async_client):
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # org_id = ORG_ID

    resp = await client.patch(
        f"/api/programs/{PROGRAM_ID}",
        json={"system_name": "Hijacked"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403
