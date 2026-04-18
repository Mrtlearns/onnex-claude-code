"""Central service for recording platform errors to error_events + activity_log."""
from __future__ import annotations

import json
import re
import traceback
import uuid
from typing import Any, Union

import asyncpg
import structlog

logger = structlog.get_logger(__name__)

# Ordered list of (pattern, replacement) pairs applied to any text before storage.
# Patterns are intentionally broad to catch common credential leakage shapes.
_SCRUB_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    # Bearer tokens (JWT, OpenAI, Anthropic, etc.) — must come first
    (re.compile(r"Bearer\s+[A-Za-z0-9._\-]+"), "Bearer ***"),
    # Hasura admin secret header — before the generic key=value pattern
    (re.compile(r"(?i)X-Hasura-Admin-Secret:\s*\S+"), "X-Hasura-Admin-Secret: ***"),
    # OpenRouter / OpenAI-style secret keys
    (re.compile(r"sk-or-v1-[A-Za-z0-9._\-]+"), "sk-or-v1-***"),
    (re.compile(r"sk-[A-Za-z0-9]{20,}"), "sk-***"),
    # Raw JWTs (three base64url segments)
    (re.compile(r"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+"), "<jwt>"),
    # Resend API keys
    (re.compile(r"re_[A-Za-z0-9_\-]{10,}"), "re_***"),
    # Generic key=value / key: value credentials.
    # Uses \b so "X-Hasura-Admin-Secret" is not re-matched after specific patterns above.
    (re.compile(r"(?i)\b(password|api[_\-]?key|secret|token|auth)\b[=:]\s*\S+"), r"\1=***"),
    # Email addresses
    (re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+"), "***@***"),
]


def _scrub(text: str | None) -> str | None:
    if not text:
        return text
    for pattern, replacement in _SCRUB_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


async def record(
    conn_or_pool: Union[asyncpg.Connection, asyncpg.Pool],
    *,
    source: str,
    component: str,
    message: str,
    severity: str = "error",
    stack_trace: str | None = None,
    context: dict[str, Any] | None = None,
    correlation_id: str | None = None,
    msp_id: str | None = None,
    org_id: str | None = None,
    program_id: str | None = None,
) -> uuid.UUID:
    message = _scrub(message) or message
    stack_trace = _scrub(stack_trace)
    ctx_json = json.dumps(context or {})

    corr_uuid: uuid.UUID | None = None
    if correlation_id:
        try:
            corr_uuid = uuid.UUID(correlation_id)
        except (ValueError, AttributeError):
            pass

    async def _insert(conn: asyncpg.Connection) -> uuid.UUID:
        event_id = await conn.fetchval(
            """
            INSERT INTO error_events
                (msp_id, org_id, program_id, correlation_id, source, severity,
                 component, message, stack_trace, context)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
            RETURNING id
            """,
            uuid.UUID(msp_id) if msp_id else None,
            uuid.UUID(org_id) if org_id else None,
            uuid.UUID(program_id) if program_id else None,
            corr_uuid,
            source, severity, component,
            (message or "")[:2000],
            (stack_trace or "")[:4000] if stack_trace else None,
            ctx_json,
        )
        await conn.execute(
            """
            INSERT INTO activity_log (msp_id, org_id, event_type, description, metadata)
            VALUES ($1,$2,'error',$3,$4::jsonb)
            """,
            uuid.UUID(msp_id) if msp_id else None,
            uuid.UUID(org_id) if org_id else None,
            f"[{severity.upper()}] {component}: {(message or '')[:200]}",
            json.dumps({"correlation_id": correlation_id, "event_id": str(event_id)}),
        )
        return event_id

    try:
        if isinstance(conn_or_pool, asyncpg.Pool):
            async with conn_or_pool.acquire() as conn:
                return await _insert(conn)
        else:
            return await _insert(conn_or_pool)
    except Exception as exc:
        logger.warning("error_events_record_failed", exc=str(exc))
        return uuid.uuid4()
