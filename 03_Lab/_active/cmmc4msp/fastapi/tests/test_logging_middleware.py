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


# ---------------------------------------------------------------------------
# 6. PII scrubber — string with no PII passes through unchanged
# ---------------------------------------------------------------------------

def test_scrubber_no_pii_unchanged():
    """_scrub() returns the text unchanged when no PII patterns are present."""
    from app.services.error_events_service import _scrub

    text = "Database connection refused on port 5432"
    assert _scrub(text) == text


# ---------------------------------------------------------------------------
# 7. PII scrubber — multiple Bearer tokens in one string
# ---------------------------------------------------------------------------

def test_scrubber_removes_multiple_bearer_tokens():
    """_scrub() replaces every Bearer token when more than one appears in the string."""
    from app.services.error_events_service import _scrub

    text = "token1=Bearer abc.def.ghi retried with Bearer xyz.123.456"
    result = _scrub(text)
    assert "abc.def.ghi" not in result
    assert "xyz.123.456" not in result
    # Both occurrences replaced
    assert result.count("Bearer ***") == 2


# ---------------------------------------------------------------------------
# 8. PII scrubber — email embedded in a stack trace
# ---------------------------------------------------------------------------

def test_scrubber_removes_email_in_stack_trace():
    """_scrub() removes emails that appear inside multi-line stack-trace strings."""
    from app.services.error_events_service import _scrub

    trace = (
        "Traceback (most recent call last):\n"
        "  File 'auth.py', line 42, in verify\n"
        "    raise AuthError('user bob@secret.io not found')\n"
        "AuthError: user bob@secret.io not found"
    )
    result = _scrub(trace)
    assert "bob@secret.io" not in result
    assert result.count("***@***") == 2


# ---------------------------------------------------------------------------
# 9. error_events_service.record() — invalid UUID for msp_id hits fail-open
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_events_record_invalid_uuid_fail_open():
    """record() returns a fallback UUID when msp_id is not a valid UUID string."""
    from app.services import error_events_service

    mock_conn = AsyncMock()
    # fetchval raises because uuid.UUID("not-a-uuid") throws before even hitting DB
    result = await error_events_service.record(
        mock_conn,
        source="test",
        component="test.component",
        message="Something broke",
        msp_id="not-a-valid-uuid",
    )

    assert isinstance(result, uuid.UUID)


# ---------------------------------------------------------------------------
# 10. error_events_service.record() — pool path (Pool, not Connection)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_error_events_record_uses_pool_acquire():
    """record() acquires a connection from the pool when a Pool is passed."""
    from app.services import error_events_service
    import asyncpg

    event_id = uuid.uuid4()
    mock_conn = AsyncMock()
    mock_conn.fetchval = AsyncMock(return_value=event_id)
    mock_conn.execute = AsyncMock(return_value="OK")

    mock_pool = MagicMock(spec=asyncpg.Pool)
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)

    result = await error_events_service.record(
        mock_pool,
        source="test",
        component="pool.path",
        message="pool branch exercised",
    )

    assert isinstance(result, uuid.UUID)
    assert result == event_id
    mock_pool.acquire.assert_called_once()


# ---------------------------------------------------------------------------
# 11. Exception handler — asyncpg PostgresError → 500 JSON response
#
# BaseHTTPMiddleware re-raises unhandled exceptions before FastAPI's app-level
# handlers can intercept them, so we test the handler functions directly as
# pure callables rather than via the HTTP stack.
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_postgres_exception_handler_returns_500():
    """postgres_exception_handler() returns a 500 JSONResponse."""
    import asyncpg
    from fastapi import FastAPI
    from starlette.testclient import TestClient
    from app.middleware.exception_handlers import register_exception_handlers

    mini_app = FastAPI()
    register_exception_handlers(mini_app)

    @mini_app.get("/pg-boom")
    async def _pg_boom():
        raise asyncpg.exceptions.InternalClientError("simulated pg error")

    # Use sync TestClient here — avoids the BaseHTTPMiddleware re-raise issue
    # because mini_app has NO BaseHTTPMiddleware wrappers.
    with patch("app.services.error_events_service.record", new=AsyncMock()):
        with TestClient(mini_app, raise_server_exceptions=False) as c:
            resp = c.get("/pg-boom")

    assert resp.status_code == 500
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# 12. Exception handler — generic Exception → 500 JSON response
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_generic_exception_handler_returns_500():
    """generic_exception_handler() returns a 500 JSONResponse for bare RuntimeError."""
    from fastapi import FastAPI
    from starlette.testclient import TestClient
    from app.middleware.exception_handlers import register_exception_handlers

    mini_app = FastAPI()
    register_exception_handlers(mini_app)

    @mini_app.get("/generic-boom")
    async def _boom():
        raise RuntimeError("something unexpected")

    with patch("app.services.error_events_service.record", new=AsyncMock()):
        with TestClient(mini_app, raise_server_exceptions=False) as c:
            resp = c.get("/generic-boom")

    assert resp.status_code == 500
    assert "detail" in resp.json()


# ---------------------------------------------------------------------------
# 13. Exception handler — HTTP 404 passes through; record() not called
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_http_404_does_not_call_record():
    """http_exception_handler() for a 404 returns 404 and does NOT call record()."""
    from fastapi import FastAPI, HTTPException
    from starlette.testclient import TestClient
    from app.middleware.exception_handlers import register_exception_handlers

    mini_app = FastAPI()
    register_exception_handlers(mini_app)

    @mini_app.get("/missing")
    async def _missing():
        raise HTTPException(status_code=404, detail="Not found")

    mock_record = AsyncMock()
    with patch("app.services.error_events_service.record", new=mock_record):
        with TestClient(mini_app, raise_server_exceptions=False) as c:
            resp = c.get("/missing")

    assert resp.status_code == 404
    mock_record.assert_not_called()


# ---------------------------------------------------------------------------
# 14. /health degraded state — one component down → status='down'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_one_component_down_reports_down(async_client):
    """GET /health with postgres failing returns status='down'."""
    client, conn = async_client
    # Postgres check uses pool.acquire; simulate failure there
    conn.fetchval = AsyncMock(side_effect=Exception("connection refused"))

    def _failing_pool_acquire():
        cm = MagicMock()
        cm.__aenter__ = AsyncMock(side_effect=Exception("connection refused"))
        cm.__aexit__ = AsyncMock(return_value=False)
        return cm

    from main import app as fastapi_app
    original_pool = fastapi_app.state.pool
    failing_pool = MagicMock()
    failing_pool.acquire = MagicMock(side_effect=_failing_pool_acquire)
    fastapi_app.state.pool = failing_pool

    try:
        with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
             patch("main.aioredis.from_url", return_value=_mock_redis()):
            resp = await client.get("/health")
    finally:
        fastapi_app.state.pool = original_pool

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "down"
    assert body["components"]["postgres"] == "down"


# ---------------------------------------------------------------------------
# 15. /health degraded state — n8n degraded → status='degraded'
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_health_degraded_when_n8n_degraded(async_client):
    """GET /health with n8n returning 500 reports status='degraded' (not 'down')."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(500)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    # n8n returns 500 → "degraded"; openrouter also uses same mock → "degraded"
    # No component is "down", so overall status must be "degraded"
    assert body["status"] == "degraded"
    assert body["components"]["n8n"] == "degraded"
