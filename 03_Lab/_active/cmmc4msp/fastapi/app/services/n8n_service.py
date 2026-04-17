"""n8n webhook trigger helpers — fire-and-forget HTTP calls.

n8n 2.x registers webhooks at /{workflowId}/webhook/{path} internally.
Production webhook URLs: /webhook/{workflowId}/webhook/{path}
"""
import httpx
from app.config import settings


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
) -> None:
    """Trigger the n8n client onboarding workflow."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_wf_onboard(), "onboard-client"),
                json={
                    "org_id": str(org_id),
                    "program_id": str(program_id),
                    "scoping_config": scoping_config or {},
                },
            )
    except Exception:
        # Fire-and-forget — log but don't bubble up
        pass


async def trigger_assessment(
    artifact_id: str,
    program_control_id: str,
    presigned_url: str,
) -> None:
    """Trigger the n8n artifact assessment workflow."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_wf_artifact(), "artifact-submitted"),
                json={
                    "artifact_id": str(artifact_id),
                    "program_control_id": str(program_control_id),
                    "presigned_url": presigned_url,
                },
            )
    except Exception:
        pass


async def trigger_assignment_notification(
    assignment_id: str,
    to_status: str,
    assignee_email: str | None,
    context: dict | None = None,
) -> None:
    """Notify the assignee (and optionally the reviewer) of a status change."""
    wf = _wf_assign_notify()
    if not wf:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "assignment-status-changed"),
                json={
                    "assignment_id": assignment_id,
                    "to_status": to_status,
                    "assignee_email": assignee_email,
                    **(context or {}),
                },
            )
    except Exception:
        pass


async def trigger_invite(
    email: str,
    invite_token: str,
    org_name: str,
    invited_by_name: str,
    role: str,
) -> None:
    """Send a magic-link invite email via n8n."""
    wf = _wf_user_invite()
    if not wf:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "user-invite"),
                json={
                    "email": email,
                    "invite_token": invite_token,
                    "org_name": org_name,
                    "invited_by_name": invited_by_name,
                    "role": role,
                },
            )
    except Exception:
        pass


async def trigger_assessment_notify(
    artifact_id: str,
    verdict: str,
    program_control_id: str,
) -> None:
    """Notify assignee when assessment completes — Workflow 11."""
    wf = settings.n8n_wf_assessment_notify
    if not wf:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(wf, "assessment-notify"),
                json={
                    "artifact_id": artifact_id,
                    "verdict": verdict,
                    "program_control_id": program_control_id,
                },
            )
    except Exception:
        pass


async def trigger_report(program_id: str, report_type: str) -> dict:
    """Trigger n8n report generation and return response payload."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            _webhook_url(_wf_report(), "report-generator"),
            json={
                "program_id": str(program_id),
                "report_type": report_type,
            },
        )
        return response.json()
