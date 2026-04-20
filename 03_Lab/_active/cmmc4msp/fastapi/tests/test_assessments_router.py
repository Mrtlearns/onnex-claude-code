"""Tests for the /api/assessments router (mocked DB)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import ORG_ID, MSP_ID, ARTIFACT_ID, ASSESSMENT_ID, PROGRAM_CONTROL_ID, make_token


def _make_assessment_record(overrides: dict | None = None) -> MagicMock:
    data = {
        "id": uuid.UUID(ASSESSMENT_ID),
        "artifact_id": uuid.UUID(ARTIFACT_ID),
        "verdict": "partial",
        "confidence": 0.82,
        "rationale": "Policy covers most requirements but lacks specifics.",
        "gaps": ["Section 3.1.1 not addressed"],
        "model_used": "openrouter/auto",
        "reviewer_override": False,
        "reviewer_notes": None,
        "created_at": datetime(2026, 1, 1, tzinfo=timezone.utc),
        "org_id": uuid.UUID(ORG_ID),
    }
    if overrides:
        data.update(overrides)
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, default=None: data.get(k, default)
    return rec


def _make_pc_record() -> MagicMock:
    """program_controls join result with org_id."""
    data = {"org_id": uuid.UUID(ORG_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_artifact_record() -> MagicMock:
    data = {"program_control_id": uuid.UUID(PROGRAM_CONTROL_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_owner_record() -> MagicMock:
    """MSP scope check result — returns msp_id matching MSP_ID constant."""
    data = {"msp_id": uuid.UUID(MSP_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


# ---------------------------------------------------------------------------
# GET /api/assessments/
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_assessments_msp_admin_no_filter_returns_all(async_client):
    """msp_admin with no filter gets global assessment list."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetch = AsyncMock(return_value=[_make_assessment_record()])

    resp = await client.get("/api/assessments/", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert data[0]["verdict"] == "partial"


@pytest.mark.asyncio
async def test_list_assessments_non_admin_no_filter_returns_403(async_client):
    """client_admin without program_control_id filter is rejected."""
    client, _ = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    resp = await client.get("/api/assessments/", headers={"Authorization": f"Bearer {token}"})

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_assessments_filtered_by_program_control(async_client):
    """client_admin can list assessments for a specific program_control_id."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[_make_assessment_record()])

    resp = await client.get(
        f"/api/assessments/?program_control_id={PROGRAM_CONTROL_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()[0]["artifact_id"] == ARTIFACT_ID


@pytest.mark.asyncio
async def test_list_assessments_program_control_not_found(async_client):
    """Returns 404 when program_control_id doesn't exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/assessments/?program_control_id={uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_assessments_filtered_wrong_org_returns_403(async_client):
    """client_admin from different org cannot list assessments for another org's control."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_pc_record())  # org_id = ORG_ID

    resp = await client.get(
        f"/api/assessments/?program_control_id={PROGRAM_CONTROL_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_assessments_requires_auth(async_client):
    client, _ = async_client
    resp = await client.get("/api/assessments/")
    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/assessments/{assessment_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_assessment_happy_path_same_org(async_client):
    """client_admin from same org can fetch assessment."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_assessment_record())

    resp = await client.get(
        f"/api/assessments/{ASSESSMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == ASSESSMENT_ID
    assert body["confidence"] == 0.82


@pytest.mark.asyncio
async def test_get_assessment_msp_admin_cross_org(async_client):
    """msp_admin can fetch any assessment regardless of org."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=_make_assessment_record())

    resp = await client.get(
        f"/api/assessments/{ASSESSMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_get_assessment_wrong_org_returns_403(async_client):
    """client_admin from different org is denied."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_assessment_record())  # org_id = ORG_ID

    resp = await client.get(
        f"/api/assessments/{ASSESSMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_assessment_not_found(async_client):
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/assessments/{uuid.uuid4()}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_assessment_invalid_uuid(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    resp = await client.get(
        "/api/assessments/not-a-uuid",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/assessments/{assessment_id}/override
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_override_assessment_happy_path(async_client):
    """msp_admin override updates verdict and propagates to program_control."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    updated = _make_assessment_record({
        "verdict": "met",
        "reviewer_override": True,
        "reviewer_notes": "Manual review confirms full implementation.",
    })
    conn.fetchrow = AsyncMock(side_effect=[
        _make_assessment_record(),  # SELECT assessment
        _make_owner_record(),        # MSP scope check
        updated,                     # UPDATE assessment RETURNING
        _make_artifact_record(),     # SELECT artifact for program_control_id
    ])
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"/api/assessments/{ASSESSMENT_ID}/override",
        json={"verdict": "met", "reviewer_notes": "Manual review confirms full implementation."},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["verdict"] == "met"
    assert body["reviewer_override"] is True

    # Verify program_control UPDATE was called
    conn.execute.assert_awaited_once()
    call_args = conn.execute.call_args[0]
    assert "fully_implemented" in call_args[1]


@pytest.mark.asyncio
async def test_override_assessment_verdict_to_status_mapping(async_client):
    """Each verdict maps to the correct program_control status."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    expected_statuses = {
        "met": "fully_implemented",
        "partial": "implementation_begun",
        "not_met": "not_yet_addressed",
        "not_applicable": "not_applicable",
    }

    for verdict, expected_status in expected_statuses.items():
        updated = _make_assessment_record({"verdict": verdict, "reviewer_override": True})
        conn.fetchrow = AsyncMock(side_effect=[
            _make_assessment_record(),
            _make_owner_record(),
            updated,
            _make_artifact_record(),
        ])
        conn.execute = AsyncMock(return_value="OK")

        resp = await client.post(
            f"/api/assessments/{ASSESSMENT_ID}/override",
            json={"verdict": verdict, "reviewer_notes": f"Overriding to {verdict}"},
            headers={"Authorization": f"Bearer {token}"},
        )

        assert resp.status_code == 200, f"Failed for verdict={verdict}"
        call_args = conn.execute.call_args[0]
        assert expected_status in call_args[1], f"Expected status {expected_status} for verdict {verdict}"


@pytest.mark.asyncio
async def test_override_assessment_client_admin_forbidden(async_client):
    """client_admin cannot override — requires msp_admin."""
    client, _ = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    resp = await client.post(
        f"/api/assessments/{ASSESSMENT_ID}/override",
        json={"verdict": "met", "reviewer_notes": "Unauthorized override attempt"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_override_assessment_not_found(async_client):
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/assessments/{uuid.uuid4()}/override",
        json={"verdict": "met", "reviewer_notes": "Notes"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_override_assessment_requires_auth(async_client):
    client, _ = async_client
    resp = await client.post(
        f"/api/assessments/{ASSESSMENT_ID}/override",
        json={"verdict": "met", "reviewer_notes": "Notes"},
    )
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_override_assessment_missing_fields_returns_422(async_client):
    """Body without reviewer_notes should fail validation."""
    client, _ = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    resp = await client.post(
        f"/api/assessments/{ASSESSMENT_ID}/override",
        json={"verdict": "met"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422
