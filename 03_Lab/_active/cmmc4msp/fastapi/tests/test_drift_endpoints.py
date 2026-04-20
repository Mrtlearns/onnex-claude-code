"""Tests for A3 — Evidence Drift Detection HTTP endpoints."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    ARTIFACT_ID,
    ORG_ID,
    PROGRAM_CONTROL_ID,
    PROGRAM_ID,
    USER_ID,
    make_token,
    WEBHOOK_SECRET,
)

OTHER_ORG_ID = str(uuid.uuid4())


def _make_artifact_org_row(org_id: str = ORG_ID) -> MagicMock:
    data = {
        "id": uuid.UUID(ARTIFACT_ID),
        "org_id": uuid.UUID(org_id),
    }
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


# ---------------------------------------------------------------------------
# POST /api/artifacts/{artifact_id}/dismiss-drift
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_dismiss_drift_happy_path(async_client):
    """Valid user for correct org dismisses drift → 200 with status dismissed."""
    client, conn = async_client
    # Use USER_ID as sub so uuid.UUID(user["user_id"]) works
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_artifact_org_row(ORG_ID))
    conn.execute = AsyncMock(return_value="UPDATE 1")

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/dismiss-drift",
        json={"note": "Reviewed and approved — minor formatting change."},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "dismissed"
    assert data["artifact_id"] == ARTIFACT_ID


@pytest.mark.asyncio
async def test_dismiss_drift_wrong_org_403(async_client):
    """User from wrong org → 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID, sub=USER_ID)

    # Artifact belongs to ORG_ID, user is from OTHER_ORG_ID
    conn.fetchrow = AsyncMock(return_value=_make_artifact_org_row(ORG_ID))

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/dismiss-drift",
        json={"note": "Should be blocked."},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_dismiss_drift_not_found_404(async_client):
    """Artifact not found → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/dismiss-drift",
        json={"note": "Not found test."},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_dismiss_drift_no_auth_401(async_client):
    """No auth token → 401."""
    client, conn = async_client

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/dismiss-drift",
        json={"note": "No auth."},
    )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/webhooks/n8n/batch-drift-check
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_batch_drift_check_valid_secret(async_client):
    """Valid secret with artifact IDs → returns drifted/stable lists."""
    client, conn = async_client

    art_id = str(uuid.uuid4())
    art_data = {
        "id": uuid.UUID(art_id),
        "minio_key": "prog/ctrl/art/file.pdf",
        "mime_type": "application/pdf",
        "extracted_text": "Sample compliance text for drift analysis.",
    }
    row = MagicMock()
    row.__getitem__ = lambda self, k: art_data[k]
    row.get = lambda k, d=None: art_data.get(k, d)

    conn.fetchrow = AsyncMock(return_value=row)

    with patch(
        "app.services.drift_service.check_artifact_drift",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post(
            "/api/webhooks/n8n/batch-drift-check",
            json={"artifact_ids": [art_id]},
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "drifted" in data
    assert "stable" in data


@pytest.mark.asyncio
async def test_batch_drift_check_invalid_secret_403(async_client):
    """Wrong secret → 403."""
    client, conn = async_client

    resp = await client.post(
        "/api/webhooks/n8n/batch-drift-check",
        json={"artifact_ids": [ARTIFACT_ID]},
        headers={"X-Webhook-Secret": "wrong-secret"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_batch_drift_check_skips_invalid_uuids(async_client):
    """Invalid UUIDs are skipped without raising."""
    client, conn = async_client

    resp = await client.post(
        "/api/webhooks/n8n/batch-drift-check",
        json={"artifact_ids": ["not-a-uuid", "also-invalid"]},
        headers={"X-Webhook-Secret": WEBHOOK_SECRET},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["drifted"] == []
    assert data["stable"] == []


@pytest.mark.asyncio
async def test_batch_drift_check_returns_drifted_and_stable(async_client):
    """Mock check_artifact_drift to return score for one artifact, None for another."""
    client, conn = async_client

    art_id_drifted = str(uuid.uuid4())
    art_id_stable = str(uuid.uuid4())

    def _make_row(art_id: str):
        art_data = {
            "id": uuid.UUID(art_id),
            "minio_key": "prog/ctrl/art/file.pdf",
            "mime_type": "application/pdf",
            "extracted_text": "Some text content.",
        }
        row = MagicMock()
        row.__getitem__ = lambda self, k: art_data[k]
        row.get = lambda k, d=None: art_data.get(k, d)
        return row

    # Return correct row for each artifact
    def _fetchrow_side_effect(query, art_uid, *args):
        if art_uid == uuid.UUID(art_id_drifted):
            return _make_row(art_id_drifted)
        return _make_row(art_id_stable)

    conn.fetchrow = AsyncMock(side_effect=_fetchrow_side_effect)

    # check_artifact_drift returns a score for drifted, None for stable
    async def _mock_drift(artifact_id, current_text, conn, **kwargs):
        if str(artifact_id) == art_id_drifted:
            return 0.42
        return None

    with patch("app.services.drift_service.check_artifact_drift", side_effect=_mock_drift):
        resp = await client.post(
            "/api/webhooks/n8n/batch-drift-check",
            json={"artifact_ids": [art_id_drifted, art_id_stable]},
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert art_id_drifted in data["drifted"]
    assert art_id_stable in data["stable"]
