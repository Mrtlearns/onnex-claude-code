"""
Test fixtures — uses httpx AsyncClient with a mocked DB pool and MinIO client.
No live PostgreSQL or MinIO required for unit tests.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

# Set env vars before any app import
import os
os.environ["JWT_SECRET"] = "test-secret"
os.environ["WEBHOOK_SECRET"] = "test-webhook-secret"

from jose import jwt
from httpx import ASGITransport, AsyncClient

JWT_SECRET = "test-secret"
ALGORITHM = "HS256"
WEBHOOK_SECRET = "test-webhook-secret"

ORG_ID = str(uuid.uuid4())
MSP_ID = str(uuid.uuid4())
PROGRAM_ID = str(uuid.uuid4())
CONTROL_DEF_ID = str(uuid.uuid4())
PROGRAM_CONTROL_ID = str(uuid.uuid4())
ARTIFACT_ID = str(uuid.uuid4())
ASSESSMENT_ID = str(uuid.uuid4())
USER_ID = str(uuid.uuid4())  # valid UUID — used by routes that call uuid.UUID(user["user_id"])


def make_token(role: str = "msp_admin", org_id: str = ORG_ID, msp_id: str = "", sub: str = "user-1") -> str:
    return jwt.encode(
        {"sub": sub, "org_id": org_id, "role": role, "msp_id": msp_id},
        JWT_SECRET,
        algorithm=ALGORITHM,
    )


@pytest.fixture()
def super_admin_token() -> str:
    return make_token(role="super_admin", org_id="", msp_id="")


@pytest.fixture()
def msp_token() -> str:
    return make_token(role="msp_admin", org_id="", msp_id=MSP_ID)


@pytest.fixture()
def client_token() -> str:
    return make_token(role="client_admin", org_id=ORG_ID)


@pytest.fixture()
def client_user_token() -> str:
    return make_token(role="client_user", org_id=ORG_ID)


@pytest.fixture()
def viewer_token() -> str:
    return make_token(role="viewer", org_id=ORG_ID)


def make_mock_conn() -> AsyncMock:
    """Return a fresh AsyncMock connection with common methods pre-mocked."""
    conn = AsyncMock()
    conn.fetch = AsyncMock(return_value=[])
    conn.fetchrow = AsyncMock(return_value=None)
    conn.fetchval = AsyncMock(return_value=None)
    conn.execute = AsyncMock(return_value="OK")
    return conn


@pytest_asyncio.fixture()
async def async_client() -> AsyncGenerator[tuple[AsyncClient, AsyncMock], None]:
    """
    Yields (client, mock_conn).

    Skips the real lifespan (no DB/MinIO needed).
    The app module is imported here so tests can reference `app` directly
    for state manipulation.
    """
    mock_conn = make_mock_conn()
    mock_pool = MagicMock()
    mock_pool.acquire.return_value.__aenter__ = AsyncMock(return_value=mock_conn)
    mock_pool.acquire.return_value.__aexit__ = AsyncMock(return_value=False)
    mock_pool.close = AsyncMock()

    mock_minio = MagicMock()

    # Patch lifespan so no real connections are attempted on startup
    with patch("main.create_pool", new=AsyncMock(return_value=mock_pool)), \
         patch("main.Minio", return_value=mock_minio), \
         patch("main.ensure_bucket"):

        from main import app as fastapi_app

        fastapi_app.state.pool = mock_pool
        fastapi_app.state.minio = mock_minio

        transport = ASGITransport(app=fastapi_app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            yield client, mock_conn
