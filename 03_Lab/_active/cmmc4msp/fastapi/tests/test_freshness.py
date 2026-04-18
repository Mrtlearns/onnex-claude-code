"""Tests for P4 — Evidence Freshness Monitoring endpoints."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import (
    ORG_ID,
    PROGRAM_ID,
    PROGRAM_CONTROL_ID,
    make_token,
    WEBHOOK_SECRET,
)

OTHER_ORG_ID = str(uuid.uuid4())


def _make_program_row(org_id: str = ORG_ID) -> MagicMock:
    data = {
        "id": uuid.UUID(PROGRAM_ID),
        "org_id": uuid.UUID(org_id),
    }
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _make_freshness_row(
    freshness_status: str = "fresh",
    nist_id: str = "3.1.1",
    control_id: str | None = None,
) -> MagicMock:
    now = datetime(2026, 4, 1, tzinfo=timezone.utc)
    expires = datetime(2026, 7, 1, tzinfo=timezone.utc)
    data = {
        "id": uuid.UUID(control_id or PROGRAM_CONTROL_ID),
        "nist_id": nist_id,
        "freshness_status": freshness_status,
        "last_evidence_at": now,
        "expires_at": expires,
        "stale_since": None,
        "evidence_max_age_days": 90,
    }
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


# ---------------------------------------------------------------------------
# GET /api/programs/{program_id}/freshness
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_freshness_report_happy_path(async_client):
    """GET /api/programs/{id}/freshness returns controls list and summary counts."""
    client, conn = async_client
    token = make_token(role="msp_admin")

    conn.fetchrow = AsyncMock(return_value=_make_program_row())
    conn.fetch = AsyncMock(
        return_value=[
            _make_freshness_row("fresh"),
            _make_freshness_row("expired"),
            _make_freshness_row("expiring_soon"),
            _make_freshness_row("no_evidence"),
        ]
    )

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}/freshness",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["program_id"] == PROGRAM_ID
    assert len(data["controls"]) == 4
    assert data["summary"]["fresh"] == 1
    assert data["summary"]["expired"] == 1
    assert data["summary"]["expiring_soon"] == 1
    assert data["summary"]["no_evidence"] == 1

    # Spot-check control shape
    ctrl = data["controls"][0]
    assert "id" in ctrl
    assert "nist_id" in ctrl
    assert "freshness_status" in ctrl
    assert "last_evidence_at" in ctrl
    assert "expires_at" in ctrl
    assert "evidence_max_age_days" in ctrl


@pytest.mark.asyncio
async def test_freshness_report_404(async_client):
    """Program not found → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin")

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}/freshness",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_freshness_report_403(async_client):
    """Client user from wrong org → 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    # Program belongs to ORG_ID, token is for OTHER_ORG_ID
    conn.fetchrow = AsyncMock(return_value=_make_program_row(org_id=ORG_ID))

    resp = await client.get(
        f"/api/programs/{PROGRAM_ID}/freshness",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_freshness_report_invalid_uuid(async_client):
    """Invalid UUID in path → 422."""
    client, conn = async_client
    token = make_token(role="msp_admin")

    resp = await client.get(
        "/api/programs/not-a-uuid/freshness",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/webhooks/n8n/mark-stale
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_mark_stale_webhook(async_client):
    """Valid secret + valid UUIDs → marks controls stale."""
    client, conn = async_client
    pc_id = str(uuid.uuid4())
    conn.execute = AsyncMock(return_value="UPDATE 1")

    resp = await client.post(
        "/api/webhooks/n8n/mark-stale",
        json={"program_control_ids": [pc_id]},
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert resp.status_code == 200
    assert resp.json()["marked_stale"] == 1
    conn.execute.assert_called_once()


@pytest.mark.asyncio
async def test_mark_stale_webhook_invalid_secret_403(async_client):
    """Wrong secret → 403."""
    client, conn = async_client
    pc_id = str(uuid.uuid4())

    resp = await client.post(
        "/api/webhooks/n8n/mark-stale",
        json={"program_control_ids": [pc_id]},
        headers={"X-Webhook-Secret": "wrong-secret"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_mark_stale_ignores_invalid_uuids(async_client):
    """Invalid UUIDs in list are silently skipped."""
    client, conn = async_client
    conn.execute = AsyncMock(return_value="UPDATE 0")

    resp = await client.post(
        "/api/webhooks/n8n/mark-stale",
        json={"program_control_ids": ["not-a-uuid", "also-not-a-uuid"]},
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert resp.status_code == 200
    # Invalid UUIDs skipped — execute never called, marked_stale is 0
    assert resp.json()["marked_stale"] == 0
    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_mark_stale_returns_count(async_client):
    """Returns correct marked_stale count when multiple valid IDs provided."""
    client, conn = async_client
    ids = [str(uuid.uuid4()) for _ in range(3)]
    conn.execute = AsyncMock(return_value="UPDATE 3")

    resp = await client.post(
        "/api/webhooks/n8n/mark-stale",
        json={"program_control_ids": ids},
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert resp.status_code == 200
    assert resp.json()["marked_stale"] == 3
