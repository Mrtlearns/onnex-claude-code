"""Tests for /api/artifacts router — upload, get, status, extract."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_token, ORG_ID, MSP_ID, PROGRAM_CONTROL_ID, ARTIFACT_ID, ASSESSMENT_ID, WEBHOOK_SECRET


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PROGRAM_ID = str(uuid.uuid4())


def make_row(**kwargs):
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _make_program_control_row():
    return make_row(
        id=uuid.UUID(PROGRAM_CONTROL_ID),
        org_id=uuid.UUID(ORG_ID),
        program_id=uuid.UUID(PROGRAM_ID),
    )


def _make_artifact_row(artifact_id=ARTIFACT_ID):
    now = datetime.now(timezone.utc)
    return make_row(
        id=uuid.UUID(artifact_id),
        program_control_id=uuid.UUID(PROGRAM_CONTROL_ID),
        file_name="policy.pdf",
        minio_key=f"prog/{PROGRAM_CONTROL_ID}/{artifact_id}/policy.pdf",
        mime_type="application/pdf",
        assessment_status="pending",
        assessment_attempts=0,
        org_id=uuid.UUID(ORG_ID),
        created_at=now,
        updated_at=now,
    )


def _make_assessment_row():
    now = datetime.now(timezone.utc)
    return make_row(
        id=uuid.UUID(ASSESSMENT_ID),
        artifact_id=uuid.UUID(ARTIFACT_ID),
        verdict="pass",
        confidence=0.92,
        rationale="Evidence is comprehensive.",
        gaps=[],
        model_used="claude-3-opus",
        reviewer_override=None,
        created_at=now,
    )


# ---------------------------------------------------------------------------
# POST /api/artifacts/{program_control_id}/upload
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_upload_happy_path(async_client):
    """Upload returns presigned_url and artifact_id."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_control_row())
    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.artifacts.get_presigned_upload_url", return_value="https://minio/upload-url"), \
         patch("app.routers.artifacts.get_presigned_download_url", return_value="https://minio/download-url"), \
         patch("app.routers.artifacts.n8n_service.trigger_assessment", new=AsyncMock()), \
         patch("app.routers.artifacts.asyncio.create_task", new=MagicMock()):

        resp = await client.post(
            f"/api/artifacts/{PROGRAM_CONTROL_ID}/upload?file_name=policy.pdf&mime_type=application/pdf",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    body = resp.json()
    assert "presigned_url" in body
    assert "artifact_id" in body
    assert body["presigned_url"] == "https://minio/upload-url"


@pytest.mark.asyncio
async def test_upload_404_unknown_program_control(async_client):
    """Returns 404 when program_control_id is not found."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/artifacts/{PROGRAM_CONTROL_ID}/upload",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_upload_403_wrong_org(async_client):
    """Returns 403 when user org does not match program org."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)

    # program_control belongs to ORG_ID but token has other_org
    conn.fetchrow = AsyncMock(return_value=_make_program_control_row())

    resp = await client.post(
        f"/api/artifacts/{PROGRAM_CONTROL_ID}/upload",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/artifacts/{id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_artifact_with_assessment(async_client):
    """Returns artifact row plus latest_assessment when one exists."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_artifact_row(),     # artifact lookup
        _make_assessment_row(),   # latest assessment
    ])

    resp = await client.get(
        f"/api/artifacts/{ARTIFACT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == ARTIFACT_ID
    assert "latest_assessment" in body
    assert body["latest_assessment"]["verdict"] == "pass"


@pytest.mark.asyncio
async def test_get_artifact_without_assessment(async_client):
    """Returns artifact row without latest_assessment when none exists."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_artifact_row(),  # artifact lookup
        None,                  # no assessment
    ])

    resp = await client.get(
        f"/api/artifacts/{ARTIFACT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert "latest_assessment" not in body


@pytest.mark.asyncio
async def test_get_artifact_404(async_client):
    """Returns 404 for unknown artifact_id."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/artifacts/{ARTIFACT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /api/artifacts/{id}/status
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_artifact_status_happy_path(async_client):
    """Returns assessment_status for a known artifact."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    status_row = make_row(
        id=uuid.UUID(ARTIFACT_ID),
        assessment_status="completed",
        org_id=uuid.UUID(ORG_ID),
    )
    conn.fetchrow = AsyncMock(return_value=status_row)

    resp = await client.get(
        f"/api/artifacts/{ARTIFACT_ID}/status",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["artifact_id"] == ARTIFACT_ID
    assert body["assessment_status"] == "completed"


# ---------------------------------------------------------------------------
# POST /api/artifacts/extract — n8n webhook
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_extract_happy_path(async_client):
    """Extraction endpoint returns extracted_text for valid webhook secret."""
    client, conn = async_client

    artifact_row = _make_artifact_row()
    conn.fetchrow = AsyncMock(return_value=artifact_row)
    conn.execute = AsyncMock(return_value="UPDATE 1")

    fake_extraction = {"extracted_text": "This is the policy text.", "page_count": 3}

    with patch("app.routers.artifacts.download_bytes", return_value=b"pdf bytes"), \
         patch("app.routers.artifacts.extract_text", return_value=fake_extraction):

        resp = await client.post(
            "/api/artifacts/extract",
            json={"artifact_id": ARTIFACT_ID, "secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["artifact_id"] == ARTIFACT_ID
    assert body["extracted_text"] == "This is the policy text."
    assert body["page_count"] == 3


@pytest.mark.asyncio
async def test_extract_401_wrong_secret(async_client):
    """Returns 401 when webhook secret is wrong."""
    client, conn = async_client

    resp = await client.post(
        "/api/artifacts/extract",
        json={"artifact_id": ARTIFACT_ID, "secret": "wrong-secret"},
    )
    assert resp.status_code == 401
