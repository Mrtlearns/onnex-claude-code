"""Tests for policy_draft_service — context assembly, prompt building, generation."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import respx
import httpx

from tests.conftest import (
    ORG_ID,
    PROGRAM_ID,
    PROGRAM_CONTROL_ID,
    USER_ID,
)

# Imports will fail until service is created — RED state.
from app.services.policy_draft_service import (
    build_policy_context,
    _build_prompt,
    generate_policy_draft,
)

PC_UID = uuid.UUID(PROGRAM_CONTROL_ID)
USER_UID = uuid.UUID(USER_ID)
ORG_UID = uuid.UUID(ORG_ID)


class FakeRecord(dict):
    """Behaves like asyncpg.Record — dict subclass with .get() support."""

    def __getitem__(self, key):
        return super().__getitem__(key)

    def get(self, key, default=None):
        return super().get(key, default)


def _make_record(**data) -> FakeRecord:
    return FakeRecord(data)


_CONTROL_DATA = dict(
    nist_id="3.1.1",
    requirement_text="Limit system access to authorized users.",
    assessment_objective="Determine if system access is limited.",
    acceptable_proof_guidance="Access control policy document.",
    is_objective=False,
    implementation_notes="We use AD groups.",
    program_id=uuid.UUID(PROGRAM_ID),
    program_name="CMMC Program",
    system_name="Primary IS",
    org_id=ORG_UID,
    org_name="Acme Defense LLC",
    cage_code="1ABC2",
)


def _make_control_row() -> FakeRecord:
    return _make_record(**_CONTROL_DATA)


def _make_mock_conn(control_row=None, hardware=None, software=None, cloud=None, objectives=None, nist_chunks=None):
    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=control_row)
    results = [
        hardware or [],
        software or [],
        cloud or [],
        objectives or [],
        nist_chunks or [],
    ]
    call_count = 0

    async def _fetch(*args, **kwargs):
        nonlocal call_count
        result = results[call_count] if call_count < len(results) else []
        call_count += 1
        return result

    conn.fetch = AsyncMock(side_effect=_fetch)
    conn.execute = AsyncMock(return_value="OK")
    return conn


# ---------------------------------------------------------------------------
# build_policy_context
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_build_policy_context_happy_path():
    """Returns dict with all expected keys when control exists."""
    hw = [_make_record(asset_name="Workstation-01", asset_type="workstation", os="Windows 11")]
    sw = [_make_record(name="Windows Defender", version="4.18", purpose="AV")]
    cl = [_make_record(provider="Azure", service_name="AD", purpose="Identity")]
    obj = [_make_record(requirement_text="Obj text", assessment_objective="Obj assess")]
    nist = [_make_record(chunk_text="NIST guidance text")]

    conn = _make_mock_conn(
        control_row=_make_control_row(),
        hardware=hw,
        software=sw,
        cloud=cl,
        objectives=obj,
        nist_chunks=nist,
    )

    ctx = await build_policy_context(PC_UID, conn)

    assert "control" in ctx
    assert ctx["control"]["nist_id"] == "3.1.1"
    assert ctx["control"]["org_name"] == "Acme Defense LLC"
    assert len(ctx["hardware"]) == 1
    assert len(ctx["software"]) == 1
    assert len(ctx["cloud"]) == 1
    assert len(ctx["objectives"]) == 1
    assert ctx["nist_chunks"][0] == "NIST guidance text"


@pytest.mark.asyncio
async def test_build_policy_context_not_found():
    """Returns empty dict when program_control not found."""
    conn = _make_mock_conn(control_row=None)
    ctx = await build_policy_context(PC_UID, conn)
    assert ctx == {}


# ---------------------------------------------------------------------------
# _build_prompt
# ---------------------------------------------------------------------------


def _make_full_ctx():
    ctrl = dict(
        nist_id="3.1.1",
        requirement_text="Limit system access to authorized users.",
        assessment_objective="Determine if access is limited.",
        acceptable_proof_guidance="Policy doc.",
        is_objective=False,
        implementation_notes="AD groups.",
        program_id=uuid.UUID(PROGRAM_ID),
        program_name="CMMC Program",
        system_name="Primary IS",
        org_id=ORG_UID,
        org_name="Acme Defense LLC",
        cage_code="1ABC2",
    )
    return {
        "control": ctrl,
        "hardware": [{"asset_name": "PC-01", "asset_type": "workstation", "os": "Win11"}],
        "software": [{"name": "Defender", "version": "4.18", "purpose": "AV"}],
        "cloud": [{"provider": "Azure", "service_name": "AD", "purpose": "Identity"}],
        "objectives": [{"requirement_text": "Obj text", "assessment_objective": "Assess it"}],
        "nist_chunks": ["NIST chunk one", "NIST chunk two"],
    }


def test_build_prompt_contains_org_name():
    """Prompt string contains the org name."""
    ctx = _make_full_ctx()
    prompt = _build_prompt(ctx)
    assert "Acme Defense LLC" in prompt


def test_build_prompt_contains_nist_id():
    """Prompt string contains the NIST control ID."""
    ctx = _make_full_ctx()
    prompt = _build_prompt(ctx)
    assert "3.1.1" in prompt


# ---------------------------------------------------------------------------
# generate_policy_draft
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_draft_no_api_key():
    """With no API key, generates offline markdown and saves to DB."""
    conn = _make_mock_conn(control_row=_make_control_row())
    mock_minio = MagicMock()

    with patch("app.services.policy_draft_service.settings") as mock_settings, \
         patch("app.services.policy_draft_service.upload_bytes") as mock_upload:
        mock_settings.openrouter_api_key = ""
        mock_upload.side_effect = Exception("MinIO not available")

        draft_id = await generate_policy_draft(PC_UID, USER_UID, conn, mock_minio)

    assert draft_id is not None
    assert isinstance(draft_id, uuid.UUID)
    # conn.execute should have been called to INSERT
    conn.execute.assert_called()
    first_call_sql = conn.execute.call_args_list[0][0][0]
    assert "INSERT" in first_call_sql.upper()


@pytest.mark.asyncio
async def test_generate_draft_happy_path():
    """With a mocked OpenRouter response, content is saved to DB."""
    conn = _make_mock_conn(control_row=_make_control_row())
    mock_minio = MagicMock()

    fake_markdown = "# Acme Defense LLC 3.1.1 Policy\n\n## Purpose\n\nThis policy governs access control.\n"

    fake_response = {
        "choices": [{"message": {"content": fake_markdown}}]
    }

    with patch("app.services.policy_draft_service.settings") as mock_settings, \
         patch("app.services.policy_draft_service.upload_bytes"), \
         patch("app.services.policy_draft_service.markdown_to_docx", return_value=b"DOCX"):
        mock_settings.openrouter_api_key = "sk-test-key"

        with respx.mock:
            respx.post("https://openrouter.ai/api/v1/chat/completions").mock(
                return_value=httpx.Response(200, json=fake_response)
            )
            draft_id = await generate_policy_draft(PC_UID, USER_UID, conn, mock_minio)

    assert isinstance(draft_id, uuid.UUID)
    # Verify INSERT was called with the fake markdown content
    insert_call = conn.execute.call_args_list[0]
    insert_args = insert_call[0]
    assert fake_markdown in insert_args


@pytest.mark.asyncio
async def test_generate_draft_control_not_found():
    """Raises ValueError when program_control doesn't exist."""
    conn = _make_mock_conn(control_row=None)
    mock_minio = MagicMock()

    with pytest.raises(ValueError, match="not found"):
        await generate_policy_draft(PC_UID, USER_UID, conn, mock_minio)


@pytest.mark.asyncio
async def test_generate_draft_docx_upload_failure_is_nonfatal():
    """If DOCX upload raises, generate_policy_draft still returns a draft_id."""
    conn = _make_mock_conn(control_row=_make_control_row())
    mock_minio = MagicMock()

    with patch("app.services.policy_draft_service.settings") as mock_settings, \
         patch("app.services.policy_draft_service.upload_bytes") as mock_upload, \
         patch("app.services.policy_draft_service.markdown_to_docx", return_value=b"DOCX"):
        mock_settings.openrouter_api_key = ""
        mock_upload.side_effect = Exception("MinIO connection refused")

        draft_id = await generate_policy_draft(PC_UID, USER_UID, conn, mock_minio)

    assert isinstance(draft_id, uuid.UUID)
