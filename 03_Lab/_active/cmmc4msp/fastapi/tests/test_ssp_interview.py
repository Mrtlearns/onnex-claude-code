"""Tests for A5 — SSP Narrative Generation via Conversational Interview."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    MSP_ID,
    ORG_ID,
    PROGRAM_ID,
    USER_ID,
    make_token,
)

_INTERVIEW_ID = str(uuid.uuid4())
_OTHER_ORG_ID = str(uuid.uuid4())

BASE_URL = f"/api/programs/{PROGRAM_ID}/ssp-interview"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(**data):
    m = MagicMock()
    m.__getitem__ = lambda self, k: data[k]
    m.get = lambda k, d=None: data.get(k, d)
    m.__bool__ = lambda self: True
    return m


def _make_program_record(org_id: str = ORG_ID):
    return _make_record(
        id=uuid.UUID(PROGRAM_ID),
        org_id=uuid.UUID(org_id),
    )


def _make_inventory_program_record():
    """Record returned by pre_populate_from_inventory's fetchrow call."""
    return _make_record(
        system_name="Primary IS",
        org_name="Acme Defense LLC",
    )


def _make_interview_record(
    interview_id: str = _INTERVIEW_ID,
    org_id: str = ORG_ID,
    status: str = "in_progress",
):
    return _make_record(
        id=uuid.UUID(interview_id),
        status=status,
        responses={"q1": "Test system description"},
        generated_sections={},
        sections_reviewed={},
        reviewer_notes={},
        org_id=uuid.UUID(org_id),
        program_id=uuid.UUID(PROGRAM_ID),
        program_name="CMMC Program",
        system_name="Primary IS",
        org_name="Acme Defense LLC",
        cage_code="1ABC2",
    )


# ---------------------------------------------------------------------------
# POST /ssp-interview — start_interview
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_start_interview_happy_path(async_client):
    """POST /ssp-interview returns 201 with interview_id, questions, responses."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    # start_interview calls fetchrow twice:
    #   1. programs WHERE id = $1  (router auth check)
    #   2. programs JOIN orgs ...  (pre_populate_from_inventory)
    conn.fetchrow = AsyncMock(side_effect=[
        _make_program_record(),
        _make_inventory_program_record(),
    ])
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchval = AsyncMock(return_value=5)
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        BASE_URL,
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 201
    data = resp.json()
    assert "interview_id" in data
    assert uuid.UUID(data["interview_id"])
    assert data["status"] == "in_progress"
    assert "sections" in data
    assert "questions" in data
    assert "responses" in data
    assert isinstance(data["sections"], list)
    assert len(data["sections"]) > 0


@pytest.mark.asyncio
async def test_start_interview_wrong_org_403(async_client):
    """POST /ssp-interview returns 403 when client from wrong org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_program_record(org_id=ORG_ID))

    resp = await client.post(
        BASE_URL,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_start_interview_not_found_404(async_client):
    """POST /ssp-interview returns 404 when program not found."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        BASE_URL,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /ssp-interview/{interview_id} — get_interview
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_get_interview_happy_path(async_client):
    """GET /ssp-interview/{id} returns current interview state."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_interview_record())

    resp = await client.get(
        f"{BASE_URL}/{_INTERVIEW_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == _INTERVIEW_ID
    assert data["status"] == "in_progress"
    assert "responses" in data
    assert "generated_sections" in data
    assert "sections_reviewed" in data


@pytest.mark.asyncio
async def test_get_interview_not_found_404(async_client):
    """GET /ssp-interview/{id} returns 404 when not found."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"{BASE_URL}/{_INTERVIEW_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /ssp-interview/{interview_id} — update_answers
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_update_answers_happy_path(async_client):
    """PATCH /ssp-interview/{id} merges new responses with existing."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_interview_record())
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.patch(
        f"{BASE_URL}/{_INTERVIEW_ID}",
        json={"responses": {"q2": "We handle CUI drawings.", "q3": "About 15 users."}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["interview_id"] == _INTERVIEW_ID
    assert "responses" in data
    # q1 pre-populated + q2, q3 newly added
    assert "q2" in data["responses"]
    assert data["responses"]["q2"] == "We handle CUI drawings."


@pytest.mark.asyncio
async def test_update_answers_wrong_org_403(async_client):
    """PATCH /ssp-interview/{id} returns 403 when wrong org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_interview_record(org_id=ORG_ID))

    resp = await client.patch(
        f"{BASE_URL}/{_INTERVIEW_ID}",
        json={"responses": {"q2": "answer"}},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# POST /ssp-interview/{interview_id}/generate — generate_narratives
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_narratives_happy_path(async_client):
    """POST /ssp-interview/{id}/generate returns 200 with status='generating'."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_interview_record())
    conn.execute = AsyncMock(return_value="OK")
    conn.fetch = AsyncMock(return_value=[])

    resp = await client.post(
        f"{BASE_URL}/{_INTERVIEW_ID}/generate",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "generating"
    assert "sections" in data
    assert isinstance(data["sections"], list)


# ---------------------------------------------------------------------------
# POST /ssp-interview/{interview_id}/review — review_section
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_review_section_approved(async_client):
    """MSP admin can approve a section."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_interview_record())
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"{BASE_URL}/{_INTERVIEW_ID}/review",
        json={"section": "system_description", "decision": "approved", "notes": "Looks good."},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["section"] == "system_description"
    assert data["decision"] == "approved"


@pytest.mark.asyncio
async def test_review_section_client_403(async_client):
    """client_admin cannot review sections — 403."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE_URL}/{_INTERVIEW_ID}/review",
        json={"section": "system_description", "decision": "approved"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_review_section_invalid_decision_400(async_client):
    """Invalid decision value returns 400."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    resp = await client.post(
        f"{BASE_URL}/{_INTERVIEW_ID}/review",
        json={"section": "system_description", "decision": "maybe"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /ssp-interview/{interview_id}/commit — commit_narratives
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_commit_narratives_happy_path(async_client):
    """MSP admin: commit approved sections writes to programs and activity_log."""
    client, conn = async_client
    token = make_token(role="msp_admin", org_id="", msp_id=MSP_ID, sub=USER_ID)

    interview_with_approved = _make_interview_record(status="awaiting_review")
    # Override JSONB fields to simulate one approved section
    interview_with_approved.get = lambda k, d=None: {
        "generated_sections": {"system_description": "Generated narrative text."},
        "sections_reviewed": {"system_description": "approved"},
        "responses": {},
        "reviewer_notes": {},
    }.get(k, d)
    interview_with_approved.__getitem__ = lambda self, k: {
        "id": uuid.UUID(_INTERVIEW_ID),
        "status": "awaiting_review",
        "responses": {},
        "generated_sections": {"system_description": "Generated narrative text."},
        "sections_reviewed": {"system_description": "approved"},
        "reviewer_notes": {},
        "org_id": uuid.UUID(ORG_ID),
        "program_id": uuid.UUID(PROGRAM_ID),
        "program_name": "CMMC Program",
        "system_name": "Primary IS",
        "org_name": "Acme Defense LLC",
        "cage_code": "1ABC2",
    }[k]

    conn.fetchrow = AsyncMock(return_value=interview_with_approved)
    conn.execute = AsyncMock(return_value="OK")

    resp = await client.post(
        f"{BASE_URL}/{_INTERVIEW_ID}/commit",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "committed_sections" in data
    assert data["status"] == "completed"
    # At least one section committed (system_description)
    assert isinstance(data["committed_sections"], list)
