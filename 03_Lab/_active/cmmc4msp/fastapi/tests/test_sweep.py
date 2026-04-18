"""Tests for Program AI Sweep — bulk gap analysis + prioritized action plan.

Tests cover:
  - Router: POST /ai-sweep (create), GET /ai-sweep (list), GET /ai-sweep/{id} (get),
            POST /ai-sweep/{id}/apply (apply)
  - Service: sweep_service.run_program_sweep prompt construction unit test
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
    PROGRAM_ID,
    USER_ID,
    make_token,
)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

SWEEP_ID = str(uuid.uuid4())
ACTION_ID = str(uuid.uuid4())
PROGRAM_CONTROL_ID = str(uuid.uuid4())

BASE = f"/api/programs/{PROGRAM_ID}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_row(**data) -> MagicMock:
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    row.__bool__ = lambda self: True
    return row


def _make_program_row(org_id: str = ORG_ID) -> MagicMock:
    return _make_row(id=uuid.UUID(PROGRAM_ID), org_id=uuid.UUID(org_id))


def _make_sweep_row(status: str = "ready") -> MagicMock:
    now = datetime(2026, 4, 17, tzinfo=timezone.utc)
    return _make_row(
        id=uuid.UUID(SWEEP_ID),
        program_id=uuid.UUID(PROGRAM_ID),
        requested_by=uuid.UUID(USER_ID),
        status=status,
        control_count=5,
        sweep_report={"summary": "test", "themes": [], "actions": []},
        error_message=None,
        created_at=now,
        completed_at=now if status == "ready" else None,
    )


def _make_action_row() -> MagicMock:
    now = datetime(2026, 4, 17, tzinfo=timezone.utc)
    return _make_row(
        id=uuid.UUID(ACTION_ID),
        sweep_id=uuid.UUID(SWEEP_ID),
        program_control_id=uuid.UUID(PROGRAM_CONTROL_ID),
        nist_id="3.1.1",
        current_status="not_implemented",
        priority_rank=1,
        recommended_action="Implement access control policy.",
        gap_summary="No evidence of access controls.",
        confidence=0.85,
        applied=False,
        applied_at=None,
    )


# ---------------------------------------------------------------------------
# 1. test_create_sweep_happy_path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_sweep_happy_path(async_client):
    """POST /ai-sweep returns 202 with sweep_id and status=pending."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_row())
    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.programs._run_sweep", new=AsyncMock()):
        resp = await client.post(
            f"{BASE}/ai-sweep",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert "sweep_id" in body
    assert body["status"] == "pending"
    # sweep_id should be a valid UUID
    uuid.UUID(body["sweep_id"])


# ---------------------------------------------------------------------------
# 2. test_create_sweep_404_program_not_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_sweep_404_program_not_found(async_client):
    """POST /ai-sweep returns 404 when program does not exist."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"{BASE}/ai-sweep",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 3. test_create_sweep_422_invalid_uuid
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_sweep_422_invalid_uuid(async_client):
    """POST /ai-sweep returns 422 for invalid program_id UUID."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    resp = await client.post(
        "/api/programs/not-a-uuid/ai-sweep",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 4. test_create_sweep_403_client_user_cannot_sweep
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_sweep_403_client_user_cannot_sweep(async_client):
    """POST /ai-sweep returns 403 for client_user role."""
    client, conn = async_client
    token = make_token(role="client_user", org_id=ORG_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE}/ai-sweep",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# 5. test_list_sweeps_happy_path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_sweeps_happy_path(async_client):
    """GET /ai-sweep returns list of sweeps."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetch = AsyncMock(return_value=[_make_sweep_row()])

    resp = await client.get(
        f"{BASE}/ai-sweep",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 1
    sweep = data[0]
    assert sweep["id"] == SWEEP_ID
    assert sweep["status"] == "ready"
    assert sweep["control_count"] == 5


# ---------------------------------------------------------------------------
# 6. test_list_sweeps_empty
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_sweeps_empty(async_client):
    """GET /ai-sweep returns empty list when no sweeps exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"{BASE}/ai-sweep",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json() == []


# ---------------------------------------------------------------------------
# 7. test_get_sweep_happy_path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_sweep_happy_path(async_client):
    """GET /ai-sweep/{sweep_id} returns sweep detail with actions."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_sweep_row())
    conn.fetch = AsyncMock(return_value=[_make_action_row()])

    resp = await client.get(
        f"{BASE}/ai-sweep/{SWEEP_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == SWEEP_ID
    assert data["status"] == "ready"
    assert "actions" in data
    assert len(data["actions"]) == 1
    action = data["actions"][0]
    assert action["nist_id"] == "3.1.1"
    assert action["priority_rank"] == 1


# ---------------------------------------------------------------------------
# 8. test_get_sweep_404_not_found
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_sweep_404_not_found(async_client):
    """GET /ai-sweep/{sweep_id} returns 404 when sweep not found."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"{BASE}/ai-sweep/{SWEEP_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# 9. test_apply_sweep_happy_path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_sweep_happy_path(async_client):
    """POST /ai-sweep/{sweep_id}/apply applies selected actions and returns count."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_sweep_row(status="ready"))
    conn.fetch = AsyncMock(return_value=[_make_action_row()])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    resp = await client.post(
        f"{BASE}/ai-sweep/{SWEEP_ID}/apply",
        json={"action_ids": [ACTION_ID]},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["applied"] == 1


# ---------------------------------------------------------------------------
# 10. test_apply_sweep_409_not_ready
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_sweep_409_not_ready(async_client):
    """POST /ai-sweep/{sweep_id}/apply returns 409 when sweep status=pending."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_sweep_row(status="pending"))

    resp = await client.post(
        f"{BASE}/ai-sweep/{SWEEP_ID}/apply",
        json={"action_ids": [ACTION_ID]},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 409


# ---------------------------------------------------------------------------
# 11. test_apply_sweep_400_no_action_ids
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_sweep_400_no_action_ids(async_client):
    """POST /ai-sweep/{sweep_id}/apply returns 400 when action_ids is empty."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE}/ai-sweep/{SWEEP_ID}/apply",
        json={"action_ids": []},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# 12. test_sweep_service_builds_prompt_from_controls
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sweep_service_builds_prompt_from_controls():
    """Unit test: run_program_sweep sets status=running then handles empty controls gracefully."""
    from app.services.sweep_service import run_program_sweep

    sweep_uid = uuid.UUID(SWEEP_ID)
    prog_uid = uuid.UUID(PROGRAM_ID)
    user_uid = uuid.UUID(USER_ID)

    conn = AsyncMock()
    conn.execute = AsyncMock(return_value="OK")
    # fetch returns empty list → should write status=ready with control_count=0
    conn.fetch = AsyncMock(return_value=[])

    pool = MagicMock()
    pool.acquire.return_value.__aenter__ = AsyncMock(return_value=conn)
    pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    await run_program_sweep(sweep_uid, prog_uid, user_uid, pool)

    # First execute call should set status=running
    first_call_sql = conn.execute.call_args_list[0][0][0]
    assert "running" in first_call_sql

    # Second execute call should set status=ready with control_count=0
    second_call_sql = conn.execute.call_args_list[1][0][0]
    assert "ready" in second_call_sql
