"""Tests for /api/notifications router — preferences + unsubscribe."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from tests.conftest import make_token, USER_ID
from app.services.email_service import VALID_CATEGORIES


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_record(**data):
    m = MagicMock()
    m.__getitem__ = lambda self, k: data[k]
    m.get = lambda k, d=None: data.get(k, d)
    return m


def _tok(role="client_user"):
    """Token with a valid UUID sub — required by get_current_user."""
    return make_token(role=role, sub=USER_ID)


UNSUBSCRIBE_TOKEN = "a" * 64


# ---------------------------------------------------------------------------
# GET /api/notifications/preferences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_preferences_empty(async_client):
    """No saved prefs → all categories returned with default True."""
    client, mock_conn = async_client
    mock_conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        "/api/notifications/preferences",
        headers={"Authorization": f"Bearer {_tok()}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "preferences" in data
    prefs = data["preferences"]
    # All valid categories present
    for cat in VALID_CATEGORIES:
        assert cat in prefs
        assert prefs[cat] is True


@pytest.mark.asyncio
async def test_get_preferences_with_saved(async_client):
    """Saved rows override defaults; unset categories still default to True."""
    client, mock_conn = async_client
    mock_conn.fetch = AsyncMock(return_value=[
        _make_record(category="assignment", enabled=False),
        _make_record(category="invite", enabled=True),
    ])

    resp = await client.get(
        "/api/notifications/preferences",
        headers={"Authorization": f"Bearer {_tok()}"},
    )

    assert resp.status_code == 200
    prefs = resp.json()["preferences"]
    assert prefs["assignment"] is False
    assert prefs["invite"] is True
    # Categories not in saved rows default to True
    for cat in VALID_CATEGORIES - {"assignment", "invite"}:
        assert prefs[cat] is True


@pytest.mark.asyncio
async def test_get_preferences_no_auth(async_client):
    """No token → 401."""
    client, _ = async_client

    resp = await client.get("/api/notifications/preferences")

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# PATCH /api/notifications/preferences
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_preferences_happy_path(async_client):
    """Valid categories → conn.execute called per category, returns updated list."""
    client, mock_conn = async_client
    mock_conn.execute = AsyncMock(return_value="OK")

    payload = {"preferences": {"assignment": False, "invite": True}}

    resp = await client.patch(
        "/api/notifications/preferences",
        json=payload,
        headers={"Authorization": f"Bearer {_tok()}"},
    )

    assert resp.status_code == 200
    data = resp.json()
    assert "updated" in data
    assert set(data["updated"]) == {"assignment", "invite"}
    # One execute call per category
    assert mock_conn.execute.call_count == 2


@pytest.mark.asyncio
async def test_update_preferences_invalid_category(async_client):
    """Unknown category in payload → 400."""
    client, mock_conn = async_client

    payload = {"preferences": {"unknown_cat": True, "invite": False}}

    resp = await client.patch(
        "/api/notifications/preferences",
        json=payload,
        headers={"Authorization": f"Bearer {_tok()}"},
    )

    assert resp.status_code == 400
    assert "unknown_cat" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_update_preferences_no_auth(async_client):
    """No token → 401."""
    client, _ = async_client

    resp = await client.patch(
        "/api/notifications/preferences",
        json={"preferences": {"invite": True}},
    )

    assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/notifications/unsubscribe/{token}
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_unsubscribe_happy_path(async_client):
    """Valid token → all categories set to FALSE, returns success message."""
    client, mock_conn = async_client
    user_uid = uuid.uuid4()
    mock_conn.fetchrow = AsyncMock(return_value=_make_record(id=user_uid))
    mock_conn.execute = AsyncMock(return_value="OK")

    resp = await client.get(f"/api/notifications/unsubscribe/{UNSUBSCRIBE_TOKEN}")

    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert "unsubscribed" in data["message"].lower()
    # One execute call per category
    assert mock_conn.execute.call_count == len(VALID_CATEGORIES)


@pytest.mark.asyncio
async def test_unsubscribe_invalid_token(async_client):
    """Token not found in DB → 404."""
    client, mock_conn = async_client
    mock_conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get("/api/notifications/unsubscribe/bad-token-value")

    assert resp.status_code == 404
