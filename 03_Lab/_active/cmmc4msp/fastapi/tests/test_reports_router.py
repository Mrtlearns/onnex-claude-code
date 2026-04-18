"""Tests for the /api/reports router (mocked DB + MinIO)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import ORG_ID, MSP_ID, PROGRAM_ID, WEBHOOK_SECRET, make_token


def _make_program_record() -> MagicMock:
    data = {"org_id": uuid.UUID(ORG_ID)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


PRESIGNED_URL = "https://minio.example.com/cmmc-reports/prog/ssp_20260101.pdf?X-Amz-Signature=abc"


# ---------------------------------------------------------------------------
# POST /api/reports/{program_id}/ssp
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_ssp_webhook_secret_auth(async_client):
    """n8n internal call via X-Webhook-Secret bypasses JWT and triggers generation."""
    client, conn = async_client
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    with patch(
        "app.routers.reports.generate_ssp_pdf",
        new=AsyncMock(return_value=PRESIGNED_URL),
    ):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/ssp",
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    assert resp.json()["download_url"] == PRESIGNED_URL


@pytest.mark.asyncio
async def test_generate_ssp_jwt_auth_msp_admin(async_client):
    """msp_admin with JWT can generate SSP."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # _check_program_access

    with patch(
        "app.routers.reports.generate_ssp_pdf",
        new=AsyncMock(return_value=PRESIGNED_URL),
    ):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/ssp",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert "download_url" in resp.json()


@pytest.mark.asyncio
async def test_generate_ssp_client_admin_same_org(async_client):
    """client_admin from same org can generate SSP."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    with patch(
        "app.routers.reports.generate_ssp_pdf",
        new=AsyncMock(return_value=PRESIGNED_URL),
    ):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/ssp",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_generate_ssp_wrong_org_returns_403(async_client):
    """client_admin from different org cannot generate SSP."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # org_id = ORG_ID

    with patch("app.routers.reports.generate_ssp_pdf", new=AsyncMock(return_value=PRESIGNED_URL)):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/ssp",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_generate_ssp_no_auth_returns_401(async_client):
    client, _ = async_client
    resp = await client.post(f"/api/reports/{PROGRAM_ID}/ssp")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_generate_ssp_invalid_uuid_returns_422(async_client):
    client, _ = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    resp = await client.post(
        "/api/reports/not-a-uuid/ssp",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_generate_ssp_program_not_found(async_client):
    """client_admin requesting SSP for nonexistent program gets 404."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    with patch("app.routers.reports.generate_ssp_pdf", new=AsyncMock(return_value=PRESIGNED_URL)):
        resp = await client.post(
            f"/api/reports/{uuid.uuid4()}/ssp",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /api/reports/{program_id}/poam
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_poam_webhook_secret_auth(async_client):
    """n8n call via webhook secret triggers POA&M generation."""
    client, conn = async_client
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    with patch(
        "app.routers.reports.generate_poam_pdf",
        new=AsyncMock(return_value=PRESIGNED_URL),
    ):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/poam",
            headers={"X-Webhook-Secret": WEBHOOK_SECRET},
        )

    assert resp.status_code == 200
    assert resp.json()["download_url"] == PRESIGNED_URL


@pytest.mark.asyncio
async def test_generate_poam_jwt_msp_admin(async_client):
    """msp_admin with JWT can generate POA&M."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())  # _check_program_access

    with patch(
        "app.routers.reports.generate_poam_pdf",
        new=AsyncMock(return_value=PRESIGNED_URL),
    ):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/poam",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_generate_poam_wrong_org_returns_403(async_client):
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    with patch("app.routers.reports.generate_poam_pdf", new=AsyncMock(return_value=PRESIGNED_URL)):
        resp = await client.post(
            f"/api/reports/{PROGRAM_ID}/poam",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/reports/{program_id}/downloads
# ---------------------------------------------------------------------------


def _make_minio_object(name: str, size: int = 12345) -> MagicMock:
    obj = MagicMock()
    obj.object_name = name
    obj.size = size
    obj.last_modified = datetime(2026, 1, 15, tzinfo=timezone.utc)
    return obj


@pytest.mark.asyncio
async def test_list_downloads_happy_path(async_client):
    """Returns sorted list of SSP and POA&M objects from MinIO."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    ssp_obj = _make_minio_object(f"{PROGRAM_ID}/ssp_20260115_120000.pdf")
    poam_obj = _make_minio_object(f"{PROGRAM_ID}/poam_20260114_090000.pdf")

    mock_minio = MagicMock()
    mock_minio.list_objects.return_value = [ssp_obj, poam_obj]

    from main import app as fastapi_app
    fastapi_app.state.minio = mock_minio

    resp = await client.get(
        f"/api/reports/{PROGRAM_ID}/downloads",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2
    types = {item["type"] for item in data}
    assert "ssp" in types
    assert "poam" in types


@pytest.mark.asyncio
async def test_list_downloads_program_not_found(async_client):
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/reports/{uuid.uuid4()}/downloads",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_downloads_wrong_org_returns_403(async_client):
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    resp = await client.get(
        f"/api/reports/{PROGRAM_ID}/downloads",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_list_downloads_minio_error_returns_500(async_client):
    """MinIO list failure returns 500 with error detail."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=_make_program_record())

    mock_minio = MagicMock()
    mock_minio.list_objects.side_effect = Exception("MinIO unavailable")

    from main import app as fastapi_app
    fastapi_app.state.minio = mock_minio

    resp = await client.get(
        f"/api/reports/{PROGRAM_ID}/downloads",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 500
    assert "Could not list reports" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_list_downloads_requires_auth(async_client):
    client, _ = async_client
    resp = await client.get(f"/api/reports/{PROGRAM_ID}/downloads")
    assert resp.status_code == 401
