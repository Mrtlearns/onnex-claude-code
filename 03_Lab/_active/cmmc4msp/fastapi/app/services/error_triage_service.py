"""AI Error Triage Collector — groups recent untriaged errors, proposes fixes."""
from __future__ import annotations

import json
import traceback
import uuid
from typing import Any

import asyncpg
import httpx

from app.config import settings
from app.logging_config import get_logger
from app.services import error_events_service

logger = get_logger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
TRIAGE_MODEL = "anthropic/claude-sonnet-4-6"

MAX_EVENTS = 50

PLATFORM_KNOWLEDGE = """You are the AI Error Triage Collector for the CMMC Compliance OS
(FastAPI + Next.js 14 + Hasura + n8n + PostgreSQL/pgvector + MinIO + Authentik).

Architecture:
- FastAPI (cmmc-fastapi:8000). Routers: msps, orgs, programs, controls, artifacts,
  assessments, suggestions, audit, reports, integrations, ssp_interview, triage.
- PostgreSQL (cmmc-postgres, db cmmc_main). State-bearing tables with status columns:
  program_sweeps, policy_drafts, control_gap_analyses, audit_packages, artifacts, assessments.
- n8n (cmmc-n8n) runs 14+ workflows triggered by FastAPI webhooks or schedules.
  WF07 cleans hung artifact assessments. WF14 monitors evidence drift. WF15 runs this triage.
- Hasura (cmmc-hasura) - GraphQL over Postgres with role-based permissions
  (super_admin, msp_admin, org_admin, org_member).
- Next.js 14 app router under /[orgSlug]/*.
- OpenRouter (Claude Sonnet 4.6) for: gap analysis, sweep, suggestions, SSP interview, triage.
- MinIO (cmmc-minio) stores artifacts and report PDFs.
- Authentik (cmmc-authentik-server) provides OIDC, emits JWT with msp_id/org_id/role claims.

Known failure modes:
- MinIO presigned URL host mismatch (MINIO_PUBLIC_URL vs MINIO_ENDPOINT).
- OpenRouter 429/5xx during AI calls - retry with exponential backoff.
- asyncpg connection-pool exhaustion under burst load.
- n8n webhook URL malformed (must be /webhook/{path}).
- JWT/JWK rotation between Authentik and Hasura causing 401s.
- pgvector embedding dimension mismatch (text-embedding-3-small produces 1536 dims).
- Background-task orphan rows (status=running with old created_at) - swallowed exceptions pre-migration-025.
- SMTP/Resend delivery failures leaving notification workflows silently incomplete.

Grouping rules:
- Group by (component, first line of stack_trace OR message[0:80 chars]).
- Rank by: severity DESC, occurrences DESC, recency DESC.
- A "signature" = first 12 hex chars of sha256(component + normalized_message).

When proposing fixes, be specific: cite exact file paths, line numbers if known, migration names,
env var names, Docker container names. The team can act immediately on your output."""

USER_TEMPLATE = """Triage the following {n} error_events from the platform.

Each event: id | created_at | source | component | severity | message | stack_trace (truncated)

Events:
{events_block}

Recent activity_log entries for affected orgs (last 24h):
{activity_block}

Return ONLY valid JSON with this exact shape (no markdown fences, no explanation):
{{
  "summary": "2-3 sentence overview of current platform health and most critical issues",
  "themes": [
    {{ "name": "string", "description": "string", "event_ids": ["uuid1", "uuid2"] }}
  ],
  "top_errors": [
    {{
      "signature": "12-char hex string",
      "component": "e.g. services.sweep",
      "occurrences": 3,
      "severity": "error",
      "sample_event_id": "uuid",
      "likely_root_cause": "specific diagnosis with file paths where possible",
      "proposed_fix": "concrete actionable fix, e.g. Add retry with jitter around line 180 of policy_draft_service.py",
      "affected_orgs": ["org_id_1"],
      "confidence": 0.85
    }}
  ],
  "suggested_actions": [
    {{ "priority": 1, "action": "string description of action", "effort_hours": 2, "area": "fastapi|n8n|db|frontend|ops" }}
  ]
}}"""


