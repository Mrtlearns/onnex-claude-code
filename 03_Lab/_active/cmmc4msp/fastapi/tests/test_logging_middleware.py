"""Tests for logging infrastructure: middleware, correlation IDs, error_events_service, PII scrubber."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _mock_httpx_client(status_code: int = 200):
    """Return a mock httpx.AsyncClient context manager."""
    mock_response = MagicMock()
    mock_response.status_code = status_code
    mock_client = MagicMock()
    mock_client.get = AsyncMock(return_value=mock_response)
    cm = MagicMock()
    cm.__aenter__ = AsyncMock(return_value=mock_client)
    cm.__aexit__ = AsyncMock(return_value=False)
    return cm


def _mock_redis():
    mock = AsyncMock()
    mock.ping = AsyncMock(return_value=True)
    mock.aclose = AsyncMock()
    return mock


# ---------------------------------------------------------------------------
# 1. GET /health returns 200 with components dict containing "postgres"
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_returns_components_with_postgres(async_client):
    """GET /health returns 200 with a components dict that includes 'postgres'."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert "components" in body
    assert "postgres" in body["components"]


# ---------------------------------------------------------------------------
# 2. Response has X-Correlation-ID header
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_response_has_correlation_id_header(async_client):
    """Every response includes an X-Correlation-ID header."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health")

    assert "x-correlation-id" in resp.headers
    cid = resp.headers["x-correlation-id"]
    # Must be a valid UUID
    uuid.UUID(cid)


# ---------------------------------------------------------------------------
# 3. Provided X-Correlation-ID is echoed back
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_provided_correlation_id_is_echoed(async_client):
    """If the client sends X-Correlation-ID, the same value is returned in the response."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    my_cid = str(uuid.uuid4())

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health", headers={"X-Correlation-ID": my_cid})

    assert resp.headers.get("x-correlation-id") == my_cid


# ---------------------------------------------------------------------------
# 4. error_events_service.record() returns a UUID (mocked DB)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_events_record_returns_uuid():
    """error_events_service.record() returns a UUID when DB call succeeds."""
    from app.services import error_events_service

    event_id = uuid.uuid4()
    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(return_value=event_id)
    mock_conn.execute = AsyncMock(return_value="OK")

    result = await error_events_service.record(
        mock_conn,
        source="test",
        component="test.component",
        message="Something went wrong",
        severity="error",
    )

    assert isinstance(result, uuid.UUID)


@pytest.mark.asyncio
async def test_error_events_record_returns_uuid_on_db_failure():
    """error_events_service.record() returns a fallback UUID when the DB insert fails."""
    from app.services import error_events_service

    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(side_effect=Exception("DB offline"))

    result = await error_events_service.record(
        mock_conn,
        source="test",
        component="test.component",
        message="Something went wrong",
    )

    assert isinstance(result, uuid.UUID)


# ---------------------------------------------------------------------------
# 5. PII scrubber removes Bearer tokens and emails from stack traces
# ---------------------------------------------------------------------------

def test_scrubber_removes_bearer_token():
    """_scrub() replaces Bearer tokens with Bearer ***."""
    from app.services.error_events_service import _scrub

    text = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def"
    result = _scrub(text)
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in result
    assert "Bearer ***" in result


def test_scrubber_removes_email():
    """_scrub() replaces email addresses with ***@***."""
    from app.services.error_events_service import _scrub

    text = "User john.doe@example.com triggered an error"
    result = _scrub(text)
    assert "john.doe@example.com" not in result
    assert "***@***" in result


def test_scrubber_handles_none():
    """_scrub() returns None when given None."""
    from app.services.error_events_service import _scrub

    assert _scrub(None) is None


def test_scrubber_handles_empty_string():
    """_scrub() returns the input unchanged when given an empty string."""
    from app.services.error_events_service import _scrub

    assert _scrub("") == ""


def test_scrubber_removes_multiple_pii():
    """_scrub() removes both Bearer token and email in the same string."""
    from app.services.error_events_service import _scrub

    text = "Bearer abc123 from user admin@company.org failed"
    result = _scrub(text)
    assert "abc123" not in result
    assert "admin@company.org" not in result
    assert "Bearer ***" in result
    assert "***@***" in result
