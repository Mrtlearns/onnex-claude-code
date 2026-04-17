"""Tests for /api/assignments router — state machine and bulk assignment."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import make_token, ORG_ID, MSP_ID, PROGRAM_ID, PROGRAM_CONTROL_ID, USER_ID


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ASSIGNMENT_ID = str(uuid.uuid4())
ASSIGNEE_ID = str(uuid.uuid4())


def make_row(**kwargs):
    """Return a MagicMock that behaves like an asyncpg Record with dict-style access."""
    data = kwargs
    row = MagicMock()
    row.__getitem__ = lambda self, k: data[k]
    row.get = lambda k, d=None: data.get(k, d)
    return row


def _tok(role, org_id=ORG_ID, msp_id=""):
    """Make a token with a valid UUID sub (required by routes that call uuid.UUID(user_id))."""
    return make_token(role=role, org_id=org_id, msp_id=msp_id, sub=USER_ID)


def _make_program_row():
    return make_row(
        id=uuid.UUID(PROGRAM_ID),
        org_id=uuid.UUID(ORG_ID),
        msp_id=uuid.UUID(MSP_ID),
    )


def _make_assignee_row():
    return make_row(
        id=uuid.UUID(ASSIGNEE_ID),
        email="assignee@example.com",
        full_name="Test Assignee",
    )


def _make_assignment_row(status="assigned", org_id=ORG_ID, assigned_to=ASSIGNEE_ID):
    now = datetime.now(timezone.utc)
    return make_row(
        id=uuid.UUID(ASSIGNMENT_ID),
        status=status,
        org_id=uuid.UUID(org_id),
        assigned_to=uuid.UUID(assigned_to),
        program_id=uuid.UUID(PROGRAM_ID),
        program_control_id=uuid.UUID(PROGRAM_CONTROL_ID),
        # enriched fields for GET detail
        nist_id="AC.1.001",
        cmmc_id="AC.L1-3.1.1",
        requirement_text="Limit access...",
        family="Access Control",
        family_abbrev="AC",
        far_above_phase=1,
        assignee_email="assignee@example.com",
        assignee_name="Test Assignee",
        reviewer_id=None,
        reviewer_email=None,
        reviewer_name=None,
        review_note=None,
        reviewed_at=None,
        assigner_name="Admin User",
        due_date=None,
        instructions=None,
        submitted_at=None,
        created_at=now,
        updated_at=now,
    )


def _make_event_row():
    return make_row(
        id=uuid.uuid4(),
        old_status="unassigned",
        new_status="assigned",
        note=None,
        actor_name="Admin User",
        actor_email="admin@example.com",
        created_at=datetime.now(timezone.utc),
    )


# ---------------------------------------------------------------------------
# POST /api/assignments/bulk
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_bulk_assign_happy_path(async_client):
    """msp_admin can bulk-assign controls — creates new assignments."""
    client, conn = async_client
    token = _tok(role="msp_admin", org_id="", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_program_row(),   # program lookup
        _make_assignee_row(),  # assignee lookup
        None,                  # no existing assignment for the control
    ])
    conn.execute = AsyncMock(return_value="INSERT 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            "/api/assignments/bulk",
            json={
                "program_id": PROGRAM_ID,
                "control_ids": [PROGRAM_CONTROL_ID],
                "assignee_id": ASSIGNEE_ID,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    body = resp.json()
    assert body["created"] == 1
    assert len(body["assignment_ids"]) == 1


@pytest.mark.asyncio
async def test_bulk_assign_404_program_not_found(async_client):
    """Returns 404 when program does not exist."""
    client, conn = async_client
    token = _tok(role="msp_admin", org_id="", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(return_value=None)  # program not found

    resp = await client.post(
        "/api/assignments/bulk",
        json={
            "program_id": PROGRAM_ID,
            "control_ids": [PROGRAM_CONTROL_ID],
            "assignee_id": ASSIGNEE_ID,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_bulk_assign_403_wrong_org(async_client):
    """client_admin cannot assign to a program in a different org."""
    client, conn = async_client
    other_org_id = str(uuid.uuid4())
    token = _tok(role="client_admin", org_id=other_org_id)

    # program belongs to ORG_ID, token has other_org_id
    conn.fetchrow = AsyncMock(return_value=_make_program_row())

    resp = await client.post(
        "/api/assignments/bulk",
        json={
            "program_id": PROGRAM_ID,
            "control_ids": [PROGRAM_CONTROL_ID],
            "assignee_id": ASSIGNEE_ID,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_bulk_assign_404_assignee_not_found(async_client):
    """Returns 404 when assignee user does not exist or is inactive."""
    client, conn = async_client
    token = _tok(role="msp_admin", org_id="", msp_id=MSP_ID)

    conn.fetchrow = AsyncMock(side_effect=[
        _make_program_row(),  # program found
        None,                 # assignee not found
    ])

    resp = await client.post(
        "/api/assignments/bulk",
        json={
            "program_id": PROGRAM_ID,
            "control_ids": [PROGRAM_CONTROL_ID],
            "assignee_id": ASSIGNEE_ID,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_bulk_assign_updates_existing(async_client):
    """When an assignment already exists, it is updated (not duplicated)."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    existing = make_row(id=uuid.UUID(ASSIGNMENT_ID), status="assigned")

    conn.fetchrow = AsyncMock(side_effect=[
        _make_program_row(),   # program lookup
        _make_assignee_row(),  # assignee lookup
        existing,              # existing assignment found
    ])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            "/api/assignments/bulk",
            json={
                "program_id": PROGRAM_ID,
                "control_ids": [PROGRAM_CONTROL_ID],
                "assignee_id": ASSIGNEE_ID,
            },
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 201
    assert resp.json()["created"] == 1


