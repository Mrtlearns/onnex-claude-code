"""Tests for the n8n webhook endpoints — no JWT auth, shared secret only."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import ARTIFACT_ID, ASSESSMENT_ID, PROGRAM_CONTROL_ID, PROGRAM_ID, ORG_ID, WEBHOOK_SECRET


def _build_artifact_record():
    data = {
        "id": uuid.UUID(ARTIFACT_ID),
        "program_control_id": uuid.UUID(PROGRAM_CONTROL_ID),
        "assessment_status": "assessed",
        "assessment_attempts": 1,
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _build_pc_record():
    data = {"program_id": uuid.UUID(PROGRAM_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _build_existing_assessment_record():
    data = {"id": uuid.UUID(ASSESSMENT_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


@pytest.mark.asyncio
async def test_assessment_complete_requires_secret(async_client):
    """POST /api/webhooks/n8n/assessment-complete without secret → 401."""
    client, _ = async_client
    payload = {
        "artifact_id": ARTIFACT_ID,
        "program_control_id": PROGRAM_CONTROL_ID,
        "verdict": "met",
        "confidence": 0.95,
        "rationale": "All evidence present.",
        "gaps": [],
        "model_used": "openrouter/auto",
    }
    resp = await client.post("/api/webhooks/n8n/assessment-complete", json=payload)
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_assessment_complete_wrong_secret(async_client):
    """POST /api/webhooks/n8n/assessment-complete with wrong secret → 401."""
    client, _ = async_client
    payload = {
        "artifact_id": ARTIFACT_ID,
        "program_control_id": PROGRAM_CONTROL_ID,
        "verdict": "met",
        "confidence": 0.95,
        "rationale": "All evidence present.",
        "gaps": [],
        "model_used": "openrouter/auto",
    }
    resp = await client.post(
        "/api/webhooks/n8n/assessment-complete",
        json=payload,
        headers={"X-Webhook-Secret": "wrong-secret"},
    )
    assert resp.status_code == 401


def _make_transaction_ctx():
    ctx = MagicMock()
    ctx.__aenter__ = AsyncMock(return_value=None)
    ctx.__aexit__ = AsyncMock(return_value=False)
    return ctx


@pytest.mark.asyncio
async def test_assessment_complete_success(async_client):
    """POST /api/webhooks/n8n/assessment-complete with valid secret and payload → 200."""
    client, conn = async_client

    conn.transaction = MagicMock(return_value=_make_transaction_ctx())
    conn.fetchrow = AsyncMock(side_effect=[
        _build_artifact_record(),              # UPDATE artifacts RETURNING
        _build_existing_assessment_record(),   # SELECT id FROM assessments (existing)
        _build_pc_record(),                    # SELECT program_id FROM program_controls
    ])
    conn.execute = AsyncMock(return_value="INSERT 0 1")

    payload = {
        "artifact_id": ARTIFACT_ID,
        "program_control_id": PROGRAM_CONTROL_ID,
        "verdict": "met",
        "confidence": 0.95,
        "rationale": "All evidence present.",
        "gaps": [],
        "model_used": "openrouter/auto",
    }

    with patch(
        "app.routers.webhooks.sprs_service.calculate_and_save_sprs",
        new=AsyncMock(return_value={"sprs_score": 110, "far_above_score": 37}),
    ):
        resp = await client.post(
            "/api/webhooks/n8n/assessment-complete",
            json=payload,
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert "assessment_id" in resp.json()


@pytest.mark.asyncio
async def test_onboard_complete_success(async_client):
    """POST /api/webhooks/n8n/onboard-complete should update program status."""
    client, conn = async_client
    conn.execute = AsyncMock(return_value="UPDATE 1")

    payload = {
        "org_id": ORG_ID,
        "program_id": PROGRAM_ID,
        "controls_seeded": 110,
    }
    resp = await client.post(
        "/api/webhooks/n8n/onboard-complete",
        json=payload,
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
    assert resp.json()["controls_seeded"] == 110


@pytest.mark.asyncio
async def test_onboard_complete_requires_secret(async_client):
    """POST /api/webhooks/n8n/onboard-complete without secret → 401."""
    client, _ = async_client
    payload = {
        "org_id": ORG_ID,
        "program_id": PROGRAM_ID,
        "controls_seeded": 110,
    }
    resp = await client.post("/api/webhooks/n8n/onboard-complete", json=payload)
    assert resp.status_code == 401
