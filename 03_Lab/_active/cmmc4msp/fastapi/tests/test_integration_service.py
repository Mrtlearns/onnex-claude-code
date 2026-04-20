"""Tests for integration_service — 10 tests."""
from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
import respx

from app.services.integration_service import (
    get_integration_credentials,
    pull_crowdstrike_evidence,
    pull_defender_evidence,
    pull_entra_id_evidence,
    pull_o365_evidence,
    pull_okta_evidence,
    sync_integration,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_conn() -> AsyncMock:
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="OK")
    return conn


def _make_row(**kwargs) -> MagicMock:
    row = MagicMock()
    row.__getitem__ = lambda self, k: kwargs[k]
    row.get = lambda k, d=None: kwargs.get(k, d)
    return row


# ---------------------------------------------------------------------------
# get_integration_credentials
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_integration_credentials_found():
    """fetchrow returns a cred row — base64 decoded value is returned."""
    conn = _make_conn()
    encoded = base64.b64encode(b"test-token").decode()
    conn.fetchrow = AsyncMock(
        return_value=_make_row(
            credential_type="api_key",
            encrypted_value=encoded,
            expires_at=None,
        )
    )

    result = await get_integration_credentials(uuid.uuid4(), conn)

    assert result is not None
    assert result["value"] == "test-token"
    assert result["type"] == "api_key"
    assert result["expires_at"] is None


@pytest.mark.asyncio
async def test_get_integration_credentials_not_found():
    """fetchrow returns None — function returns None."""
    conn = _make_conn()
    conn.fetchrow = AsyncMock(return_value=None)

    result = await get_integration_credentials(uuid.uuid4(), conn)

    assert result is None


# ---------------------------------------------------------------------------
# sync_integration error paths
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_sync_integration_not_found():
    """fetchrow returns None (integration not found) — raises ValueError."""
    conn = _make_conn()
    conn.fetchrow = AsyncMock(return_value=None)

    with pytest.raises(ValueError, match="not found"):
        await sync_integration(uuid.uuid4(), conn)


@pytest.mark.asyncio
async def test_sync_integration_no_credentials():
    """Integration found but no credential row — raises ValueError."""
    conn = _make_conn()
    int_id = uuid.uuid4()
    org_id = uuid.uuid4()

    # First fetchrow call returns integration, second returns None (no creds)
    conn.fetchrow = AsyncMock(
        side_effect=[
            _make_row(id=int_id, org_id=org_id, provider="okta"),
            None,  # no credentials
        ]
    )

    with pytest.raises(ValueError, match="credentials"):
        await sync_integration(int_id, conn)


@pytest.mark.asyncio
async def test_sync_integration_unknown_provider():
    """Provider not in PROVIDER_PULLERS — raises ValueError."""
    conn = _make_conn()
    int_id = uuid.uuid4()
    org_id = uuid.uuid4()
    encoded = base64.b64encode(b"tok").decode()

    conn.fetchrow = AsyncMock(
        side_effect=[
            _make_row(id=int_id, org_id=org_id, provider="unknown_vendor"),
            _make_row(credential_type="api_key", encrypted_value=encoded, expires_at=None),
        ]
    )

    with pytest.raises(ValueError, match="Unknown provider"):
        await sync_integration(int_id, conn)


# ---------------------------------------------------------------------------
# Provider pullers — respx mocks
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_pull_entra_id_happy_path():
    """Graph API users + CA policies → 2 evidence items."""
    cred = {"value": "fake-bearer-token", "type": "oauth_token", "expires_at": None}
    org_id = uuid.uuid4()

    with respx.mock:
        respx.get(
            "https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,accountEnabled"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"value": [{"id": "u1", "displayName": "Alice", "userPrincipalName": "alice@test.com", "accountEnabled": True}]},
            )
        )
        respx.get(
            "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"value": [{"id": "p1", "displayName": "Require MFA"}]},
            )
        )

        result = await pull_entra_id_evidence(cred, org_id)

    assert len(result) == 2
    assert any("user_roster" in r["file_name"] for r in result)
    assert any("ca_policies" in r["file_name"] for r in result)
    for item in result:
        assert "controls" in item
        assert len(item["controls"]) > 0


@pytest.mark.asyncio
async def test_pull_okta_happy_path():
    """Okta users + MFA policies → 2 evidence items."""
    cred = {"value": "fake-ssws-token", "type": "api_key", "expires_at": None}
    org_id = uuid.uuid4()

    with respx.mock:
        respx.get(
            "https://api.okta.com/api/v1/users?limit=200"
        ).mock(
            return_value=httpx.Response(
                200,
                json=[{"id": "u1", "profile": {"login": "alice@test.com"}}],
            )
        )
        respx.get(
            "https://api.okta.com/api/v1/policies?type=MFA_ENROLL"
        ).mock(
            return_value=httpx.Response(
                200,
                json=[{"id": "pol1", "name": "MFA Required", "type": "MFA_ENROLL"}],
            )
        )

        result = await pull_okta_evidence(cred, org_id)

    assert len(result) == 2
    assert any("user_roster" in r["file_name"] for r in result)
    assert any("mfa_policies" in r["file_name"] for r in result)


@pytest.mark.asyncio
async def test_pull_defender_happy_path():
    """Defender machines endpoint → 1 evidence item."""
    cred = {"value": "fake-defender-token", "type": "oauth_token", "expires_at": None}
    org_id = uuid.uuid4()

    with respx.mock:
        respx.get(
            "https://api.securitycenter.microsoft.com/api/machines?$select=id,computerDnsName,osPlatform,riskScore,healthStatus"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"value": [{"id": "m1", "computerDnsName": "workstation-01", "osPlatform": "Windows10", "riskScore": "Low", "healthStatus": "Active"}]},
            )
        )

        result = await pull_defender_evidence(cred, org_id)

    assert len(result) == 1
    assert "endpoint_posture" in result[0]["file_name"]
    content = json.loads(result[0]["content"])
    assert content["count"] == 1


@pytest.mark.asyncio
async def test_pull_crowdstrike_happy_path():
    """CrowdStrike device query → 1 evidence item."""
    cred = {"value": "fake-cs-token", "type": "oauth_token", "expires_at": None}
    org_id = uuid.uuid4()

    with respx.mock:
        respx.get(
            "https://api.crowdstrike.com/devices/queries/devices/v1?limit=100"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"resources": ["dev-id-1", "dev-id-2", "dev-id-3"]},
            )
        )

        result = await pull_crowdstrike_evidence(cred, org_id)

    assert len(result) == 1
    content = json.loads(result[0]["content"])
    assert content["count"] == 3
    assert "3.14.1" in result[0]["controls"]


@pytest.mark.asyncio
async def test_pull_o365_happy_path():
    """O365 secure score → 1 evidence item."""
    cred = {"value": "fake-o365-token", "type": "oauth_token", "expires_at": None}
    org_id = uuid.uuid4()

    with respx.mock:
        respx.get(
            "https://graph.microsoft.com/v1.0/security/secureScores?$top=1"
        ).mock(
            return_value=httpx.Response(
                200,
                json={"value": [{"id": "ss1", "currentScore": 72.5, "maxScore": 100}]},
            )
        )

        result = await pull_o365_evidence(cred, org_id)

    assert len(result) == 1
    assert "secure_score" in result[0]["file_name"]
    assert "3.13.1" in result[0]["controls"]
