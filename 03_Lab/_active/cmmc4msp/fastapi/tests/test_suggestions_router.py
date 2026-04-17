"""Tests for /api/artifacts suggestions router.

Covers:
  - POST /{artifact_id}/apply-to-control — happy path, 404 no pc, 403 wrong org, 422 bad uuid
  - GET suggest-controls cached response includes applied field
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_token, ORG_ID, ARTIFACT_ID, PROGRAM_CONTROL_ID, USER_ID


PROGRAM_ID = str(uuid.uuid4())
CONTROL_DEF_ID = str(uuid.uuid4())
PC_ID = str(uuid.uuid4())


def make_row(**kwargs):
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _artifact_row():
    return make_row(
        id=uuid.UUID(ARTIFACT_ID),
        file_name="policy.pdf",
        minio_key="k",
        org_id=uuid.UUID(ORG_ID),
        program_control_id=uuid.UUID(PROGRAM_CONTROL_ID),
        program_id=uuid.UUID(PROGRAM_ID),
    )


def _pc_row():
    return make_row(
        id=uuid.UUID(PC_ID),
        control_definition_id=uuid.UUID(CONTROL_DEF_ID),
        program_id=uuid.UUID(PROGRAM_ID),
    )


# ---------------------------------------------------------------------------
# POST /{artifact_id}/apply-to-control
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_apply_suggestion_happy_path(async_client):
    """Returns 200 with ok=True and program_control_id on valid request."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _artifact_row(),  # artifact lookup
        _pc_row(),        # program_controls lookup
    ])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ok"] is True
    assert body["program_control_id"] == PC_ID


@pytest.mark.asyncio
async def test_apply_suggestion_404_no_program_control(async_client):
    """Returns 404 when program_controls row not found."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _artifact_row(),  # artifact found
        None,             # no program_controls row
    ])

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_apply_suggestion_404_artifact_not_found(async_client):
    """Returns 404 when artifact does not exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_apply_suggestion_403_wrong_org(async_client):
    """Returns 403 when user org does not match artifact org."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = make_token(role="client_admin", org_id=other_org, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_artifact_row())  # artifact belongs to ORG_ID

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_apply_suggestion_422_bad_artifact_uuid(async_client):
    """Returns 422 for a non-UUID artifact_id."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    resp = await client.post(
        "/api/artifacts/not-a-uuid/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_apply_suggestion_401_unauthenticated(async_client):
    """Returns 401 with no auth header."""
    client, conn = async_client

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/apply-to-control",
        json={"control_definition_id": CONTROL_DEF_ID, "program_id": PROGRAM_ID},
    )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# suggest-controls: cached response includes applied field
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_suggest_controls_cached_includes_applied(async_client):
    """Cached suggest-controls response includes applied=True when applied_at set."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    artifact_row = make_row(
        id=uuid.UUID(ARTIFACT_ID),
        file_name="policy.pdf",
        minio_key="k",
        org_id=uuid.UUID(ORG_ID),
        program_control_id=uuid.UUID(PROGRAM_CONTROL_ID),
        program_id=uuid.UUID(PROGRAM_ID),
    )

    cached_suggestion = make_row(
        control_definition_id=uuid.UUID(CONTROL_DEF_ID),
        similarity_score=0.87,
        top_chunk_texts=["chunk text here"],
        applied=True,
        nist_id="3.1.1",
        cmmc_id="AC.L2-3.1.1",
        requirement_text="Limit system access.",
        family="Access Control",
        family_abbrev="AC",
    )

    conn.fetchrow = AsyncMock(return_value=artifact_row)
    conn.fetch = AsyncMock(return_value=[cached_suggestion])

    resp = await client.post(
        f"/api/artifacts/{ARTIFACT_ID}/suggest-controls",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert len(body["suggestions"]) == 1
    assert body["suggestions"][0]["applied"] is True
