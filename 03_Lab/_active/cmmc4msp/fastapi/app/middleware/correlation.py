"""Assigns X-Correlation-ID to every request and binds it to structlog contextvars."""
from __future__ import annotations

import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        structlog.contextvars.clear_contextvars()
        cid = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())
        structlog.contextvars.bind_contextvars(
            correlation_id=cid,
            method=request.method,
            path=request.url.path,
        )
        request.state.correlation_id = cid
        response: Response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response
