"""Tests for /api/analytics router — MSP cross-client analytics (P5)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import ORG_ID, MSP_ID, make_token
from app.routers.analytics import _sprs_histogram


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_row(**kwargs) -> MagicMock:
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _make_org_row(name: str = "Acme Corp", latest_sprs: int | None = 72) -> MagicMock:
    now = datetime.now(timezone.utc)
    return _make_row(
        id=uuid.uuid4(),
        name=name,
        slug="acme-corp",
        program_count=2,
        latest_sprs=latest_sprs,
        last_activity_at=now,
    )


def _make_failing_row(nist_id: str = "3.1.1", fail_count: int = 3) -> MagicMock:
    return _make_row(
        nist_id=nist_id,
        requirement_text="Limit system access to authorized users.",
        fail_count=fail_count,
    )


def _make_weekly_row(assessed: int = 12, met: int = 8) -> MagicMock:
    return _make_row(assessed_this_week=assessed, met_this_week=met)


# ---------------------------------------------------------------------------
# GET /api/analytics/msp-summary
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_msp_summary_happy_path(async_client):
    """msp_admin receives full summary with orgs, failing controls, weekly activity."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetch = AsyncMock(side_effect=[
        [_make_org_row()],        # org_rows
        [_make_failing_row()],    # failing_rows
        [_make_weekly_row()],     # recent_rows
    ])

    resp = await client.get(
        "/api/analytics/msp-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "orgs" in body
    assert "org_count" in body
    assert "top_failing_controls" in body
    assert "weekly_activity" in body
    assert "sprs_distribution" in body
    assert body["org_count"] == 1


@pytest.mark.asyncio
async def test_msp_summary_client_admin_403(async_client):
    """client_admin is rejected with 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    resp = await client.get(
        "/api/analytics/msp-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_msp_summary_no_auth_401(async_client):
    """No token → 401."""
    client, conn = async_client

    resp = await client.get("/api/analytics/msp-summary")

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_msp_summary_empty_portfolio(async_client):
    """MSP with no orgs → empty lists, zero counts."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetch = AsyncMock(side_effect=[
        [],                       # org_rows
        [],                       # failing_rows
        [],                       # recent_rows
    ])

    resp = await client.get(
        "/api/analytics/msp-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["orgs"] == []
    assert body["org_count"] == 0
    assert body["top_failing_controls"] == []
    assert body["weekly_activity"]["assessed_this_week"] == 0


@pytest.mark.asyncio
async def test_msp_summary_includes_weekly_activity(async_client):
    """weekly_activity contains assessed_this_week and met_this_week."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetch = AsyncMock(side_effect=[
        [_make_org_row()],
        [],
        [_make_weekly_row(assessed=20, met=15)],
    ])

    resp = await client.get(
        "/api/analytics/msp-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    weekly = resp.json()["weekly_activity"]
    assert weekly["assessed_this_week"] == 20
    assert weekly["met_this_week"] == 15


@pytest.mark.asyncio
async def test_msp_summary_includes_top_failing_controls(async_client):
    """top_failing_controls list includes nist_id, requirement_text, fail_count."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetch = AsyncMock(side_effect=[
        [],
        [_make_failing_row("3.1.1", 7), _make_failing_row("3.3.1", 4)],
        [],
    ])

    resp = await client.get(
        "/api/analytics/msp-summary",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    controls = resp.json()["top_failing_controls"]
    assert len(controls) == 2
    assert controls[0]["nist_id"] == "3.1.1"
    assert controls[0]["fail_count"] == 7


# ---------------------------------------------------------------------------
# Unit tests for _sprs_histogram (pure function)
# ---------------------------------------------------------------------------

def test_sprs_histogram_all_negative():
    """All orgs with negative SPRS → negative bin gets all."""
    orgs = [{"latest_sprs": -50}, {"latest_sprs": -1}, {"latest_sprs": -203}]
    result = _sprs_histogram(orgs)
    assert result["negative"] == 3
    assert result["zero_to_50"] == 0
    assert result["fifty_to_100"] == 0
    assert result["perfect"] == 0


def test_sprs_histogram_mixed():
    """Mixed scores → correct bin assignment."""
    orgs = [
        {"latest_sprs": -10},   # negative
        {"latest_sprs": 0},     # zero_to_50
        {"latest_sprs": 49},    # zero_to_50
        {"latest_sprs": 50},    # fifty_to_100
        {"latest_sprs": 109},   # fifty_to_100
        {"latest_sprs": 110},   # perfect
        {"latest_sprs": None},  # skip
    ]
    result = _sprs_histogram(orgs)
    assert result["negative"] == 1
    assert result["zero_to_50"] == 2
    assert result["fifty_to_100"] == 2
    assert result["perfect"] == 1
