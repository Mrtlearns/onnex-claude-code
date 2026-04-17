"""Tests for A4 — Multi-Artifact Cross-Control Gap Synthesis.

Tests cover:
  - Service: run_gap_analysis offline fallback + error path
  - Router: POST/GET gap-analysis endpoints
"""
from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    MSP_ID,
    ORG_ID,
    PROGRAM_CONTROL_ID,
    PROGRAM_ID,
    USER_ID,
    make_token,
)

_ANALYSIS_ID = str(uuid.uuid4())
_OTHER_ORG_ID = str(uuid.uuid4())

BASE_URL = f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(**data):
    m = MagicMock()
    m.__getitem__ = lambda self, k: data[k]
    m.get = lambda k, d=None: data.get(k, d)
    m.__bool__ = lambda self: True
    return m


def _make_pc_record(org_id: str = ORG_ID):
    return _make_record(
        id=uuid.UUID(PROGRAM_CONTROL_ID),
        org_id=uuid.UUID(org_id),
    )


def _make_analysis_row(analysis_id: str = _ANALYSIS_ID):
    return _make_record(
        id=uuid.UUID(analysis_id),
        status="ready",
        coverage_pct=0.75,
        objectives_covered=3,
        objectives_total=4,
        overall_assessment="3 of 4 objectives covered.",
        suggested_next_upload="Upload a password policy document.",
        created_at=datetime(2026, 4, 17, 10, 0, 0, tzinfo=timezone.utc),
        gap_report={"objectives": []},
        org_id=uuid.UUID(ORG_ID),
    )


# ---------------------------------------------------------------------------
# Router tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_trigger_gap_analysis_happy_path(async_client):
    """POST /gap-analysis returns 202 with status='generating'."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"{BASE_URL}/gap-analysis",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 202
    data = resp.json()
    assert data["status"] == "generating"
    assert "message" in data


@pytest.mark.asyncio
async def test_trigger_gap_analysis_wrong_org_403(async_client):
    """POST /gap-analysis returns 403 when client from different org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record(org_id=ORG_ID))

    resp = await client.post(
        f"{BASE_URL}/gap-analysis",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_trigger_gap_analysis_not_found_404(async_client):
    """POST /gap-analysis returns 404 when control not found."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"{BASE_URL}/gap-analysis",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_gap_analyses_empty(async_client):
    """GET /gap-analysis returns empty analyses list."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"{BASE_URL}/gap-analysis",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["analyses"] == []


@pytest.mark.asyncio
async def test_list_gap_analyses_with_data(async_client):
    """GET /gap-analysis returns serialized analysis rows."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[_make_analysis_row()])

    resp = await client.get(
        f"{BASE_URL}/gap-analysis",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    analyses = resp.json()["analyses"]
    assert len(analyses) == 1
    a = analyses[0]
    assert a["id"] == _ANALYSIS_ID
    assert a["status"] == "ready"
    assert a["coverage_pct"] == 0.75
    assert a["objectives_covered"] == 3
    assert a["objectives_total"] == 4
    assert "overall_assessment" in a
    assert "created_at" in a


@pytest.mark.asyncio
async def test_get_gap_analysis_happy_path(async_client):
    """GET /gap-analysis/{analysis_id} returns detail with gap_report."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_analysis_row())

    resp = await client.get(
        f"{BASE_URL}/gap-analysis/{_ANALYSIS_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == _ANALYSIS_ID
    assert data["status"] == "ready"
    assert "gap_report" in data
    assert "overall_assessment" in data
    assert "coverage_pct" in data


@pytest.mark.asyncio
async def test_get_gap_analysis_not_found_404(async_client):
    """GET /gap-analysis/{analysis_id} returns 404 when not found."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"{BASE_URL}/gap-analysis/{_ANALYSIS_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_gap_analysis_wrong_org_403(async_client):
    """GET /gap-analysis/{analysis_id} returns 403 when wrong org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_analysis_row())

    resp = await client.get(
        f"{BASE_URL}/gap-analysis/{_ANALYSIS_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# Service unit tests
# ---------------------------------------------------------------------------


class FakeRecord(dict):
    """Dict subclass behaving like asyncpg.Record."""

    def __getitem__(self, key):
        return super().__getitem__(key)

    def get(self, key, default=None):
        return super().get(key, default)


def _fr(**data) -> FakeRecord:
    return FakeRecord(data)


def _make_service_conn(control_row=None, objectives=None, direct_arts=None, cross_arts=None):
    """Build mock conn for run_gap_analysis calls."""
    conn = AsyncMock()

    # run_gap_analysis calls conn.execute (INSERT) then conn.fetchrow for control,
    # then conn.fetch for objectives, direct_artifacts, cross_artifacts
    conn.execute = AsyncMock(return_value="OK")

    fetchrow_side = [control_row] if control_row is not None else [None]
    conn.fetchrow = AsyncMock(side_effect=fetchrow_side)

    fetch_side = [
        objectives or [],
        direct_arts or [],
        cross_arts or [],
    ]
    call_count = 0

    async def _fetch(*args, **kwargs):
        nonlocal call_count
        result = fetch_side[call_count] if call_count < len(fetch_side) else []
        call_count += 1
        return result

    conn.fetch = AsyncMock(side_effect=_fetch)
    return conn


@pytest.mark.asyncio
async def test_run_gap_analysis_no_api_key():
    """Offline fallback creates ready record with fallback gap_report."""
    from app.services.gap_analysis_service import run_gap_analysis

    pc_uid = uuid.UUID(PROGRAM_CONTROL_ID)
    user_uid = uuid.UUID(USER_ID)

    control_row = _fr(
        nist_id="3.1.1",
        requirement_text="Limit system access to authorized users.",
    )
    objectives = [
        _fr(nist_id="3.1.1[a]", requirement_text="Obj A"),
        _fr(nist_id="3.1.1[b]", requirement_text="Obj B"),
    ]

    conn = _make_service_conn(
        control_row=control_row,
        objectives=objectives,
    )

    with patch("app.services.gap_analysis_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = ""
        analysis_id = await run_gap_analysis(pc_uid, user_uid, conn)

    assert isinstance(analysis_id, uuid.UUID)

    # Verify UPDATE was called with status='ready'
    execute_calls = conn.execute.call_args_list
    update_call = next(
        (c for c in execute_calls if "UPDATE" in c[0][0].upper() and "ready" in str(c[0])),
        None,
    )
    assert update_call is not None, "Expected UPDATE with status='ready'"


@pytest.mark.asyncio
async def test_run_gap_analysis_control_not_found():
    """Raises ValueError and sets status='error' when control is missing."""
    from app.services.gap_analysis_service import run_gap_analysis

    pc_uid = uuid.UUID(PROGRAM_CONTROL_ID)
    user_uid = uuid.UUID(USER_ID)

    conn = _make_service_conn(control_row=None)

    with patch("app.services.gap_analysis_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = ""
        with pytest.raises((ValueError, Exception)):
            await run_gap_analysis(pc_uid, user_uid, conn)

    # Verify UPDATE was called with status='error'
    execute_calls = conn.execute.call_args_list
    error_call = next(
        (c for c in execute_calls if "UPDATE" in c[0][0].upper() and "error" in str(c[0])),
        None,
    )
    assert error_call is not None, "Expected UPDATE with status='error'"
