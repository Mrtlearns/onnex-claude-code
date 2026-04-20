"""Logs each HTTP request with method, path, status, and duration."""
from __future__ import annotations

import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.logging_config import get_logger

logger = get_logger(__name__)


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter_ns()
        response = await call_next(request)
        duration_ms = (time.perf_counter_ns() - start) / 1_000_000
        log_fn = logger.warning if response.status_code >= 500 else logger.info
        log_fn(
            "request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            duration_ms=round(duration_ms, 2),
        )
        return response
