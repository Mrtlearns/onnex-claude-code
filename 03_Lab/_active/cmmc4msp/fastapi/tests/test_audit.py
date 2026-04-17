"""Tests for /api/audit router — C3PAO audit package export (P3)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    ORG_ID,
    MSP_ID,
    PROGRAM_ID,
    make_token,
    USER_ID,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PACKAGE_ID = str(uuid.uuid4())
OTHER_ORG_ID = str(uuid.uuid4())


def _make_row(**kwargs) -> MagicMock:
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _make_program_row(org_id: str = ORG_ID) -> MagicMock:
    return _make_row(
        id=uuid.UUID(PROGRAM_ID),
        org_id=uuid.UUID(org_id),
    )


def _make_package_row(status: str = "ready", minio_key: str = "prog/pkg/audit.zip", org_id: str = ORG_ID) -> MagicMock:
    now = datetime.now(timezone.utc)
    return _make_row(
        id=uuid.UUID(PACKAGE_ID),
        status=status,
        artifact_count=5,
        file_size_bytes=102400,
        created_at=now,
        completed_at=now if status == "ready" else None,
        created_by_name="MSP Admin",
        minio_key=minio_key,
        org_id=uuid.UUID(org_id),
    )


# ---------------------------------------------------------------------------
# POST /api/audit/programs/{program_id}/audit-package
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_audit_package_happy_path(async_client):
    """msp_admin triggers package generation → 202 with package_id and status=generating."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_row())
    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.audit._generate_audit_package", new=AsyncMock()):
        resp = await client.post(
            f"/api/audit/programs/{PROGRAM_ID}/audit-package",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    body = resp.json()
    assert "package_id" in body
    assert body["status"] == "generating"


@pytest.mark.asyncio
async def test_create_audit_package_not_found(async_client):
    """Program does not exist → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_create_audit_package_client_admin_403(async_client):
    """client_admin cannot create audit packages — require_msp_admin rejects them."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID)

    resp = await client.post(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/audit/programs/{program_id}/audit-package
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_audit_packages_empty(async_client):
    """No packages exist → returns empty list."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_row())
    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    assert resp.json()["packages"] == []


@pytest.mark.asyncio
async def test_list_audit_packages_with_data(async_client):
    """Returns serialized packages with expected fields."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_row())
    conn.fetch = AsyncMock(return_value=[_make_package_row()])

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    pkgs = resp.json()["packages"]
    assert len(pkgs) == 1
    pkg = pkgs[0]
    assert pkg["id"] == PACKAGE_ID
    assert pkg["status"] == "ready"
    assert pkg["artifact_count"] == 5
    assert "created_at" in pkg


@pytest.mark.asyncio
async def test_list_audit_packages_wrong_org_403(async_client):
    """client_admin from a different org cannot list packages."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    # Program belongs to ORG_ID, not OTHER_ORG_ID
    conn.fetchrow = AsyncMock(return_value=_make_program_row(org_id=ORG_ID))

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/audit/programs/{program_id}/audit-package/{package_id}/download
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_download_audit_package_ready(async_client):
    """Ready package returns presigned download URL."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=_make_package_row(status="ready"))

    with patch("app.routers.audit.get_presigned_download_url", return_value="https://minio/download"):
        resp = await client.get(
            f"/api/audit/programs/{PROGRAM_ID}/audit-package/{PACKAGE_ID}/download",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["download_url"] == "https://minio/download"
    assert body["expires_in"] == 3600


@pytest.mark.asyncio
async def test_download_audit_package_not_ready_409(async_client):
    """Package still generating → 409."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=_make_package_row(status="generating"))

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package/{PACKAGE_ID}/download",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 409


@pytest.mark.asyncio
async def test_download_audit_package_not_found_404(async_client):
    """Package not found → 404."""
    client, conn = async_client
    token = make_token(role="msp_admin", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package/{PACKAGE_ID}/download",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_download_audit_package_wrong_org_403(async_client):
    """client_admin from wrong org cannot download."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=OTHER_ORG_ID)

    # Package belongs to ORG_ID
    conn.fetchrow = AsyncMock(return_value=_make_package_row(status="ready", org_id=ORG_ID))

    resp = await client.get(
        f"/api/audit/programs/{PROGRAM_ID}/audit-package/{PACKAGE_ID}/download",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403
