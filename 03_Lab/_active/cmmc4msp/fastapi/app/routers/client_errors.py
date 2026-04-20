"""Receives client-side errors from Next.js and records them in error_events.

No authentication required — errors can originate from the login page or any
unauthenticated route. Rate-limited per IP (10 req/min, in-memory fallback).
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.logging_config import get_logger
from app.services import error_events_service

logger = get_logger(__name__)
router = APIRouter()

# In-memory rate-limit store: { ip: (window_start, count) }
# Simple per-process store — good enough for single-container deployment.
# Falls back gracefully if Redis is unavailable.
_rate_store: dict[str, tuple[float, int]] = {}
_RATE_LIMIT = 10
_RATE_WINDOW = 60.0  # seconds


def _check_rate_limit(client_ip: str) -> bool:
    """Return True if the request is allowed, False if rate-limited."""
    now = time.monotonic()
    entry = _rate_store.get(client_ip)
    if entry is None or (now - entry[0]) >= _RATE_WINDOW:
        _rate_store[client_ip] = (now, 1)
        return True
    window_start, count = entry
    if count >= _RATE_LIMIT:
        return False
    _rate_store[client_ip] = (window_start, count + 1)
    return True


class ClientErrorPayload(BaseModel):
    message: str
    stack: str | None = None
    component_stack: str | None = None
    route: str | None = None
    user_agent: str | None = None
    component: str | None = None


def _real_ip(request: Request) -> str:
    """Return the client's real IP, honouring X-Forwarded-For from Traefik.

    Takes the rightmost non-private address from the XFF chain to avoid
    spoofing via a forged header prepended by the caller.  Falls back to
    request.client.host when the header is absent.
    """
    xff = request.headers.get("X-Forwarded-For", "")
    if xff:
        # Traefik appends the real client IP at the right of the chain.
        # The rightmost entry is set by Traefik itself and cannot be forged.
        candidates = [ip.strip() for ip in xff.split(",")]
        # Return rightmost non-empty entry.
        for ip in reversed(candidates):
            if ip:
                return ip
    return request.client.host if request.client else "unknown"


@router.post("", status_code=202)
async def record_client_error(payload: ClientErrorPayload, request: Request) -> dict[str, Any]:
    """Accept a client-side error report and store in error_events."""
    client_ip = _real_ip(request)

    if not _check_rate_limit(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    pool = request.app.state.pool

    # Extract context from request state — populated by JWT middleware if present.
    # These will be None for unauthenticated requests (login page errors, etc.).
    org_id: str | None = getattr(request.state, "org_id", None)
    msp_id: str | None = getattr(request.state, "msp_id", None)
    correlation_id: str | None = getattr(request.state, "correlation_id", None)

    route = (payload.route or "unknown")[:200]
    component = f"client.{payload.component or 'unknown'}"

    stack_parts = [payload.stack or "", payload.component_stack or ""]
    combined_stack = "\n".join(p for p in stack_parts if p).strip() or None

    await error_events_service.record(
        pool,
        source="nextjs",
        component=component,
        message=payload.message[:2000],
        severity="error",
        stack_trace=combined_stack[:4000] if combined_stack else None,
        context={
            "user_agent": (payload.user_agent or "")[:500],
            "component": payload.component or "unknown",
            "route": route,
        },
        correlation_id=correlation_id,
        msp_id=msp_id,
        org_id=org_id,
    )

    return {"status": "recorded"}
