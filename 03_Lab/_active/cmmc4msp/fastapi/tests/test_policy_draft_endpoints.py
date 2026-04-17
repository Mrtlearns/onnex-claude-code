"""Tests for policy draft endpoints on /api/controls/program/{program_id}/{control_id}/draft-policy."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    ORG_ID,
    MSP_ID,
    PROGRAM_ID,
    PROGRAM_CONTROL_ID,
    USER_ID,
    make_token,
)

_OTHER_ORG_ID = str(uuid.uuid4())
_DRAFT_ID = str(uuid.uuid4())


def _make_record(**data):
    m = MagicMock()
    m.__getitem__ = lambda self, k: data[k]
    m.get = lambda k, d=None: data.get(k, d)
    m.__bool__ = lambda self: True
    return m


def _make_pc_record(org_id: str = ORG_ID) -> MagicMock:
    """Mock program_control row with org_id."""
    return _make_record(
        id=uuid.UUID(PROGRAM_CONTROL_ID),
        org_id=uuid.UUID(org_id),
    )


def _make_draft_list_row(draft_id: str = _DRAFT_ID) -> MagicMock:
    return _make_record(
        id=uuid.UUID(draft_id),
        status="draft",
        created_at=datetime(2026, 4, 17, 10, 0, 0, tzinfo=timezone.utc),
        reviewed_at=None,
        reviewer_notes=None,
        minio_key="some/path/policy.docx",
        generated_by_name="John Doe",
        reviewed_by_name=None,
    )


def _make_draft_detail_row(draft_id: str = _DRAFT_ID) -> MagicMock:
    return _make_record(
        id=uuid.UUID(draft_id),
        status="draft",
        content_markdown="# My Policy\n\n## Purpose\n\nThis policy governs access.\n",
        minio_key="some/path/policy.docx",
        reviewer_notes=None,
        model_used="anthropic/claude-opus-4-7",
        created_at=datetime(2026, 4, 17, 10, 0, 0, tzinfo=timezone.utc),
        reviewed_at=None,
        org_id=uuid.UUID(ORG_ID),
    )


BASE_URL = f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}"


# ---------------------------------------------------------------------------
# POST /draft-policy
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_post_draft_happy_path(async_client):
    """POST draft-policy returns 202 with draft_id and status='generating'."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.execute = AsyncMock(return_value="OK")

    with patch("app.services.policy_draft_service.generate_policy_draft", new=AsyncMock(return_value=uuid.UUID(_DRAFT_ID))):
        resp = await client.post(
            f"{BASE_URL}/draft-policy",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 202
    data = resp.json()
    assert "draft_id" in data
    assert data["status"] == "generating"
    assert uuid.UUID(data["draft_id"])  # valid UUID


@pytest.mark.asyncio
async def test_post_draft_wrong_org_403(async_client):
    """POST draft-policy returns 403 when client_admin from different org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    # Control belongs to ORG_ID, token org is _OTHER_ORG_ID
    conn.fetchrow = AsyncMock(return_value=_make_pc_record(org_id=ORG_ID))

    resp = await client.post(
        f"{BASE_URL}/draft-policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_post_draft_not_found_404(async_client):
    """POST draft-policy returns 404 when control not found."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"{BASE_URL}/draft-policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /draft-policy (list)
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_drafts_list_empty(async_client):
    """GET draft-policy returns empty drafts list when no drafts exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"{BASE_URL}/draft-policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["drafts"] == []


@pytest.mark.asyncio
async def test_get_drafts_list_with_data(async_client):
    """GET draft-policy serializes rows correctly."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[_make_draft_list_row()])

    resp = await client.get(
        f"{BASE_URL}/draft-policy",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    drafts = resp.json()["drafts"]
    assert len(drafts) == 1
    d = drafts[0]
    assert d["id"] == _DRAFT_ID
    assert d["status"] == "draft"
    assert d["generated_by"] == "John Doe"
    assert d["has_docx"] is True
    assert "created_at" in d


# ---------------------------------------------------------------------------
# GET /draft-policy/{draft_id}
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_draft_detail_happy_path(async_client):
    """GET draft-policy/{draft_id} returns content_markdown and metadata."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_draft_detail_row())

    with patch("app.services.minio_service.get_presigned_download_url", return_value="https://minio/policy.docx"):
        resp = await client.get(
            f"{BASE_URL}/draft-policy/{_DRAFT_ID}",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == _DRAFT_ID
    assert data["status"] == "draft"
    assert "content_markdown" in data
    assert data["model_used"] == "anthropic/claude-opus-4-7"
    assert "created_at" in data


@pytest.mark.asyncio
async def test_get_draft_detail_not_found_404(async_client):
    """GET draft-policy/{draft_id} returns 404 when draft not found."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"{BASE_URL}/draft-policy/{_DRAFT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# POST /draft-policy/{draft_id}/review
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_review_draft_msp_approved(async_client):
    """MSP admin can approve a draft — conn.execute called with status='reviewed'."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_record(id=uuid.UUID(_DRAFT_ID)))
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"{BASE_URL}/draft-policy/{_DRAFT_ID}/review",
        json={"status": "reviewed", "reviewer_notes": "Looks good"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "reviewed"
    assert data["draft_id"] == _DRAFT_ID

    conn.execute.assert_called_once()
    call_sql = conn.execute.call_args[0][0]
    assert "UPDATE" in call_sql.upper()


@pytest.mark.asyncio
async def test_review_draft_rejected_with_notes(async_client):
    """MSP admin can reject a draft with notes."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_record(id=uuid.UUID(_DRAFT_ID)))
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"{BASE_URL}/draft-policy/{_DRAFT_ID}/review",
        json={"status": "rejected", "reviewer_notes": "Needs more detail on AC-2"},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "rejected"


@pytest.mark.asyncio
async def test_review_draft_client_403(async_client):
    """client_admin cannot review drafts — 403 returned."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE_URL}/draft-policy/{_DRAFT_ID}/review",
        json={"status": "reviewed"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
