"""Tests for app.services.n8n_service — uses respx to mock httpx."""
from __future__ import annotations

import os
import uuid

import pytest
import respx
import httpx

import app.services.n8n_service as n8n_service
from app.services.n8n_service import (
    trigger_onboard,
    trigger_assessment,
    trigger_assignment_notification,
    trigger_invite,
    trigger_report,
)
import app.config as _config


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

N8N_BASE = "http://n8n:5678"

ORG_ID = str(uuid.uuid4())
PROGRAM_ID = str(uuid.uuid4())
ARTIFACT_ID = str(uuid.uuid4())
PROGRAM_CONTROL_ID = str(uuid.uuid4())
ASSIGNMENT_ID = str(uuid.uuid4())


def _wf_url(wf_id: str, path: str) -> str:
    return f"{N8N_BASE}/webhook/{wf_id}/webhook/{path}"


def _patch_settings(monkeypatch):
    """Reset settings to known test values."""
    monkeypatch.setattr(_config.settings, "n8n_internal_url", N8N_BASE)
    monkeypatch.setattr(_config.settings, "n8n_wf_onboard", "wf-onboard")
    monkeypatch.setattr(_config.settings, "n8n_wf_artifact", "wf-artifact")
    monkeypatch.setattr(_config.settings, "n8n_wf_report", "wf-report")
    monkeypatch.setattr(_config.settings, "n8n_wf_assign_notify", "wf-assign")
    monkeypatch.setattr(_config.settings, "n8n_wf_user_invite", "wf-invite")


# ---------------------------------------------------------------------------
# trigger_onboard
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_trigger_onboard_fires_correct_url(monkeypatch):
    """trigger_onboard POSTs to the onboard-client webhook URL."""
    _patch_settings(monkeypatch)
    route = respx.post(_wf_url("wf-onboard", "onboard-client")).mock(
        return_value=httpx.Response(200)
    )

    await trigger_onboard(org_id=ORG_ID, program_id=PROGRAM_ID)

    assert route.called
    payload = route.calls[0].request
    import json
    body = json.loads(payload.content)
    assert body["org_id"] == ORG_ID
    assert body["program_id"] == PROGRAM_ID


@pytest.mark.asyncio
@respx.mock
async def test_trigger_onboard_swallows_5xx(monkeypatch):
    """trigger_onboard does not raise on 5xx response (fire-and-forget)."""
    _patch_settings(monkeypatch)
    respx.post(_wf_url("wf-onboard", "onboard-client")).mock(
        return_value=httpx.Response(503)
    )

    # Should not raise
    await trigger_onboard(org_id=ORG_ID, program_id=PROGRAM_ID)


@pytest.mark.asyncio
@respx.mock
async def test_trigger_onboard_swallows_connect_error(monkeypatch):
    """trigger_onboard does not raise on httpx.ConnectError."""
    _patch_settings(monkeypatch)
    respx.post(_wf_url("wf-onboard", "onboard-client")).mock(
        side_effect=httpx.ConnectError("Connection refused")
    )

    # Should not raise
    await trigger_onboard(org_id=ORG_ID, program_id=PROGRAM_ID)


# ---------------------------------------------------------------------------
# trigger_assessment
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_trigger_assessment_fires_correct_payload(monkeypatch):
    """trigger_assessment POSTs artifact_id + presigned_url to artifact webhook."""
    _patch_settings(monkeypatch)
    route = respx.post(_wf_url("wf-artifact", "artifact-submitted")).mock(
        return_value=httpx.Response(200)
    )

    await trigger_assessment(
        artifact_id=ARTIFACT_ID,
        program_control_id=PROGRAM_CONTROL_ID,
        presigned_url="https://minio/presigned",
    )

    assert route.called
    import json
    body = json.loads(route.calls[0].request.content)
    assert body["artifact_id"] == ARTIFACT_ID
    assert body["program_control_id"] == PROGRAM_CONTROL_ID
    assert body["presigned_url"] == "https://minio/presigned"


