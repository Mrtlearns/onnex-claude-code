"""Smoke test for the /health endpoint."""
from __future__ import annotations

from unittest.mock import AsyncMock

import pytest


@pytest.mark.asyncio
async def test_health_ok_when_db_up(async_client):
    """GET /health should return status=ok when DB responds."""
    client, conn = async_client
    conn.fetchval = AsyncMock(return_value=1)

    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["db"] == "up"


@pytest.mark.asyncio
async def test_health_degraded_when_db_down(async_client):
    """GET /health should return status=degraded when DB is unreachable."""
    client, conn = async_client
    conn.fetchval = AsyncMock(side_effect=ConnectionRefusedError("DB offline"))

    resp = await client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "degraded"
    assert body["db"] == "down"
