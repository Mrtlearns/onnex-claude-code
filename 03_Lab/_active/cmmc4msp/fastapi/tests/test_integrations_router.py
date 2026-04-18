"""Tests for /api/integrations router — 12 tests."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import ORG_ID, MSP_ID, make_token

OTHER_ORG_ID = str(uuid.uuid4())
INTEGRATION_ID = str(uuid.uuid4())


def _make_row(**kwargs) -> MagicMock:
    row = MagicMock()
    row.__getitem__ = lambda self, k: kwargs[k]
    row.get = lambda k, d=None: kwargs.get(k, d)
    return row


def _make_integration_row(
    integration_id: str = INTEGRATION_ID,
    org_id: str = ORG_ID,
    provider: str = "entra_id",
) -> MagicMock:
    now = datetime.now(timezone.utc)
    return _make_row(
        id=uuid.UUID(integration_id),
        org_id=uuid.UUID(org_id),
        provider=provider,
        display_name=provider,
        status="active",
        last_sync_at=None,
        last_error=None,
        created_at=now,
        updated_at=now,
    )


def _make_sync_log_row() -> MagicMock:
    return _make_row(
        id=uuid.uuid4(),
        synced_at=datetime.now(timezone.utc),
        artifacts_created=3,
        artifacts_updated=0,
        status="success",
        error_detail=None,
    )


# ---------------------------------------------------------------------------
# POST /api/integrations — create
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_integration_happy_path(async_client):
    """msp_admin creates entra_id integration → 201 with integration_id."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(
        side_effect=[
            _make_row(id=uuid.UUID(ORG_ID)),  # org exists
            None,  # no existing integration
        ]
    )
    conn.execute = AsyncMock(return_value="INSERT 1")

    resp = await client.post(
        "/api/integrations",
        json={
            "org_id": ORG_ID,
            "provider": "entra_id",
            "display_name": "Contoso Entra ID",
            "credential_type": "oauth_token",
            "credential_value": "my-bearer-token",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert "integration_id" in data
    assert data["provider"] == "entra_id"
    assert data["status"] == "active"


@pytest.mark.asyncio
async def test_create_integration_invalid_provider_400(async_client):
    """Unknown provider string → 400."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    resp = await client.post(
        "/api/integrations",
        json={
            "org_id": ORG_ID,
            "provider": "invalid_provider",
            "credential_value": "tok",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_create_integration_org_not_found_404(async_client):
    """Org does not exist → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(return_value=None)  # org not found

    resp = await client.post(
        "/api/integrations",
        json={
            "org_id": ORG_ID,
            "provider": "okta",
            "credential_value": "tok",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_integration_wrong_org_403(async_client):
    """client_admin for a different org → 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    conn.fetchrow = AsyncMock(return_value=_make_row(id=uuid.UUID(ORG_ID)))  # org exists

    resp = await client.post(
        "/api/integrations",
        json={
            "org_id": ORG_ID,
            "provider": "defender",
            "credential_value": "tok",
        },
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/integrations — list
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_integrations_empty(async_client):
    """No integrations for org → returns empty list."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"/api/integrations?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()["integrations"] == []


@pytest.mark.asyncio
async def test_list_integrations_with_data(async_client):
    """Org has integrations — returns serialized list."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetch = AsyncMock(
        return_value=[
            _make_integration_row(provider="entra_id"),
            _make_integration_row(provider="okta"),
        ]
    )

    resp = await client.get(
        f"/api/integrations?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["integrations"]) == 2
    providers = {i["provider"] for i in data["integrations"]}
    assert providers == {"entra_id", "okta"}


@pytest.mark.asyncio
async def test_list_integrations_wrong_org_403(async_client):
    """client_admin for different org → 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    resp = await client.get(
        f"/api/integrations?org_id={ORG_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /api/integrations/{id}/sync
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trigger_sync_happy_path(async_client):
    """Valid integration → 202 accepted with syncing status."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(
        return_value=_make_integration_row(integration_id=INTEGRATION_ID, org_id=ORG_ID)
    )

    with patch(
        "app.services.integration_service.sync_integration",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post(
            f"/api/integrations/{INTEGRATION_ID}/sync",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "syncing"
    assert data["integration_id"] == INTEGRATION_ID


@pytest.mark.asyncio
async def test_trigger_sync_not_found_404(async_client):
    """Integration not found → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/integrations/{INTEGRATION_ID}/sync",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_trigger_sync_wrong_org_403(async_client):
    """client_admin for different org → 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    conn.fetchrow = AsyncMock(
        return_value=_make_integration_row(integration_id=INTEGRATION_ID, org_id=ORG_ID)
    )

    resp = await client.post(
        f"/api/integrations/{INTEGRATION_ID}/sync",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /api/integrations/{id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_revoke_integration_happy_path(async_client):
    """DELETE → 204, conn.execute called to set status=revoked."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(
        return_value=_make_integration_row(integration_id=INTEGRATION_ID, org_id=ORG_ID)
    )
    conn.execute = AsyncMock(return_value="UPDATE 1")

    resp = await client.delete(
        f"/api/integrations/{INTEGRATION_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 204
    conn.execute.assert_called_once()
    call_args = conn.execute.call_args[0]
    assert "revoked" in call_args[0]


# ---------------------------------------------------------------------------
# GET /api/integrations/{id}/sync-history
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_sync_history_happy_path(async_client):
    """GET sync-history returns list of sync log entries."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="")

    conn.fetchrow = AsyncMock(
        return_value=_make_integration_row(integration_id=INTEGRATION_ID, org_id=ORG_ID)
    )
    conn.fetch = AsyncMock(return_value=[_make_sync_log_row(), _make_sync_log_row()])

    resp = await client.get(
        f"/api/integrations/{INTEGRATION_ID}/sync-history",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "history" in data
    assert len(data["history"]) == 2
    assert data["history"][0]["artifacts_created"] == 3
    assert data["history"][0]["status"] == "success"
