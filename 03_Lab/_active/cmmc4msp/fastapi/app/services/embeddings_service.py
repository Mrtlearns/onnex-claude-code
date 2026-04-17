"""OpenRouter text embedding service with SHA-256 in-process cache.

Uses openai/text-embedding-3-small (1536 dims) via OpenRouter's embeddings endpoint.
Batches up to 100 texts per request. Exponential backoff on 429.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from functools import lru_cache

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_OPENROUTER_EMBED_URL = "https://openrouter.ai/api/v1/embeddings"
_MAX_BATCH = 20
_MAX_RETRIES = 4

# Simple in-process LRU cache keyed by SHA256(text)
_cache: dict[str, list[float]] = {}
_MAX_CACHE = 10_000


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _cache_get(text: str) -> list[float] | None:
    return _cache.get(_cache_key(text))


def _cache_set(text: str, vec: list[float]) -> None:
    if len(_cache) >= _MAX_CACHE:
        # Evict oldest 10%
        keys = list(_cache.keys())[:_MAX_CACHE // 10]
        for k in keys:
            _cache.pop(k, None)
    _cache[_cache_key(text)] = vec


async def embed_batch(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts. Returns a parallel list of 1536-dim vectors.

    Cached hits are served without network calls.
    Remaining texts are embedded in batches of 100 with retry on 429.
    """
    if not settings.openrouter_api_key:
        logger.warning("OPENROUTER_API_KEY not set — returning zero vectors")
        return [[0.0] * 1536 for _ in texts]

    results: list[list[float] | None] = [None] * len(texts)
    uncached_indices: list[int] = []

    for i, text in enumerate(texts):
        if not text or not text.strip():
            results[i] = [0.0] * 1536
            continue
        cached = _cache_get(text)
        if cached:
            results[i] = cached
        else:
            uncached_indices.append(i)

    if not uncached_indices:
        return results  # type: ignore[return-value]

    uncached_texts = [texts[i] for i in uncached_indices]

    headers = {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
    }

    embeddings: list[list[float]] = []
    async with httpx.AsyncClient(timeout=60) as client:
        for batch_start in range(0, len(uncached_texts), _MAX_BATCH):
            batch = uncached_texts[batch_start : batch_start + _MAX_BATCH]
            vec_batch = await _embed_with_retry(client, headers, batch)
            embeddings.extend(vec_batch)

    for idx, original_i in enumerate(uncached_indices):
        vec = embeddings[idx]
        results[original_i] = vec
        _cache_set(texts[original_i], vec)

    return results  # type: ignore[return-value]


async def embed_one(text: str) -> list[float]:
    """Embed a single text."""
    results = await embed_batch([text])
    return results[0]


async def _embed_with_retry(
    client: httpx.AsyncClient,
    headers: dict,
    batch: list[str],
) -> list[list[float]]:
    delay = 1.0
    for attempt in range(_MAX_RETRIES):
        try:
            resp = await client.post(
                _OPENROUTER_EMBED_URL,
                headers=headers,
                json={"model": settings.embedding_model, "input": batch},
            )
            if resp.status_code == 429:
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            resp.raise_for_status()
            data = resp.json()
            # Handle error embedded in 200 response (OpenRouter edge case)
            if "error" in data:
                err_msg = data["error"].get("message", str(data["error"]))
                logger.warning("OpenRouter embedding error in 200 response (attempt %d): %s", attempt + 1, err_msg)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            if "data" not in data:
                logger.warning("Unexpected OpenRouter response (attempt %d): keys=%s", attempt + 1, list(data.keys()))
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)
                continue
            # OpenAI-compatible response: {"data": [{"embedding": [...], "index": i}]}
            items = sorted(data["data"], key=lambda x: x["index"])
            return [item["embedding"] for item in items]
        except httpx.HTTPStatusError as exc:
            if attempt == _MAX_RETRIES - 1:
                raise
            logger.warning("Embedding batch failed (attempt %d): %s", attempt + 1, exc)
            await asyncio.sleep(delay)
            delay = min(delay * 2, 30)

    raise RuntimeError(f"Embedding failed after {_MAX_RETRIES} attempts")
