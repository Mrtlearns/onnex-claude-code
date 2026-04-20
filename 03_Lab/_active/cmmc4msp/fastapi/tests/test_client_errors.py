"""Tests for POST /api/client-errors router.

RED phase: these tests define the contract. They will fail until the router
and in-memory rate limiter are implemented.
"""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, patch

from tests.conftest import make_token


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

VALID_PAYLOAD = {
    "message": "TypeError: Cannot read properties of null",
    "stack": "TypeError: ...\n  at Component (app.js:12)",
    "component_stack": "  at ErrorBoundary\n  at Layout",
    "route": "/acme/dashboard",
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "component": "global-error",
}


# ---------------------------------------------------------------------------
# POST /api/client-errors — unauthenticated (error on login page use-case)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_error_full_payload_returns_202(async_client):
    """Full payload from authenticated or unauthenticated client → 202."""
    client, _ = async_client
    with patch(
        "app.routers.client_errors.error_events_service.record",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post("/api/client-errors", json=VALID_PAYLOAD)
    assert resp.status_code == 202
    assert resp.json() == {"status": "recorded"}


@pytest.mark.asyncio
async def test_client_error_minimal_payload_returns_202(async_client):
    """Only `message` is required — all other fields are optional."""
    client, _ = async_client
    with patch(
        "app.routers.client_errors.error_events_service.record",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post("/api/client-errors", json={"message": "boom"})
    assert resp.status_code == 202


@pytest.mark.asyncio
async def test_client_error_missing_message_returns_422(async_client):
    """Payload without `message` should fail schema validation."""
    client, _ = async_client
    resp = await client.post("/api/client-errors", json={"stack": "trace"})
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# service call verification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_error_calls_record_with_nextjs_source(async_client):
    """error_events_service.record must be called with source='nextjs'."""
    client, _ = async_client
    mock_record = AsyncMock(return_value=None)
    with patch("app.routers.client_errors.error_events_service.record", new=mock_record):
        await client.post("/api/client-errors", json=VALID_PAYLOAD)

    mock_record.assert_called_once()
    call_kwargs = mock_record.call_args.kwargs
    assert call_kwargs["source"] == "nextjs"
    assert call_kwargs["severity"] == "error"
    assert "TypeError" in call_kwargs["message"]


# ---------------------------------------------------------------------------
# rate limiting
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_error_rate_limit_11th_request_is_429(async_client):
    """IP-based rate limit: first 10 → 202, 11th → 429."""
    client, _ = async_client

    # Reset the in-memory store between test runs by patching it fresh.
    # The router uses a module-level dict; we patch it to a fresh dict.
    import app.routers.client_errors as ce_module
    original_store = ce_module._rate_store
    ce_module._rate_store = {}

    try:
        mock_record = AsyncMock(return_value=None)
        with patch("app.routers.client_errors.error_events_service.record", new=mock_record):
            for i in range(10):
                r = await client.post("/api/client-errors", json={"message": f"err {i}"})
                assert r.status_code == 202, f"Request {i+1} should be 202, got {r.status_code}"

            eleventh = await client.post("/api/client-errors", json={"message": "err 11"})
            assert eleventh.status_code == 429
    finally:
        ce_module._rate_store = original_store


# ---------------------------------------------------------------------------
# unauthenticated request accepted — explicit no-401 assertion
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_error_no_auth_header_not_401(async_client):
    """POST /api/client-errors with no Authorization header must NOT return 401."""
    client, _ = async_client
    with patch(
        "app.routers.client_errors.error_events_service.record",
        new=AsyncMock(return_value=None),
    ):
        resp = await client.post("/api/client-errors", json={"message": "login page crash"})

    assert resp.status_code != 401
    assert resp.status_code == 202


# ---------------------------------------------------------------------------
# very long message is truncated before record() is called
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_client_error_long_message_truncated(async_client):
    """message > 2000 chars is sliced to 2000 before being passed to record()."""
    client, _ = async_client

    long_msg = "x" * 5000
    mock_record = AsyncMock(return_value=None)

    with patch("app.routers.client_errors.error_events_service.record", new=mock_record):
        resp = await client.post("/api/client-errors", json={"message": long_msg})

    assert resp.status_code == 202
    mock_record.assert_called_once()
    passed_message = mock_record.call_args.kwargs["message"]
    assert len(passed_message) == 2000
    assert passed_message == "x" * 2000