async def run_triage(
    report_id: uuid.UUID,
    requested_by: uuid.UUID | None,
    msp_id: uuid.UUID | None,
    pool: asyncpg.Pool,
    event_limit: int = MAX_EVENTS,
) -> None:
    """Background task - reads untriaged errors, calls Claude, writes triage_reports row."""
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE triage_reports SET status='running' WHERE id=$1",
            report_id,
        )
        try:
            # Fetch untriaged errors (scoped to msp if provided, else all for super_admin)
            if msp_id:
                events = await conn.fetch(
                    """
                    SELECT id, created_at, source, component, severity, message,
                           LEFT(stack_trace, 2000) AS stack_trace, context, org_id, correlation_id
                    FROM error_events
                    WHERE triaged = FALSE AND msp_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2
                    """,
                    msp_id, event_limit,
                )
            else:
                events = await conn.fetch(
                    """
                    SELECT id, created_at, source, component, severity, message,
                           LEFT(stack_trace, 2000) AS stack_trace, context, org_id, correlation_id
                    FROM error_events
                    WHERE triaged = FALSE
                    ORDER BY created_at DESC
                    LIMIT $1
                    """,
                    event_limit,
                )

            if not events:
                await conn.execute(
                    """
                    UPDATE triage_reports
                    SET status='ready', event_count=0,
                        report=$1::jsonb, completed_at=now()
                    WHERE id=$2
                    """,
                    json.dumps({
                        "summary": "No untriaged errors found. Platform appears healthy.",
                        "themes": [],
                        "top_errors": [],
                        "suggested_actions": [],
                    }),
                    report_id,
                )
                return

            event_ids = [e["id"] for e in events]
            org_ids = list({e["org_id"] for e in events if e["org_id"]})

            # Fetch recent activity for context
            activity = []
            if org_ids:
                activity = await conn.fetch(
                    """
                    SELECT org_id, event_type, description, created_at
                    FROM activity_log
                    WHERE org_id = ANY($1::uuid[]) AND created_at > now() - INTERVAL '24 hours'
                    ORDER BY created_at DESC
                    LIMIT 100
                    """,
                    org_ids,
                )

            # Build prompt content
            events_block = "\n".join(
                f"- {e['id']} [{e['created_at'].strftime('%Y-%m-%dT%H:%M:%SZ')}]"
                f" src={e['source']} comp={e['component']} sev={e['severity']}"
                f" msg={(e['message'] or '')[:160]}"
                + (f" | stack: {(e['stack_trace'] or '')[:300]}" if e['stack_trace'] else "")
                for e in events
            )
            activity_block = "\n".join(
                f"- org={a['org_id']} {a['event_type']}: {(a['description'] or '')[:120]}"
                for a in activity
            ) or "(no recent activity for affected orgs)"

            prompt = USER_TEMPLATE.format(
                n=len(events),
                events_block=events_block,
                activity_block=activity_block,
            )

            # Call OpenRouter — mirror sweep_service.py pattern exactly
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://app.cmmc4msp.on-nex.us",
                    },
                    json={
                        "model": TRIAGE_MODEL,
                        "messages": [
                            {"role": "system", "content": PLATFORM_KNOWLEDGE},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.2,
                        "max_tokens": 4000,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"].strip()

            # Strip markdown fences if present
            raw = content
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            report = json.loads(raw.strip())

            # Persist — mark events triaged in same transaction
            async with conn.transaction():
                await conn.execute(
                    """
                    UPDATE triage_reports
                    SET status='ready', event_count=$1,
                        report=$2::jsonb, completed_at=now()
                    WHERE id=$3
                    """,
                    len(events),
                    json.dumps(report),
                    report_id,
                )
                await conn.execute(
                    """
                    UPDATE error_events
                    SET triaged=TRUE, triaged_at=now(), triaged_by_report_id=$1
                    WHERE id = ANY($2::uuid[])
                    """,
                    report_id,
                    event_ids,
                )

            logger.info("triage_complete", report_id=str(report_id), event_count=len(events))

        except Exception as exc:
            tb = traceback.format_exc()
            logger.exception("triage_failed", report_id=str(report_id))
            await conn.execute(
                """
                UPDATE triage_reports
                SET status='failed', error_message=$1, completed_at=now()
                WHERE id=$2
                """,
                f"{exc}\n{tb[:1500]}",
                report_id,
            )
            # Also record in error_events
            await error_events_service.record(
                conn,
                source="fastapi",
                component="services.error_triage",
                message=str(exc),
                severity="error",
                stack_trace=tb,
            )
            raise
