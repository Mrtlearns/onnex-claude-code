"""Tests for app.services.authentik_service — uses respx to mock httpx."""
from __future__ import annotations

import os
import uuid

# Set env vars BEFORE any app import
os.environ["AUTHENTIK_URL"] = "https://auth.test"
os.environ["AUTHENTIK_API_TOKEN"] = "test-token"

import pytest
import respx
import httpx

from app.services.authentik_service import (
    AuthentikError,
    create_user,
    get_user_by_email,
)
import app.services.authentik_service as _svc


# ---------------------------------------------------------------------------
# Helpers — patch settings so tests don't rely on global env state
# ---------------------------------------------------------------------------

BASE = "https://auth.test"
USERS_URL = f"{BASE}/api/v3/core/users/"
FAKE_PK = str(uuid.uuid4())


def _patch_settings(monkeypatch):
    """Ensure settings object has the test values."""
    monkeypatch.setattr(_svc.settings, "authentik_url", BASE)
    monkeypatch.setattr(_svc.settings, "authentik_api_token", "test-token")


# ---------------------------------------------------------------------------
# create_user — happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_create_user_happy_path(monkeypatch):
    """create_user returns Authentik PK on 201 create + 204 set_password."""
    _patch_settings(monkeypatch)

    respx.post(USERS_URL).mock(
        return_value=httpx.Response(201, json={"pk": FAKE_PK, "username": "testuser"})
    )
    respx.post(f"{BASE}/api/v3/core/users/{FAKE_PK}/set_password/").mock(
        return_value=httpx.Response(204)
    )

    pk = await create_user(email="test@example.com", full_name="Test User", password="Str0ng!")
    assert pk == FAKE_PK


# ---------------------------------------------------------------------------
# create_user — username collision retry
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_create_user_username_collision_retry(monkeypatch):
    """First POST returns 400 username collision; second POST returns 201."""
    _patch_settings(monkeypatch)

    call_count = 0

    def _post_side_effect(request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return httpx.Response(400, json={"username": ["already exists"]})
        return httpx.Response(201, json={"pk": FAKE_PK, "username": "testuser_abc123"})

    respx.post(USERS_URL).mock(side_effect=_post_side_effect)
    respx.post(f"{BASE}/api/v3/core/users/{FAKE_PK}/set_password/").mock(
        return_value=httpx.Response(204)
    )

    pk = await create_user(email="test@example.com", full_name="Test User", password="Str0ng!")
    assert pk == FAKE_PK
    assert call_count == 2


# ---------------------------------------------------------------------------
# create_user — non-400 failure raises AuthentikError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_create_user_server_error_raises(monkeypatch):
    """Non-400 error on user creation raises AuthentikError."""
    _patch_settings(monkeypatch)

    respx.post(USERS_URL).mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    with pytest.raises(AuthentikError, match="HTTP 500"):
        await create_user(email="fail@example.com", full_name="Fail User", password="pw")


# ---------------------------------------------------------------------------
# create_user — password set fails → rollback DELETE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_create_user_password_fail_deletes_user(monkeypatch):
    """If set_password fails, the user is deleted and AuthentikError raised."""
    _patch_settings(monkeypatch)

    respx.post(USERS_URL).mock(
        return_value=httpx.Response(201, json={"pk": FAKE_PK, "username": "testuser"})
    )
    respx.post(f"{BASE}/api/v3/core/users/{FAKE_PK}/set_password/").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )
    delete_route = respx.delete(f"{BASE}/api/v3/core/users/{FAKE_PK}/").mock(
        return_value=httpx.Response(204)
    )

    with pytest.raises(AuthentikError, match="set password"):
        await create_user(email="test@example.com", full_name="Test User", password="pw")

    assert delete_route.called


# ---------------------------------------------------------------------------
# get_user_by_email — happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_get_user_by_email_happy_path(monkeypatch):
    """get_user_by_email returns user dict when found."""
    _patch_settings(monkeypatch)

    user_data = {
        "pk": FAKE_PK,
        "username": "john_doe",
        "email": "john@example.com",
        "name": "John Doe",
    }
    respx.get(USERS_URL).mock(
        return_value=httpx.Response(200, json={"results": [user_data]})
    )

    result = await get_user_by_email("john@example.com")
    assert result is not None
    assert result["pk"] == FAKE_PK


# ---------------------------------------------------------------------------
# get_user_by_email — 404 returns None
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_get_user_by_email_not_found_returns_none(monkeypatch):
    """get_user_by_email returns None when no matching user found."""
    _patch_settings(monkeypatch)

    respx.get(USERS_URL).mock(
        return_value=httpx.Response(200, json={"results": []})
    )

    result = await get_user_by_email("nobody@example.com")
    assert result is None


@pytest.mark.asyncio
@respx.mock
async def test_get_user_by_email_api_error_returns_none(monkeypatch):
    """get_user_by_email returns None when Authentik returns non-200."""
    _patch_settings(monkeypatch)

    respx.get(USERS_URL).mock(
        return_value=httpx.Response(404)
    )

    result = await get_user_by_email("ghost@example.com")
    assert result is None


# ---------------------------------------------------------------------------
# create_user — not configured raises AuthentikError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_user_not_configured_raises(monkeypatch):
    """create_user raises AuthentikError when settings are empty."""
    monkeypatch.setattr(_svc.settings, "authentik_url", "")
    monkeypatch.setattr(_svc.settings, "authentik_api_token", "")

    with pytest.raises(AuthentikError, match="not configured"):
        await create_user(email="x@x.com", full_name="X", password="pw")
