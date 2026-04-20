"""Tests for A3 — Evidence Drift Detection service layer."""
from __future__ import annotations

import json
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from tests.conftest import ARTIFACT_ID


# ---------------------------------------------------------------------------
# cosine_distance — pure math, test directly
# ---------------------------------------------------------------------------


def test_cosine_distance_identical():
    """Identical vectors → distance = 0.0."""
    from app.services.drift_service import cosine_distance

    v = [1.0, 0.5, -0.3, 0.0]
    assert cosine_distance(v, v) == pytest.approx(0.0, abs=1e-7)


def test_cosine_distance_orthogonal():
    """Orthogonal vectors → distance = 1.0."""
    from app.services.drift_service import cosine_distance

    a = [1.0, 0.0, 0.0]
    b = [0.0, 1.0, 0.0]
    assert cosine_distance(a, b) == pytest.approx(1.0, abs=1e-7)


def test_cosine_distance_zero_vector():
    """Zero vector → returns 1.0 (no crash)."""
    from app.services.drift_service import cosine_distance

    a = [0.0, 0.0, 0.0]
    b = [1.0, 2.0, 3.0]
    assert cosine_distance(a, b) == pytest.approx(1.0, abs=1e-7)


# ---------------------------------------------------------------------------
# check_artifact_drift
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_check_artifact_drift_no_baseline():
    """Artifact exists but has no baseline_embedding → returns None."""
    from app.services.drift_service import check_artifact_drift

    conn = AsyncMock()
    row = MagicMock()
    row.__getitem__ = lambda self, k: None if k == "baseline_embedding" else "some text"
    row.get = lambda k, d=None: None if k == "baseline_embedding" else "some text"
    # Make bool(row) truthy but baseline_embedding is None
    conn.fetchrow = AsyncMock(return_value=row)

    result = await check_artifact_drift(uuid.UUID(ARTIFACT_ID), "some text", conn)
    assert result is None


@pytest.mark.asyncio
async def test_check_artifact_drift_not_found():
    """fetchrow returns None (artifact not found) → returns None."""
    from app.services.drift_service import check_artifact_drift

    conn = AsyncMock()
    conn.fetchrow = AsyncMock(return_value=None)

    result = await check_artifact_drift(uuid.UUID(ARTIFACT_ID), "text", conn)
    assert result is None


@pytest.mark.asyncio
async def test_check_artifact_drift_below_threshold():
    """Drift score below threshold → returns None, no DB update."""
    from app.services.drift_service import check_artifact_drift

    # Build a baseline vector that is nearly identical to what embed_one will return
    baseline_vec = [1.0] * 10 + [0.0] * (1536 - 10)
    baseline_str = json.dumps(baseline_vec)

    conn = AsyncMock()
    row_data = {"baseline_embedding": baseline_str, "extracted_text": "original text"}
    row = MagicMock()
    row.__getitem__ = lambda self, k: row_data[k]
    row.get = lambda k, d=None: row_data.get(k, d)
    conn.fetchrow = AsyncMock(return_value=row)

    # embed_one returns essentially the same vector
    with patch("app.services.drift_service.embed_one", new=AsyncMock(return_value=baseline_vec)):
        result = await check_artifact_drift(uuid.UUID(ARTIFACT_ID), "current text", conn)

    assert result is None
    conn.execute.assert_not_called()


@pytest.mark.asyncio
async def test_check_artifact_drift_above_threshold():
    """Drift score above threshold → returns score, DB records updated."""
    from app.services.drift_service import check_artifact_drift

    # baseline is all 0.1 (first 10 dims), current will be all 1.0 (last 10 dims)
    baseline_vec = [0.1] * 768 + [0.0] * (1536 - 768)
    current_vec = [0.0] * 768 + [1.0] * (1536 - 768)
    baseline_str = json.dumps(baseline_vec)

    conn = AsyncMock()
    row_data = {"baseline_embedding": baseline_str, "extracted_text": "original text"}
    row = MagicMock()
    row.__getitem__ = lambda self, k: row_data[k]
    row.get = lambda k, d=None: row_data.get(k, d)
    conn.fetchrow = AsyncMock(return_value=row)
    conn.execute = AsyncMock(return_value="OK")

    with patch("app.services.drift_service.embed_one", new=AsyncMock(return_value=current_vec)), \
         patch("app.services.drift_service.generate_drift_summary", new=AsyncMock(return_value="Drift detected.")):
        result = await check_artifact_drift(uuid.UUID(ARTIFACT_ID), "very different text", conn)

    assert result is not None
    assert result > 0.15
    # execute called: UPDATE artifacts, UPDATE program_controls, INSERT drift_events
    assert conn.execute.call_count >= 3


@pytest.mark.asyncio
async def test_check_artifact_drift_logs_event():
    """INSERT into artifact_drift_events is called when drift detected."""
    from app.services.drift_service import check_artifact_drift

    baseline_vec = [0.1] * 768 + [0.0] * (1536 - 768)
    current_vec = [0.0] * 768 + [1.0] * (1536 - 768)
    baseline_str = json.dumps(baseline_vec)

    conn = AsyncMock()
    row_data = {"baseline_embedding": baseline_str, "extracted_text": "original"}
    row = MagicMock()
    row.__getitem__ = lambda self, k: row_data[k]
    row.get = lambda k, d=None: row_data.get(k, d)
    conn.fetchrow = AsyncMock(return_value=row)
    conn.execute = AsyncMock(return_value="OK")

    with patch("app.services.drift_service.embed_one", new=AsyncMock(return_value=current_vec)), \
         patch("app.services.drift_service.generate_drift_summary", new=AsyncMock(return_value="Changes found.")):
        await check_artifact_drift(uuid.UUID(ARTIFACT_ID), "totally different", conn)

    # Check that artifact_drift_events INSERT was called
    calls_sql = [str(call) for call in conn.execute.call_args_list]
    assert any("artifact_drift_events" in sql for sql in calls_sql)


# ---------------------------------------------------------------------------
# generate_drift_summary
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_generate_drift_summary_no_api_key():
    """No API key → returns fallback string without making HTTP call."""
    from app.services.drift_service import generate_drift_summary

    with patch("app.services.drift_service.settings") as mock_settings:
        mock_settings.openrouter_api_key = ""
        result = await generate_drift_summary("original", "current", 0.35)

    assert "0.35" in result or "drift" in result.lower()


@pytest.mark.asyncio
async def test_generate_drift_summary_with_api_key():
    """With API key → calls OpenRouter, returns model content."""
    from app.services.drift_service import generate_drift_summary

    mock_response_json = {
        "choices": [{"message": {"content": "The policy scope has narrowed."}}]
    }

    with patch("app.services.drift_service.settings") as mock_settings, \
         patch("httpx.AsyncClient") as mock_client_cls:
        mock_settings.openrouter_api_key = "test-key"

        mock_resp = MagicMock()
        mock_resp.raise_for_status = MagicMock()
        mock_resp.json = MagicMock(return_value=mock_response_json)

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_resp)
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await generate_drift_summary("original text", "current text", 0.42)

    assert result == "The policy scope has narrowed."
