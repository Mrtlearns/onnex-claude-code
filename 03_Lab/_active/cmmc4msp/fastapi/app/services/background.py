"""Helpers for running background tasks with correctly-scoped database connections.

Background tasks in FastAPI run after the response is sent.  Connections
obtained via Depends(get_db) are returned to the pool when the request handler
returns — before the background task runs.  Using those connections in bg tasks
causes use-after-release bugs that corrupt other requests' data.

Use run_with_pool() instead: it acquires a fresh connection from the pool
inside the background coroutine, keeping the connection alive for exactly
as long as the task needs it.
"""
from __future__ import annotations

import traceback
from collections.abc import Callable, Coroutine
from typing import Any

import asyncpg
import structlog

logger = structlog.get_logger(__name__)


async def run_with_pool(
    pool: asyncpg.Pool,
    coro_factory: Callable[[asyncpg.Connection], Coroutine[Any, Any, None]],
    *,
    component: str,
    correlation_id: str | None = None,
    msp_id: str | None = None,
    org_id: str | None = None,
    on_error: Callable[[asyncpg.Connection, Exception], Coroutine[Any, Any, None]] | None = None,
) -> None:
    """Run *coro_factory(conn)* with a fresh pool-acquired connection.

    If an exception occurs:
    - Logs it via structlog.
    - Records it in error_events via error_events_service.record().
    - Calls *on_error(conn, exc)* if provided (use this to update status columns).
    - Re-raises so FastAPI background-task machinery logs the traceback.

    Args:
        pool: asyncpg connection pool (from app.state.pool).
        coro_factory: async callable that receives a single asyncpg.Connection.
        component: dotted component name for error_events (e.g. "controls.gap_analysis").
        correlation_id: X-Correlation-ID from the originating request, if available.
        msp_id: MSP scope for error_events row.
        org_id: Org scope for error_events row.
        on_error: optional coroutine to run within the same connection on failure
            (e.g. UPDATE table SET status='failed').  Called before re-raise.
    """
    from app.services import error_events_service  # deferred to avoid circular imports

    async with pool.acquire() as conn:
        try:
            await coro_factory(conn)
        except Exception as exc:
            tb = traceback.format_exc()
            logger.exception(
                "background_task_failed",
                component=component,
                exc=str(exc),
                correlation_id=correlation_id,
            )
            try:
                await error_events_service.record(
                    conn,
                    source="fastapi",
                    component=component,
                    message=str(exc),
                    severity="error",
                    stack_trace=tb,
                    correlation_id=correlation_id,
                    msp_id=msp_id,
                    org_id=org_id,
                )
            except Exception:
                logger.warning("error_events_record_failed", component=component)

            if on_error is not None:
                try:
                    await on_error(conn, exc)
                except Exception:
                    logger.warning("on_error_callback_failed", component=component)

            raise
