"""Unit tests for app/services/embeddings_service.py."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
from httpx import Response

import app.services.embeddings_service as emb_mod
from app.services.embeddings_service import (
    _cache,
    _cache_key,
    embed_batch,
    embed_one,
    _embed_with_retry,
)

_FAKE_VEC = [0.1] * 1536
_EMBED_URL = "https://openrouter.ai/api/v1/embeddings"


def _embed_response(texts: list[str]) -> dict:
    return {
        "data": [
            {"index": i, "embedding": _FAKE_VEC}
            for i in range(len(texts))
        ]
    }


@pytest.fixture(autouse=True)
def clear_embed_cache():
    """Isolate each test from the module-level cache."""
    _cache.clear()
    yield
    _cache.clear()


@pytest.fixture(autouse=True)
def set_openrouter_key(monkeypatch):
    monkeypatch.setattr("app.services.embeddings_service.settings.openrouter_api_key", "test-key")
    monkeypatch.setattr("app.services.embeddings_service.settings.embedding_model", "openai/text-embedding-3-small")


# ---------------------------------------------------------------------------
# embed_batch — happy path
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_batch_single_text():
    """embed_batch returns a 1536-dim vector for a single text."""
    with respx.mock:
        respx.post(_EMBED_URL).mock(return_value=Response(200, json=_embed_response(["hello"])))
        result = await embed_batch(["hello"])

    assert len(result) == 1
    assert len(result[0]) == 1536


@pytest.mark.asyncio
async def test_embed_batch_multiple_texts():
    """embed_batch handles multiple texts in one call."""
    texts = ["text one", "text two", "text three"]
    with respx.mock:
        respx.post(_EMBED_URL).mock(return_value=Response(200, json=_embed_response(texts)))
        result = await embed_batch(texts)

    assert len(result) == 3
    assert all(len(v) == 1536 for v in result)


@pytest.mark.asyncio
async def test_embed_batch_empty_text_returns_zero_vector():
    """Empty or whitespace-only strings skip the API and return zero vectors."""
    result = await embed_batch([""])
    assert result[0] == [0.0] * 1536


@pytest.mark.asyncio
async def test_embed_batch_whitespace_returns_zero_vector():
    result = await embed_batch(["   \t\n   "])
    assert result[0] == [0.0] * 1536


# ---------------------------------------------------------------------------
# Cache behaviour
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_batch_cache_hit_skips_api():
    """Second call for same text returns cached result without HTTP call."""
    with respx.mock:
        respx.post(_EMBED_URL).mock(return_value=Response(200, json=_embed_response(["cached text"])))
        first = await embed_batch(["cached text"])

    # Second call — respx is not active, so any HTTP call would raise
    second = await embed_batch(["cached text"])
    assert first == second


@pytest.mark.asyncio
async def test_embed_batch_partial_cache_hit():
    """Only uncached texts are sent to the API; cached texts are served inline."""
    # Pre-populate cache for text A
    _cache[_cache_key("text A")] = _FAKE_VEC

    with respx.mock:
        # API should only be called for "text B"
        respx.post(_EMBED_URL).mock(return_value=Response(200, json=_embed_response(["text B"])))
        result = await embed_batch(["text A", "text B"])

    assert len(result) == 2
    assert result[0] == _FAKE_VEC  # from cache
    assert result[1] == _FAKE_VEC  # from API


# ---------------------------------------------------------------------------
# No API key — zero vectors
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_batch_no_api_key_returns_zero_vectors(monkeypatch):
    monkeypatch.setattr("app.services.embeddings_service.settings.openrouter_api_key", "")
    result = await embed_batch(["some text"])
    assert result == [[0.0] * 1536]


# ---------------------------------------------------------------------------
# embed_one
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_one_returns_single_vector():
    with respx.mock:
        respx.post(_EMBED_URL).mock(return_value=Response(200, json=_embed_response(["single"])))
        vec = await embed_one("single")

    assert len(vec) == 1536


# ---------------------------------------------------------------------------
# _embed_with_retry — 429 backoff
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_with_retry_succeeds_after_429():
    """Retries once on 429 then succeeds on second attempt."""
    import httpx

    call_count = 0

    async def _handler(request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return Response(429, json={"error": "rate limited"})
        return Response(200, json=_embed_response(["retry text"]))

    with respx.mock:
        respx.post(_EMBED_URL).mock(side_effect=_handler)
        async with httpx.AsyncClient() as client:
            with patch("app.services.embeddings_service.asyncio.sleep", new=AsyncMock()):
                result = await _embed_with_retry(
                    client,
                    {"Authorization": "Bearer test-key"},
                    ["retry text"],
                )

    assert call_count == 2
    assert len(result) == 1
    assert len(result[0]) == 1536


@pytest.mark.asyncio
async def test_embed_with_retry_raises_after_max_retries():
    """After _MAX_RETRIES consecutive 429s, raises RuntimeError."""
    import httpx

    with respx.mock:
        respx.post(_EMBED_URL).mock(return_value=Response(429, json={"error": "rate limited"}))
        async with httpx.AsyncClient() as client:
            with patch("app.services.embeddings_service.asyncio.sleep", new=AsyncMock()):
                with pytest.raises(RuntimeError, match="Embedding failed after"):
                    await _embed_with_retry(
                        client,
                        {"Authorization": "Bearer test-key"},
                        ["text"],
                    )


@pytest.mark.asyncio
async def test_embed_with_retry_handles_error_in_200_response():
    """OpenRouter sometimes returns error JSON inside a 200 — should retry."""
    import httpx

    call_count = 0

    async def _handler(request):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            return Response(200, json={"error": {"message": "model overloaded"}})
        return Response(200, json=_embed_response(["text"]))

    with respx.mock:
        respx.post(_EMBED_URL).mock(side_effect=_handler)
        async with httpx.AsyncClient() as client:
            with patch("app.services.embeddings_service.asyncio.sleep", new=AsyncMock()):
                result = await _embed_with_retry(
                    client,
                    {"Authorization": "Bearer test-key"},
                    ["text"],
                )

    assert call_count == 2
    assert len(result[0]) == 1536


# ---------------------------------------------------------------------------
# Batching — _MAX_BATCH boundary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_embed_batch_splits_into_batches():
    """Texts exceeding _MAX_BATCH (20) are split across multiple HTTP requests."""
    import json as _json

    texts = [f"text {i}" for i in range(25)]
    call_count = 0

    async def _handler(request):
        nonlocal call_count
        call_count += 1
        payload = _json.loads(request.content)
        return Response(200, json=_embed_response(payload["input"]))

    with respx.mock:
        respx.post(_EMBED_URL).mock(side_effect=_handler)
        result = await embed_batch(texts)

    assert call_count == 2  # 20 + 5
    assert len(result) == 25
