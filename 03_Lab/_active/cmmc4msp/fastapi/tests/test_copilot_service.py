"""Unit tests for app/services/copilot_service.py — RED first, then GREEN."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch, call
from uuid import UUID

import pytest

from tests.conftest import ORG_ID, PROGRAM_CONTROL_ID, USER_ID

# ── helpers ──────────────────────────────────────────────────────────────────

_NIST_ID = "3.1.1"


def _make_control_row(nist_id: str = _NIST_ID, org_name: str = "Acme Corp") -> MagicMock:
    data = {
        "nist_id": nist_id,
        "requirement_text": "Limit system access to authorized users.",
        "assessment_objective": "Determine if authorized users are the only ones with access.",
        "acceptable_proof_guidance": "User access list, AD group policy.",
        "status": "not_implemented",
        "implementation_notes": "We use AD for all user management.",
        "program_name": "CMMC Program",
        "org_name": org_name,
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    # Make it truthy (not None)
    rec.__bool__ = lambda self: True
    return rec


def _make_artifact_row() -> MagicMock:
    data = {
        "id": UUID(USER_ID),  # reuse a known UUID
        "file_name": "access_policy.pdf",
        "verdict": "pass",
        "rationale": "Clearly documents the access control policy.",
        "gaps_noted": "Missing MFA enforcement.",
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_nist_chunk_row() -> MagicMock:
    data = {
        "chunk_text": "3.1.1 requires limiting system access to authorized users only.",
        "section": "Discussion",
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


def _make_similar_chunk_row() -> MagicMock:
    data = {
        "chunk_text": "Our AD policy was last updated in 2024.",
        "file_name": "it_policy.pdf",
        "artifact_id": UUID(USER_ID),
    }
    rec = MagicMock()
    rec.__getitem__ = lambda self, k: data[k]
    rec.get = lambda k, d=None: data.get(k, d)
    return rec


# ── build_context tests ───────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_build_context_returns_system_prompt():
    """
    When all DB lookups return data, build_context should return a non-empty
    system prompt containing the nist_id and org_name.
    """
    from app.services.copilot_service import build_context

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=_make_control_row())
    conn.fetch = AsyncMock(return_value=[])  # no artifacts, no nist chunks

    with patch("app.services.copilot_service.embed_one", new=AsyncMock(return_value=[0.0] * 1536)):
        system_prompt, context_text = await build_context(
            UUID(PROGRAM_CONTROL_ID),
            "What evidence do I need?",
            ORG_ID,
            conn,
        )

    assert _NIST_ID in system_prompt
    assert "Acme Corp" in system_prompt
    assert len(system_prompt) > 100


@pytest.mark.asyncio
async def test_build_context_control_not_found():
    """When the control row is None, build_context returns ('', '')."""
    from app.services.copilot_service import build_context

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    system_prompt, context_text = await build_context(
        UUID(PROGRAM_CONTROL_ID),
        "What evidence do I need?",
        ORG_ID,
        conn,
    )

    assert system_prompt == ""
    assert context_text == ""


@pytest.mark.asyncio
async def test_build_context_skips_similar_chunks_when_zero_embedding():
    """
    When embed_one returns all-zeros (no API key), the vector similarity query
    should NOT be executed to avoid zero-vector cosine issues.
    """
    from app.services.copilot_service import build_context

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=_make_control_row())

    # fetch is called for artifacts (call 1) and nist_chunks (call 2)
    # but NOT for similar_chunks when embedding is zero
    conn.fetch = AsyncMock(return_value=[])

    with patch("app.services.copilot_service.embed_one", new=AsyncMock(return_value=[0.0] * 1536)):
        await build_context(
            UUID(PROGRAM_CONTROL_ID),
            "What evidence do I need?",
            ORG_ID,
            conn,
        )

    # Should be called twice (artifacts + nist_chunks), not three times
    assert conn.fetch.call_count == 2


@pytest.mark.asyncio
async def test_build_context_includes_artifacts():
    """When artifacts are present, context_text should include the file name."""
    from app.services.copilot_service import build_context

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=_make_control_row())
    # fetch: call 1 = artifacts (returns one row), call 2 = nist_chunks (empty)
    conn.fetch = AsyncMock(side_effect=[
        [_make_artifact_row()],
        [],
    ])

    with patch("app.services.copilot_service.embed_one", new=AsyncMock(return_value=[0.0] * 1536)):
        _, context_text = await build_context(
            UUID(PROGRAM_CONTROL_ID),
            "What evidence do I need?",
            ORG_ID,
            conn,
        )

    assert "access_policy.pdf" in context_text


@pytest.mark.asyncio
async def test_build_context_includes_nist_chunks():
    """When NIST chunks are present, context_text should include NIST guidance."""
    from app.services.copilot_service import build_context

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=_make_control_row())
    # fetch: call 1 = artifacts (empty), call 2 = nist_chunks (returns one row)
    conn.fetch = AsyncMock(side_effect=[
        [],
        [_make_nist_chunk_row()],
    ])

    with patch("app.services.copilot_service.embed_one", new=AsyncMock(return_value=[0.0] * 1536)):
        _, context_text = await build_context(
            UUID(PROGRAM_CONTROL_ID),
            "What evidence do I need?",
            ORG_ID,
            conn,
        )

    assert "NIST SP 800-171A" in context_text
    assert "3.1.1 requires" in context_text


# ── stream_chat tests ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_stream_chat_no_api_key():
    """When openrouter_api_key is empty, stream_chat yields an error chunk immediately."""
    from app.services.copilot_service import stream_chat

    with patch("app.services.copilot_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = ""

        chunks = []
        async for chunk in stream_chat("system", [], "hello"):
            chunks.append(chunk)

    assert len(chunks) >= 1
    # Should contain some error indication
    combined = "".join(chunks)
    assert "No OpenRouter" in combined or "not configured" in combined.lower() or "api key" in combined.lower()


@pytest.mark.asyncio
async def test_stream_chat_yields_content():
    """stream_chat yields SSE-formatted content chunks from OpenRouter."""
    import respx
    from httpx import Response
    from app.services.copilot_service import stream_chat, OPENROUTER_URL

    sse_body = (
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'
        'data: {"choices":[{"delta":{"content":" world"}}]}\n\n'
        "data: [DONE]\n\n"
    )

    with patch("app.services.copilot_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = "test-key"

        with respx.mock:
            respx.post(OPENROUTER_URL).mock(
                return_value=Response(200, text=sse_body)
            )
            chunks = []
            async for chunk in stream_chat("system", [], "hello"):
                chunks.append(chunk)

    content_chunks = [c for c in chunks if '"content"' in c]
    assert len(content_chunks) >= 2
    combined_content = "".join(
        json.loads(c[6:])["content"]
        for c in content_chunks
        if c.startswith("data: ")
    )
    assert "Hello" in combined_content
    assert "world" in combined_content


@pytest.mark.asyncio
async def test_stream_chat_handles_done():
    """When [DONE] is received from OpenRouter, iteration stops cleanly."""
    import respx
    from httpx import Response
    from app.services.copilot_service import stream_chat, OPENROUTER_URL

    sse_body = (
        'data: {"choices":[{"delta":{"content":"Stop here"}}]}\n\n'
        "data: [DONE]\n\n"
        # Anything after DONE should NOT be yielded
        'data: {"choices":[{"delta":{"content":"Should not appear"}}]}\n\n'
    )

    with patch("app.services.copilot_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = "test-key"

        with respx.mock:
            respx.post(OPENROUTER_URL).mock(
                return_value=Response(200, text=sse_body)
            )
            chunks = []
            async for chunk in stream_chat("system", [], "hello"):
                chunks.append(chunk)

    # [DONE] should be the last meaningful chunk; "Should not appear" must not be present
    combined = "".join(chunks)
    assert "Should not appear" not in combined
    assert "[DONE]" in combined
