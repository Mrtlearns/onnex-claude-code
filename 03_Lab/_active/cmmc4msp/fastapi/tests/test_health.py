"""Smoke test for the /health endpoint."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest


def _mock_httpx_client(status_code: int = 200):
    """Return a mock httpx.AsyncClient context manager that returns a given status."""
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


@pytest.mark.asyncio
async def test_health_ok_when_db_up(async_client):
    """GET /health should return 200 with postgres=up when DB responds."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert "components" in body
    assert body["components"]["postgres"] == "up"


@pytest.mark.asyncio
async def test_health_postgres_down_when_db_fails(async_client):
    """When DB raises, components.postgres == 'down' and overall status is not 'ok'."""
    client, conn = async_client
    conn.fetchval = AsyncMock(side_effect=ConnectionRefusedError("DB offline"))

    with patch("main.httpx.AsyncClient", return_value=_mock_httpx_client(200)), \
         patch("main.aioredis.from_url", return_value=_mock_redis()):
        resp = await client.get("/health")

    assert resp.status_code == 200
    body = resp.json()
    assert body["components"]["postgres"] == "down"
    assert body["status"] in ("degraded", "down")
