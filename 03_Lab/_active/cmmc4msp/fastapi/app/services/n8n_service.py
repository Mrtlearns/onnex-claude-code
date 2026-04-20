"""n8n webhook trigger helpers — fire-and-forget HTTP calls.

n8n 2.x registers webhooks at /{workflowId}/webhook/{path} internally.
Production webhook URLs: /webhook/{workflowId}/webhook/{path}
"""
from __future__ import annotations

import uuid

import httpx

from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)


def _wf_onboard() -> str:
    return settings.n8n_wf_onboard

def _wf_artifact() -> str:
    return settings.n8n_wf_artifact

def _wf_report() -> str:
    return settings.n8n_wf_report

def _wf_assign_notify() -> str:
    return settings.n8n_wf_assign_notify

def _wf_user_invite() -> str:
    return settings.n8n_wf_user_invite


def _webhook_url(workflow_id: str, path: str) -> str:
    return f"{settings.n8n_internal_url}/webhook/{workflow_id}/webhook/{path}"


async def trigger_onboard(
    org_id: str,
    program_id: str,
    scoping_config: dict | None = None,
    correlation_id: str | None = None,
) -> None:
    """Trigger the n8n client onboarding workflow."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_wf_onboard(), "onboard-client"),
                headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
                json={
                    "org_id": str(org_id),
                    "program_id": str(program_id),
                    "scoping_config": scoping_config or {},
                },
            )
    except Exception as exc:
        logger.exception(
            "n8n_trigger_failed",
            workflow="onboard",
            url=_webhook_url(_wf_onboard(), "onboard-client"),
            exc=str(exc),
        )


async def trigger_assessment(
    artifact_id: str,
    program_control_id: str,
    presigned_url: str,
    correlation_id: str | None = None,
) -> None:
    """Trigger the n8n artifact assessment workflow."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_wf_artifact(), "artifact-submitted"),
                headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
                json={
                    "artifact_id": str(artifact_id),
                    "program_control_id": str(program_control_id),
                    "presigned_url": presigned_url,
                },
            )
    except Exception as exc:
        logger.exception(
            "n8n_trigger_failed",
            workflow="artifact",
            url=_webhook_url(_wf_artifact(), "artifact-submitted"),
            exc=str(exc),
        )


async def trigger_assignment_notification(
    assignment_id: str,
    to_status: str,
    assignee_email: str | None,
    context: dict | None = None,
    correlation_id: str | None = None,
) -> None:
    """Notify the assignee (and optionally the reviewer) of a status change."""
    wf = _wf_assign_notify()
    if not wf:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "assignment-status-changed"),
                headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
                json={
                    "assignment_id": assignment_id,
                    "to_status": to_status,
                    "assignee_email": assignee_email,
                    **(context or {}),
                },
            )
    except Exception as exc:
        logger.exception(
            "n8n_trigger_failed",
            workflow="assign_notify",
            url=_webhook_url(wf, "assignment-status-changed"),
            exc=str(exc),
        )


async def trigger_invite(
    email: str,
    invite_token: str,
    org_name: str,
    invited_by_name: str,
    role: str,
    correlation_id: str | None = None,
) -> None:
    """Send a magic-link invite email via n8n."""
    wf = _wf_user_invite()
    if not wf:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "user-invite"),
                headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
                json={
                    "email": email,
                    "invite_token": invite_token,
                    "org_name": org_name,
                    "invited_by_name": invited_by_name,
                    "role": role,
                },
            )
    except Exception as exc:
        logger.exception(
            "n8n_trigger_failed",
            workflow="user_invite",
            url=_webhook_url(wf, "user-invite"),
            exc=str(exc),
        )


async def trigger_assessment_notify(
    artifact_id: str,
    verdict: str,
    program_control_id: str,
    correlation_id: str | None = None,
) -> None:
    """Notify assignee when assessment completes — Workflow 11."""
    wf = settings.n8n_wf_assessment_notify
    if not wf:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "assessment-notify"),
                headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
                json={
                    "artifact_id": artifact_id,
                    "verdict": verdict,
                    "program_control_id": program_control_id,
                },
            )
    except Exception as exc:
        logger.exception(
            "n8n_trigger_failed",
            workflow="assessment_notify",
            url=_webhook_url(wf, "assessment-notify"),
            exc=str(exc),
        )


async def trigger_report(
    program_id: str,
    report_type: str,
    correlation_id: str | None = None,
) -> dict:
    """Trigger n8n report generation and return response payload."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            _webhook_url(_wf_report(), "report-generator"),
            headers={"X-Correlation-ID": correlation_id or str(uuid.uuid4())},
            json={
                "program_id": str(program_id),
                "report_type": report_type,
            },
        )
        return response.json()
