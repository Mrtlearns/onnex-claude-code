"""Database connection pool management."""
import asyncpg
from fastapi import Request
from app.config import settings


async def create_pool() -> asyncpg.Pool:
    return await asyncpg.create_pool(
        dsn=settings.postgres_dsn,
        min_size=5,
        max_size=30,
        command_timeout=30,
        max_inactive_connection_lifetime=300,
    )


async def get_db(request: Request):
    """FastAPI dependency — yields a connection from the shared pool."""
    async with request.app.state.pool.acquire() as conn:
        yield conn
