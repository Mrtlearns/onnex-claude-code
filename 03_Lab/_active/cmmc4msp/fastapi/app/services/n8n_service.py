"""n8n webhook trigger helpers — fire-and-forget HTTP calls.

n8n 2.x registers webhooks at /{workflowId}/webhook/{path} internally.
Production webhook URLs: /webhook/{workflowId}/webhook/{path}
"""
import httpx
from app.config import settings

# n8n workflow IDs — update if workflows are re-imported with new IDs
_WF_ONBOARD = "0b94eab2-87a1-527d-8dd6-05b48162278d"
_WF_ARTIFACT = "ab6c4376-5fe0-5e7d-84c5-d6940a71bcbe"
_WF_REPORT = "7ee20685-8a0a-533d-bff1-20d108c93a63"
_WF_ASSIGN_NOTIFY = "fmsB0tUoNEwslirl"
_WF_USER_INVITE = "bRsJ4TGcB8aIk4kk"


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
                _webhook_url(_WF_ONBOARD, "onboard-client"),
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
                _webhook_url(_WF_ARTIFACT, "artifact-submitted"),
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
    if not _WF_ASSIGN_NOTIFY:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_WF_ASSIGN_NOTIFY, "assignment-status-changed"),
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
    if not _WF_USER_INVITE:
        return  # workflow not yet imported
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                _webhook_url(_WF_USER_INVITE, "user-invite"),
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


async def trigger_report(program_id: str, report_type: str) -> dict:
    """Trigger n8n report generation and return response payload."""
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            _webhook_url(_WF_REPORT, "report-generator"),
            json={
                "program_id": str(program_id),
                "report_type": report_type,
            },
        )
        return response.json()
