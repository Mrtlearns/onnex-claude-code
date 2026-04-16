"""Tests for the /api/controls router."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import ORG_ID, PROGRAM_ID, PROGRAM_CONTROL_ID, CONTROL_DEF_ID, make_token


def _make_control_def_record() -> MagicMock:
    data = {
        "id": uuid.UUID(CONTROL_DEF_ID),
        "nist_id": "3.1.1",
        "cmmc_id": "AC.L1-3.1.1",
        "family": "Access Control",
        "family_abbrev": "AC",
        "far_above_phase": "1",
        "dod_score_value": 5,
        "requirement_text": "Limit system access to authorized users.",
        "assessment_objective": "Determine if authorized users are the only ones with access.",
        "acceptable_proof_guidance": "User access list, AD group policy.",
        "is_objective": False,
        "is_basic": True,
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_prog_record() -> MagicMock:
    data = {"org_id": uuid.UUID(ORG_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_pc_record() -> MagicMock:
    data = {
        "id": uuid.UUID(PROGRAM_CONTROL_ID),
        "program_id": uuid.UUID(PROGRAM_ID),
        "control_definition_id": uuid.UUID(CONTROL_DEF_ID),
        "org_id": uuid.UUID(ORG_ID),
        "status": "not_implemented",
        "is_applicable": True,
        "is_phase_unlocked": True,
        "implementation_notes": None,
        "score_impact": None,
        "target_completion_date": None,
        "nist_id": "3.1.1",
        "cmmc_id": "AC.L1-3.1.1",
        "family": "Access Control",
        "family_abbrev": "AC",
        "far_above_phase": "1",
        "dod_score_value": 5,
        "requirement_text": "Limit system access to authorized users.",
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


@pytest.mark.asyncio
async def test_list_definitions_returns_all(async_client):
    """GET /api/controls/definitions should return all control definitions."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    conn.fetch = AsyncMock(return_value=[_make_control_def_record()])

    resp = await client.get(
        "/api/controls/definitions",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["nist_id"] == "3.1.1"


@pytest.mark.asyncio
async def test_list_program_controls(async_client):
    """GET /api/controls/program/{program_id} should return program controls."""
    client, conn = async_client
    token = make_token(role="msp_admin")

    conn.fetchrow = AsyncMock(return_value=_make_prog_record())
    conn.fetch = AsyncMock(return_value=[_make_pc_record()])

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["status"] == "not_implemented"


@pytest.mark.asyncio
async def test_list_program_controls_program_not_found(async_client):
    """GET /api/controls/program/{missing_id} should return 404."""
    client, conn = async_client
    token = make_token(role="msp_admin")
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/controls/program/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_control_status_triggers_sprs(async_client):
    """PATCH /api/controls/program/{program_id}/{control_id} should update and recalculate SPRS."""
    client, conn = async_client
    token = make_token(role="msp_admin")

    updated_rec = _make_pc_record()
    conn.fetchrow = AsyncMock(side_effect=[
        _make_prog_record(),  # program authz check
        updated_rec,          # UPDATE RETURNING
        updated_rec,          # re-fetch with joins
    ])
    conn.fetch = AsyncMock(return_value=[])  # SPRS rows

    with patch(
        "app.routers.controls.sprs_service.calculate_and_save_sprs",
        new=AsyncMock(return_value={"sprs_score": 105, "far_above_score": 37}),
    ):
        resp = await client.patch(
            f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}",
            json={"status": "fully_implemented", "implementation_notes": "Configured AD policies."},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
