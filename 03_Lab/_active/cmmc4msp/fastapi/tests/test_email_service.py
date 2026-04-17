"""Tests for app.services.email_service — uses respx to mock Resend HTTP calls."""
from __future__ import annotations

import os
import uuid
from unittest.mock import AsyncMock, MagicMock, call

import pytest
import respx
import httpx

import app.config as _config


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

RESEND_API_URL = "https://api.resend.com/emails"
TEST_KEY = "re_test_123"
RECIPIENT = "user@example.com"
SUBJECT = "Test Subject"
HTML = "<p>Hello</p>"
CATEGORY = "invite"
REF_ID = str(uuid.uuid4())


def _make_record(**data):
    m = MagicMock()
    m.__getitem__ = lambda self, k: data[k]
    m.get = lambda k, d=None: data.get(k, d)
    return m


# ---------------------------------------------------------------------------
# send_email — no key
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_send_email_no_key_returns_no_key(monkeypatch):
    """When resend_api_key is empty, returns 'no-key' without making any HTTP call."""
    monkeypatch.setattr(_config.settings, "resend_api_key", "")

    # Import after monkeypatching settings
    from app.services.email_service import send_email

    with respx.mock:
        result = await send_email(
            to=RECIPIENT,
            subject=SUBJECT,
            html=HTML,
            category=CATEGORY,
        )
        # No HTTP requests should have been made
        assert result == "no-key"
        assert len(respx.calls) == 0


# ---------------------------------------------------------------------------
# send_email — happy path
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_send_email_happy_path(monkeypatch):
    """POST to Resend returns 200 with id, function returns the provider_id."""
    monkeypatch.setattr(_config.settings, "resend_api_key", TEST_KEY)

    from app.services.email_service import send_email

    route = respx.post(RESEND_API_URL).mock(
        return_value=httpx.Response(200, json={"id": "msg_123"})
    )

    result = await send_email(
        to=RECIPIENT,
        subject=SUBJECT,
        html=HTML,
        category=CATEGORY,
    )

    assert result == "msg_123"
    assert route.called
    import json
    body = json.loads(route.calls[0].request.content)
    assert body["to"] == RECIPIENT
    assert body["subject"] == SUBJECT
    assert body["html"] == HTML


# ---------------------------------------------------------------------------
# send_email — logs to DB
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_send_email_logs_to_db(monkeypatch):
    """When conn is provided, conn.execute is called with the email_log INSERT."""
    monkeypatch.setattr(_config.settings, "resend_api_key", TEST_KEY)

    from app.services.email_service import send_email

    respx.post(RESEND_API_URL).mock(
        return_value=httpx.Response(200, json={"id": "msg_abc"})
    )

    mock_conn = AsyncMock()
    mock_conn.execute = AsyncMock(return_value="INSERT 1")

    result = await send_email(
        to=RECIPIENT,
        subject=SUBJECT,
        html=HTML,
        category=CATEGORY,
        reference_id=REF_ID,
        conn=mock_conn,
    )

    assert result == "msg_abc"
    mock_conn.execute.assert_called_once()
    call_args = mock_conn.execute.call_args
    # First positional arg is the SQL string
    sql = call_args[0][0]
    assert "email_log" in sql
    # Check that provider_id was passed
    args = call_args[0]
    assert "msg_abc" in args


# ---------------------------------------------------------------------------
# send_email — no conn skips log
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_send_email_no_conn_skips_log(monkeypatch):
    """When conn=None (default), no DB call is made."""
    monkeypatch.setattr(_config.settings, "resend_api_key", TEST_KEY)

    from app.services.email_service import send_email

    respx.post(RESEND_API_URL).mock(
        return_value=httpx.Response(200, json={"id": "msg_xyz"})
    )

    # No conn passed — should not raise, no DB interaction
    result = await send_email(
        to=RECIPIENT,
        subject=SUBJECT,
        html=HTML,
        category=CATEGORY,
        conn=None,
    )

    assert result == "msg_xyz"


# ---------------------------------------------------------------------------
# send_email — HTTP error raises
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_send_email_http_error_raises(monkeypatch):
    """When Resend returns 422, httpx.HTTPStatusError is raised."""
    monkeypatch.setattr(_config.settings, "resend_api_key", TEST_KEY)

    from app.services.email_service import send_email

    respx.post(RESEND_API_URL).mock(
        return_value=httpx.Response(422, json={"message": "Unprocessable"})
    )

    with pytest.raises(httpx.HTTPStatusError):
        await send_email(
            to=RECIPIENT,
            subject=SUBJECT,
            html=HTML,
            category=CATEGORY,
        )


# ---------------------------------------------------------------------------
# check_preference
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_check_preference_enabled():
    """fetchrow returns a row with enabled=True → returns True."""
    from app.services.email_service import check_preference

    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=_make_record(enabled=True))

    result = await check_preference(str(uuid.uuid4()), "invite", mock_conn)

    assert result is True
    mock_conn.fetchrow.assert_called_once()


@pytest.mark.asyncio
async def test_check_preference_disabled():
    """fetchrow returns a row with enabled=False → returns False."""
    from app.services.email_service import check_preference

    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=_make_record(enabled=False))

    result = await check_preference(str(uuid.uuid4()), "weekly_digest", mock_conn)

    assert result is False


@pytest.mark.asyncio
async def test_check_preference_default_true():
    """fetchrow returns None (no preference row exists) → returns True (default)."""
    from app.services.email_service import check_preference

    mock_conn = AsyncMock()
    mock_conn.fetchrow = AsyncMock(return_value=None)

    result = await check_preference(str(uuid.uuid4()), "assignment", mock_conn)

    assert result is True