# ---------------------------------------------------------------------------
# POST /api/assignments/{id}/transition
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_transition_assigned_to_in_progress(async_client):
    """client_admin can transition assigned → in_progress."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status="assigned")
    assignee_email_row = make_row(email="assignee@example.com")

    conn.fetchrow = AsyncMock(side_effect=[row, assignee_email_row])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            f"/api/assignments/{ASSIGNMENT_ID}/transition",
            json={"to_status": "in_progress"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["from"] == "assigned"
    assert body["to"] == "in_progress"


@pytest.mark.asyncio
async def test_transition_invalid_raises_400(async_client):
    """Attempting an invalid transition raises 400."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status="accepted")  # terminal state — no valid outgoing transitions
    conn.fetchrow = AsyncMock(return_value=row)

    resp = await client.post(
        f"/api/assignments/{ASSIGNMENT_ID}/transition",
        json={"to_status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_transition_contributor_blocked_on_other_assignment(async_client):
    """contributor role can only advance their own assignment, not others'."""
    client, conn = async_client
    other_user_id = str(uuid.uuid4())
    # Token sub (user_id) is USER_ID; assignment is assigned to a different user
    token = _tok(role="contributor", org_id=ORG_ID)

    row = _make_assignment_row(status="assigned", assigned_to=other_user_id)
    conn.fetchrow = AsyncMock(return_value=row)

    resp = await client.post(
        f"/api/assignments/{ASSIGNMENT_ID}/transition",
        json={"to_status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_transition_submitted_to_in_review_by_admin(async_client):
    """client_admin can advance submitted → in_review."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status="submitted")
    assignee_email_row = make_row(email="assignee@example.com")

    conn.fetchrow = AsyncMock(side_effect=[row, assignee_email_row])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            f"/api/assignments/{ASSIGNMENT_ID}/transition",
            json={"to_status": "in_review"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["to"] == "in_review"


@pytest.mark.asyncio
async def test_transition_in_review_to_accepted_sets_reviewer(async_client):
    """in_review → accepted sets reviewer fields via execute."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status="in_review")
    assignee_email_row = make_row(email="assignee@example.com")

    conn.fetchrow = AsyncMock(side_effect=[row, assignee_email_row])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            f"/api/assignments/{ASSIGNMENT_ID}/transition",
            json={"to_status": "accepted", "note": "Looks good"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.json()["to"] == "accepted"
    # Verify execute was called (UPDATE + INSERT event)
    assert conn.execute.call_count >= 2


@pytest.mark.asyncio
async def test_transition_in_review_to_rejected(async_client):
    """in_review → rejected is a valid admin transition."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status="in_review")
    assignee_email_row = make_row(email="assignee@example.com")

    conn.fetchrow = AsyncMock(side_effect=[row, assignee_email_row])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            f"/api/assignments/{ASSIGNMENT_ID}/transition",
            json={"to_status": "rejected", "note": "Missing evidence"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.json()["to"] == "rejected"


@pytest.mark.asyncio
async def test_transition_403_wrong_org(async_client):
    """User from a different org gets 403 on transition."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = _tok(role="client_admin", org_id=other_org)

    row = _make_assignment_row(status="assigned", org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=row)

    resp = await client.post(
        f"/api/assignments/{ASSIGNMENT_ID}/transition",
        json={"to_status": "in_progress"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# GET /api/assignments/{id}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_assignment_happy_path(async_client):
    """GET /api/assignments/{id} returns enriched detail."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row()
    conn.fetchrow = AsyncMock(return_value=row)
    conn.fetch = AsyncMock(side_effect=[
        [_make_event_row()],  # events
        [],                   # artifacts
    ])

    resp = await client.get(
        f"/api/assignments/{ASSIGNMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == ASSIGNMENT_ID
    assert body["status"] == "assigned"
    assert "events" in body
    assert "artifacts" in body
    assert "control" in body


@pytest.mark.asyncio
async def test_get_assignment_404(async_client):
    """GET /api/assignments/{id} returns 404 for unknown assignment."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/assignments/{ASSIGNMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_assignment_403_wrong_org(async_client):
    """GET /api/assignments/{id} returns 403 for wrong org."""
    client, conn = async_client
    other_org = str(uuid.uuid4())
    token = _tok(role="client_admin", org_id=other_org)

    row = _make_assignment_row(org_id=ORG_ID)
    conn.fetchrow = AsyncMock(return_value=row)

    resp = await client.get(
        f"/api/assignments/{ASSIGNMENT_ID}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


# ---------------------------------------------------------------------------
# State machine matrix — valid transitions
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@pytest.mark.parametrize("from_status,to_status", [
    ("unassigned", "assigned"),
    ("assigned", "submitted"),
    ("in_progress", "submitted"),
    ("submitted", "in_review"),
    ("rejected", "reassigned"),
    ("reassigned", "assigned"),
])
async def test_valid_transitions(async_client, from_status, to_status):
    """All valid state machine transitions succeed with appropriate role."""
    client, conn = async_client
    token = _tok(role="client_admin", org_id=ORG_ID)

    row = _make_assignment_row(status=from_status)
    assignee_email_row = make_row(email="assignee@example.com")

    conn.fetchrow = AsyncMock(side_effect=[row, assignee_email_row])
    conn.execute = AsyncMock(return_value="UPDATE 1")

    with patch("app.routers.assignments.asyncio.create_task", new=MagicMock()):
        resp = await client.post(
            f"/api/assignments/{ASSIGNMENT_ID}/transition",
            json={"to_status": to_status},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    assert resp.json()["to"] == to_status
