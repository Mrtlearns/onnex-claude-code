"""Tests for AI Error Triage Collector.

Tests cover:
  - Router: POST /api/triage/run (202), GET /api/triage/latest, GET /api/triage/reports,
            GET /api/triage/{id}, POST /api/triage/{id}/mark-triaged
  - Service: run_triage with 0 events, OpenRouter failure, status transitions
  - Auth: non-msp_admin role gets 403
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    MSP_ID,
    ORG_ID,
    USER_ID,
    make_token,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPORT_ID = str(uuid.uuid4())
BASE = "/api/triage"

_NOW = datetime(2026, 4, 17, 3, 0, 0, tzinfo=timezone.utc)

_SAMPLE_REPORT = {
    "summary": "Platform is healthy with minor issues.",
    "themes": [],
    "top_errors": [],
    "suggested_actions": [],
}


# ---------------------------------------------------------------------------
# Row factory helpers
# ---------------------------------------------------------------------------

def _make_row(**data) -> MagicMock:
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    row.__bool__ = lambda self: True
    row.keys = lambda: data.keys()
    # Support dict(row) via asyncpg Record protocol
    row.__iter__ = lambda self: iter(data.keys())
    row.items = lambda: data.items()
    return row


def _make_triage_row(status: str = "ready") -> MagicMock:
    return _make_row(
        id=uuid.UUID(REPORT_ID),
        msp_id=uuid.UUID(MSP_ID),
        requested_by=uuid.UUID(USER_ID),
        status=status,
        event_count=5 if status == "ready" else 0,
        report=_SAMPLE_REPORT,
        error_message=None,
        created_at=_NOW,
        completed_at=_NOW if status == "ready" else None,
    )


def _make_triage_list_row(status: str = "ready") -> MagicMock:
    """Slim row without 'report' field (used by list endpoint)."""
    return _make_row(
        id=uuid.UUID(REPORT_ID),
        msp_id=uuid.UUID(MSP_ID),
        status=status,
        event_count=5,
        error_message=None,
        created_at=_NOW,
        completed_at=_NOW if status == "ready" else None,
    )


# ---------------------------------------------------------------------------
# 1. POST /api/triage/run — happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_triage_happy_path(async_client):
    """POST /api/triage/run returns 202 with report_id and status=pending."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.triage.error_triage_service.run_triage", new=AsyncMock()):
        resp = await client.post(
            f"{BASE}/run",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert "report_id" in body
    assert body["status"] == "pending"
    # Must be a valid UUID
    uuid.UUID(body["report_id"])


# ---------------------------------------------------------------------------
# 2. GET /api/triage/latest — empty (no reports yet)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_latest_triage_empty(async_client):
    """GET /api/triage/latest returns {"report": null} when no reports exist."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"{BASE}/latest",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json() == {"report": None}


# ---------------------------------------------------------------------------
# 3. GET /api/triage/latest — returns latest report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_latest_triage_returns_report(async_client):
    """GET /api/triage/latest returns the most recent report when one exists."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_triage_row(status="ready"))

    resp = await client.get(
        f"{BASE}/latest",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == REPORT_ID
    assert body["status"] == "ready"


# ---------------------------------------------------------------------------
# 4. GET /api/triage/reports — paginated list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_triage_reports(async_client):
    """GET /api/triage/reports returns a list of reports."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetch = AsyncMock(return_value=[_make_triage_list_row()])

    resp = await client.get(
        f"{BASE}/reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]["id"] == REPORT_ID
    assert data[0]["status"] == "ready"


# ---------------------------------------------------------------------------
# 5. GET /api/triage/reports — empty list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_triage_reports_empty(async_client):
    """GET /api/triage/reports returns empty list when no reports exist."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"{BASE}/reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 6. GET /api/triage/{report_id} — 200 for known report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_triage_report_found(async_client):
    """GET /api/triage/{id} returns 200 with full report for a known ID."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_triage_row(status="ready"))

    resp = await client.get(
        f"{BASE}/{REPORT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == REPORT_ID
    assert body["status"] == "ready"
    assert body["event_count"] == 5


# ---------------------------------------------------------------------------
# 7. GET /api/triage/{report_id} — 404 for unknown UUID
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_triage_report_not_found(async_client):
    """GET /api/triage/{id} returns 404 for an unknown report ID."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    unknown_id = str(uuid.uuid4())
    resp = await client.get(
        f"{BASE}/{unknown_id}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404
    assert resp.json()["detail"] == "Triage report not found"


# ---------------------------------------------------------------------------
# 8. POST /api/triage/{report_id}/mark-triaged — returns count
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_mark_triaged_returns_count(async_client):
    """POST /api/triage/{id}/mark-triaged returns marked_triaged count."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_row(id=uuid.UUID(REPORT_ID)))
    conn.fetchval = AsyncMock(return_value=3)

    resp = await client.post(
        f"{BASE}/{REPORT_ID}/mark-triaged",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["marked_triaged"] == 3


# ---------------------------------------------------------------------------
# 9. Auth: client_user gets 403 on run
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_triage_403_client_user(async_client):
    """POST /api/triage/run returns 403 for client_user role."""
    client, conn = async_client
    token = make_token(role="client_user", org_id=ORG_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE}/run",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 10. Auth: client_admin gets 403 on reports list
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_reports_403_client_admin(async_client):
    """GET /api/triage/reports returns 403 for client_admin role."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    resp = await client.get(
        f"{BASE}/reports",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 11. Service unit test: run_triage with 0 events -> status='ready', empty report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_service_run_triage_zero_events():
    """run_triage: when no untriaged events found, writes status='ready' with empty report."""
    from app.services.error_triage_service import run_triage

    report_uid = uuid.uuid4()
    msp_uid = uuid.UUID(MSP_ID)

    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="OK")
    # Empty fetch means no untriaged errors
    conn.fetch = AsyncMock(return_value=[])

    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    await run_triage(
        report_id=report_uid,
        requested_by=uuid.UUID(USER_ID),
        msp_id=msp_uid,
        pool=pool,
    )

    # First execute: set status=running
    first_call = conn.execute.call_args_list[0][0][0]
    assert "running" in first_call

    # Second execute: set status=ready with event_count=0
    second_call = conn.execute.call_args_list[1][0][0]
    assert "ready" in second_call
    # The second arg should be the JSON payload containing the empty summary
    second_json_arg = conn.execute.call_args_list[1][0][1]
    parsed = json.loads(second_json_arg)
    assert parsed["summary"] == "No untriaged errors found. Platform appears healthy."
    assert parsed["themes"] == []
    assert parsed["top_errors"] == []


# ---------------------------------------------------------------------------
# 12. Service unit test: OpenRouter failure -> status='failed', error_message set
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_service_run_triage_openrouter_failure():
    """run_triage: when OpenRouter call raises, status='failed' and error_message is populated."""
    from app.services.error_triage_service import run_triage

    report_uid = uuid.uuid4()

    # Build a fake event row
    fake_event = MagicMock()
    fake_event.__getitem__ = lambda self, k: {
        "id": uuid.uuid4(),
        "created_at": _NOW,
        "source": "fastapi",
        "component": "services.sweep",
        "severity": "error",
        "message": "Connection refused",
        "stack_trace": "Traceback...",
        "context": {},
        "org_id": uuid.UUID(ORG_ID),
        "correlation_id": None,
    }[k]
    fake_event.get = lambda k, d=None: fake_event[k] if k in (
        "id", "created_at", "source", "component", "severity",
        "message", "stack_trace", "context", "org_id", "correlation_id"
    ) else d

    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="OK")
    conn.fetch = AsyncMock(side_effect=[
        [fake_event],   # first fetch: error_events
        [],             # second fetch: activity_log
    ])
    # transaction() context manager
    txn = AsyncMock()
    conn.transaction = MagicMock(return_value=txn)
    txn.__aenter__ = AsyncMock(return_value=txn)
    txn.__aexit__ = AsyncMock(return_value=False)

    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    boom = Exception("OpenRouter 429 - rate limit exceeded")

    with patch("app.services.error_triage_service.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(side_effect=boom)

        with patch("app.services.error_triage_service.error_events_service.record", new=AsyncMock()):
            with pytest.raises(Exception, match="OpenRouter 429"):
                await run_triage(
                    report_id=report_uid,
                    requested_by=None,
                    msp_id=None,
                    pool=pool,
                )

    # The failure UPDATE should have been called
    failed_calls = [
        c for c in conn.execute.call_args_list
        if "failed" in c[0][0]
    ]
    assert len(failed_calls) >= 1
    # error_message arg should contain the exception text
    error_msg_arg = failed_calls[0][0][1]
    assert "OpenRouter 429" in error_msg_arg


# ---------------------------------------------------------------------------
# 13. Status transition: GET /{id} reflects pending -> running -> ready
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_report_status_transitions(async_client):
    """GET /api/triage/{id} reflects whatever status the DB row has."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    for status in ("pending", "running", "ready", "failed"):
        conn.fetchrow = AsyncMock(return_value=_make_triage_row(status=status))
        resp = await client.get(
            f"{BASE}/{REPORT_ID}",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == status


# ---------------------------------------------------------------------------
# 14. super_admin can call run without msp_id (cross-MSP scope)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_triage_super_admin_no_msp(async_client):
    """POST /api/triage/run by super_admin (no msp_id) returns 202."""
    client, conn = async_client
    # super_admin has no msp_id
    token = make_token(role="super_admin", org_id="", msp_id="", sub=USER_ID)

    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.triage.error_triage_service.run_triage", new=AsyncMock()):
        resp = await client.post(
            f"{BASE}/run",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "pending"
    uuid.UUID(body["report_id"])


# ---------------------------------------------------------------------------
# 15. Webhook-secret bypass: n8n can call /run without a JWT
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_run_triage_webhook_secret_bypass(async_client):
    """POST /api/triage/run with correct X-Webhook-Secret succeeds without a JWT (202)."""
    from tests.conftest import WEBHOOK_SECRET
    client, conn = async_client

    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.triage.error_triage_service.run_triage", new=AsyncMock()):
        resp = await client.post(
            f"{BASE}/run",
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert "report_id" in body
    assert body["status"] == "pending"
    uuid.UUID(body["report_id"])


@pytest.mark.asyncio
async def test_run_triage_wrong_webhook_secret_returns_401(async_client):
    """POST /api/triage/run with wrong X-Webhook-Secret and no JWT returns 401."""
    client, conn = async_client

    resp = await client.post(
        f"{BASE}/run",
        headers={"X-Webhook-Secret": "wrong-secret"},
    )

    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_run_triage_no_auth_returns_401(async_client):
    """POST /api/triage/run with neither JWT nor webhook secret returns 401."""
    client, conn = async_client

    resp = await client.post(f"{BASE}/run")

    assert resp.status_code == 401
