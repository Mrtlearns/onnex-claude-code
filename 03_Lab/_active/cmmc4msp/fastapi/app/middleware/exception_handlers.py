"""Global FastAPI exception handlers — logs, records to error_events, and returns safe responses."""
from __future__ import annotations

import os
import traceback

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

import asyncpg

from app.logging_config import get_logger

logger = get_logger(__name__)


def _cid(request: Request) -> str | None:
    return getattr(request.state, "correlation_id", None)


def _msp(request: Request) -> str | None:
    return getattr(request.state, "msp_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    from fastapi import HTTPException
    from app.services import error_events_service

    @app.exception_handler(HTTPException)
    async def http_exception_handler(request: Request, exc: HTTPException):
        if exc.status_code >= 500:
            logger.warning(
                "http_exception",
                status=exc.status_code,
                detail=str(exc.detail),
                exc_info=True,
            )
            pool = getattr(app.state, "pool", None)
            if pool:
                await error_events_service.record(
                    pool,
                    source="fastapi",
                    component=f"http.{exc.status_code}",
                    message=str(exc.detail),
                    severity="error",
                    stack_trace=traceback.format_exc(),
                    correlation_id=_cid(request),
                    msp_id=_msp(request),
                )
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail},
            headers={"X-Correlation-ID": _cid(request) or ""},
        )

    @app.exception_handler(asyncpg.PostgresError)
    async def postgres_exception_handler(request: Request, exc: asyncpg.PostgresError):
        tb = traceback.format_exc()
        logger.exception("postgres_error", exc=str(exc))
        pool = getattr(app.state, "pool", None)
        if pool:
            await error_events_service.record(
                pool,
                source="fastapi",
                component="db.asyncpg",
                message=str(exc),
                severity="error",
                stack_trace=tb,
                correlation_id=_cid(request),
                msp_id=_msp(request),
            )
        dev = os.getenv("DEV_MODE", "false").lower() == "true"
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc) if dev else "Database error"},
            headers={"X-Correlation-ID": _cid(request) or ""},
        )

    @app.exception_handler(Exception)
    async def generic_exception_handler(request: Request, exc: Exception):
        tb = traceback.format_exc()
        logger.exception("unhandled_exception", exc=str(exc))
        pool = getattr(app.state, "pool", None)
        if pool:
            await error_events_service.record(
                pool,
                source="fastapi",
                component=f"unhandled.{type(exc).__name__}",
                message=str(exc),
                severity="error",
                stack_trace=tb,
                correlation_id=_cid(request),
                msp_id=_msp(request),
            )
        dev = os.getenv("DEV_MODE", "false").lower() == "true"
        return JSONResponse(
            status_code=500,
            content={"detail": str(exc) if dev else "Internal server error"},
            headers={"X-Correlation-ID": _cid(request) or ""},
        )
