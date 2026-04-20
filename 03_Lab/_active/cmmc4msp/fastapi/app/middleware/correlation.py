"""Assigns X-Correlation-ID and peeks at JWT claims on every request.

Binds correlation_id, msp_id, and org_id to structlog contextvars and
request.state so that exception handlers and background tasks can tag
error_events rows without needing the full JWT dependency chain.
"""
from __future__ import annotations

import base64
import json
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


def _peek_jwt_claims(token: str) -> dict:
    """Decode the payload section of a JWT without signature verification.

    Used only to extract msp_id/org_id for tagging — auth validation still
    happens in the route dependencies.  Returns {} on any parse failure.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return {}
        payload_b64 = parts[1]
        padding = 4 - len(payload_b64) % 4
        if padding < 4:
            payload_b64 += "=" * padding
        return json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return {}


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        structlog.contextvars.clear_contextvars()
        cid = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())

        # Peek at JWT to populate msp_id / org_id for error tagging.
        # Deliberately does NOT verify the signature — auth deps do that later.
        msp_id: str | None = None
        org_id: str | None = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            claims = _peek_jwt_claims(auth_header[7:])
            msp_id = claims.get("msp_id") or None
            org_id = claims.get("org_id") or None

        structlog.contextvars.bind_contextvars(
            correlation_id=cid,
            method=request.method,
            path=request.url.path,
        )
        request.state.correlation_id = cid
        request.state.msp_id = msp_id
        request.state.org_id = org_id

        response: Response = await call_next(request)
        response.headers["X-Correlation-ID"] = cid
        return response
