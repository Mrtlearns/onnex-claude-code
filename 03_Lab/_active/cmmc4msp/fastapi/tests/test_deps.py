"""Unit tests for auth dependencies."""
from __future__ import annotations

import pytest
from fastapi import HTTPException
from jose import jwt

from app.deps import (
    get_current_user,
    require_client_admin_or_above,
    require_msp_admin,
    require_same_org,
)

JWT_SECRET = "test-secret"
ALGORITHM = "HS256"


def _token(role: str, org_id: str = "org-1", sub: str = "user-1") -> str:
    return jwt.encode({"sub": sub, "org_id": org_id, "role": role}, JWT_SECRET, algorithm=ALGORITHM)


@pytest.mark.asyncio
async def test_get_current_user_valid_token(monkeypatch):
    """get_current_user should decode a valid JWT and return user dict."""
    import app.deps as deps_module
    monkeypatch.setattr(deps_module, "JWT_SECRET", JWT_SECRET)

    token = _token("msp_admin", "org-123")
    user = await get_current_user(token)

    assert user["role"] == "msp_admin"
    assert user["org_id"] == "org-123"
    assert user["user_id"] == "user-1"


@pytest.mark.asyncio
async def test_get_current_user_no_token():
    """get_current_user without a token should raise 401."""
    with pytest.raises(HTTPException) as exc:
        await get_current_user(None)
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_invalid_token(monkeypatch):
    """get_current_user with a bad token should raise 401."""
    import app.deps as deps_module
    monkeypatch.setattr(deps_module, "JWT_SECRET", JWT_SECRET)

    with pytest.raises(HTTPException) as exc:
        await get_current_user("not.a.valid.jwt")
    assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_msp_admin_allows_msp_admin():
    user = {"role": "msp_admin", "org_id": "x", "user_id": "1"}
    result = await require_msp_admin(user)
    assert result["role"] == "msp_admin"


@pytest.mark.asyncio
async def test_require_msp_admin_blocks_client_admin():
    user = {"role": "client_admin", "org_id": "x", "user_id": "1"}
    with pytest.raises(HTTPException) as exc:
        await require_msp_admin(user)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_client_admin_or_above_allows_client_admin():
    user = {"role": "client_admin", "org_id": "x", "user_id": "1"}
    result = await require_client_admin_or_above(user)
    assert result["role"] == "client_admin"


@pytest.mark.asyncio
async def test_require_client_admin_or_above_blocks_viewer():
    user = {"role": "viewer", "org_id": "x", "user_id": "1"}
    with pytest.raises(HTTPException) as exc:
        await require_client_admin_or_above(user)
    assert exc.value.status_code == 403


def test_require_same_org_passes_for_msp_admin():
    """MSP admin can access any org."""
    user = {"role": "msp_admin", "org_id": "org-A"}
    # Should not raise
    require_same_org("org-B", user)


def test_require_same_org_passes_for_matching_org():
    user = {"role": "client_admin", "org_id": "org-A"}
    require_same_org("org-A", user)


def test_require_same_org_blocks_wrong_org():
    user = {"role": "client_admin", "org_id": "org-A"}
    with pytest.raises(HTTPException) as exc:
        require_same_org("org-B", user)
    assert exc.value.status_code == 403