# ---------------------------------------------------------------------------
# trigger_assignment_notification
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_trigger_assignment_notification_skips_if_no_wf(monkeypatch):
    """Returns early without HTTP call if n8n_wf_assign_notify is empty."""
    _patch_settings(monkeypatch)
    monkeypatch.setattr(_config.settings, "n8n_wf_assign_notify", "")

    route = respx.post(url__regex=r".*assignment.*").mock(
        return_value=httpx.Response(200)
    )

    await trigger_assignment_notification(
        assignment_id=ASSIGNMENT_ID,
        to_status="assigned",
        assignee_email="user@example.com",
    )

    assert not route.called


@pytest.mark.asyncio
@respx.mock
async def test_trigger_assignment_notification_fires_when_configured(monkeypatch):
    """Fires assignment notification when wf ID is set."""
    _patch_settings(monkeypatch)
    route = respx.post(_wf_url("wf-assign", "assignment-status-changed")).mock(
        return_value=httpx.Response(200)
    )

    await trigger_assignment_notification(
        assignment_id=ASSIGNMENT_ID,
        to_status="in_review",
        assignee_email="user@example.com",
        context={"assignee_name": "Test User"},
    )

    assert route.called
    import json
    body = json.loads(route.calls[0].request.content)
    assert body["assignment_id"] == ASSIGNMENT_ID
    assert body["to_status"] == "in_review"
    assert body["assignee_name"] == "Test User"


# ---------------------------------------------------------------------------
# trigger_invite
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_trigger_invite_fires_correct_payload(monkeypatch):
    """trigger_invite POSTs invite data to user-invite webhook."""
    _patch_settings(monkeypatch)
    route = respx.post(_wf_url("wf-invite", "user-invite")).mock(
        return_value=httpx.Response(200)
    )

    await trigger_invite(
        email="invite@example.com",
        invite_token="abc123",
        org_name="Acme Defense",
        invited_by_name="Admin User",
        role="contributor",
    )

    assert route.called
    import json
    body = json.loads(route.calls[0].request.content)
    assert body["email"] == "invite@example.com"
    assert body["invite_token"] == "abc123"
    assert body["org_name"] == "Acme Defense"
    assert body["role"] == "contributor"


@pytest.mark.asyncio
@respx.mock
async def test_trigger_invite_skips_if_no_wf(monkeypatch):
    """Returns early without HTTP call if n8n_wf_user_invite is empty."""
    _patch_settings(monkeypatch)
    monkeypatch.setattr(_config.settings, "n8n_wf_user_invite", "")

    route = respx.post(url__regex=r".*invite.*").mock(
        return_value=httpx.Response(200)
    )

    await trigger_invite(
        email="x@example.com",
        invite_token="tok",
        org_name="Org",
        invited_by_name="Admin",
        role="viewer",
    )

    assert not route.called


# ---------------------------------------------------------------------------
# trigger_report
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
@respx.mock
async def test_trigger_report_returns_parsed_json(monkeypatch):
    """trigger_report returns the JSON response from n8n."""
    _patch_settings(monkeypatch)
    respx.post(_wf_url("wf-report", "report-generator")).mock(
        return_value=httpx.Response(200, json={"report_url": "https://minio/report.pdf"})
    )

    result = await trigger_report(program_id=PROGRAM_ID, report_type="ssp")

    assert result["report_url"] == "https://minio/report.pdf"


@pytest.mark.asyncio
@respx.mock
async def test_trigger_report_propagates_error(monkeypatch):
    """trigger_report propagates httpx errors (not fire-and-forget)."""
    _patch_settings(monkeypatch)
    respx.post(_wf_url("wf-report", "report-generator")).mock(
        side_effect=httpx.ConnectError("n8n unreachable")
    )

    with pytest.raises(httpx.ConnectError):
        await trigger_report(program_id=PROGRAM_ID, report_type="ssp")
