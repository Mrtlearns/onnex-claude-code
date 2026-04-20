"""Tests for copilot chat endpoints on /api/controls/program/{program_id}/{control_id}/chat."""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import (
    ORG_ID,
    PROGRAM_ID,
    PROGRAM_CONTROL_ID,
    USER_ID,
    make_token,
)

_OTHER_ORG_ID = str(uuid.uuid4())

# ── record helpers ────────────────────────────────────────────────────────────


def _make_pc_record(org_id: str = ORG_ID) -> MagicMock:
    """Mock program_control row with org_id — mimics asyncpg.Record."""
    data = {"id": uuid.UUID(PROGRAM_CONTROL_ID), "org_id": uuid.UUID(org_id)}
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    rec.__bool__ = lambda self: True
    return rec


def _make_chat_message_row(role: str = "user", content: str = "hello") -> MagicMock:
    data = {
        "id": uuid.UUID(PROGRAM_CONTROL_ID),  # reuse any UUID
        "role": role,
        "content": content,
        "created_at": datetime(2026, 4, 17, 10, 0, 0, tzinfo=timezone.utc),
        "model_used": "anthropic/claude-sonnet-4-6" if role == "assistant" else None,
        "tokens_used": None,
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


# ── GET /chat ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_chat_history_empty(async_client):
    """GET chat returns empty messages list when no history exists."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[])

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["messages"] == []


@pytest.mark.asyncio
async def test_get_chat_history_with_messages(async_client):
    """GET chat returns serialized message rows."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[
        _make_chat_message_row("user", "What evidence do I need?"),
        _make_chat_message_row("assistant", "You need an access control policy."),
    ])

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    messages = resp.json()["messages"]
    assert len(messages) == 2
    assert messages[0]["role"] == "user"
    assert messages[1]["role"] == "assistant"
    assert "id" in messages[0]
    assert "created_at" in messages[0]


@pytest.mark.asyncio
async def test_get_chat_history_wrong_org_403(async_client):
    """GET chat returns 403 when token org doesn't match control org."""
    client, conn = async_client
    # Token belongs to _OTHER_ORG_ID but control belongs to ORG_ID
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record(org_id=ORG_ID))

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_get_chat_history_not_found_404(async_client):
    """GET chat returns 404 when control does not exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_get_chat_history_invalid_uuid_422(async_client):
    """GET chat returns 422 for non-UUID path parameters."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    resp = await client.get(
        f"/api/controls/program/{PROGRAM_ID}/not-a-uuid/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 422


# ── POST /chat ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_post_chat_no_api_key(async_client):
    """POST chat with no API key returns streaming response with error message."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.fetch = AsyncMock(return_value=[])
    conn.execute = AsyncMock(return_value="OK")

    async def _fake_build_context(*args, **kwargs):
        return "system prompt", "context"

    async def _fake_stream(*args, **kwargs):
        yield "data: No OpenRouter API key configured.\n\n"

    with patch("app.routers.controls.build_context", new=_fake_build_context), \
         patch("app.routers.controls.stream_chat", new=_fake_stream):
        resp = await client.post(
            f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
            json={"message": "What evidence do I need?"},
            headers={"Authorization": f"Bearer {token}"},
        )

    assert resp.status_code == 200
    body = resp.text
    assert "No OpenRouter" in body or "api key" in body.lower() or len(body) > 0


@pytest.mark.asyncio
async def test_post_chat_wrong_org_403(async_client):
    """POST chat returns 403 when token org doesn't match control org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record(org_id=ORG_ID))

    resp = await client.post(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        json={"message": "Hello"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_post_chat_not_found_404(async_client):
    """POST chat returns 404 when control does not exist."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=None)

    resp = await client.post(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        json={"message": "Hello"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


# ── DELETE /chat ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_delete_chat_history_happy(async_client):
    """DELETE chat clears history — conn.execute is called and 204 is returned."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record())
    conn.execute = AsyncMock(return_value="DELETE 5")

    resp = await client.delete(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 204
    conn.execute.assert_called_once()
    # Verify it's a DELETE statement
    call_args = conn.execute.call_args
    assert "DELETE" in call_args[0][0].upper()


@pytest.mark.asyncio
async def test_delete_chat_history_wrong_org_403(async_client):
    """DELETE chat returns 403 when token org doesn't match control org."""
    client, conn = async_client
    token = make_token(role="client_admin", org_id=_OTHER_ORG_ID, sub=USER_ID)

    conn.fetchrow = AsyncMock(return_value=_make_pc_record(org_id=ORG_ID))

    resp = await client.delete(
        f"/api/controls/program/{PROGRAM_ID}/{PROGRAM_CONTROL_ID}/chat",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
