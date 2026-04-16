"""Unit tests for SPRS score calculation logic."""
from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.services.sprs_service import calculate_and_save_sprs, SPRS_MAX, SPRS_SSP_CONTROL_NIST_ID


def _make_control(
    nist_id: str,
    status: str,
    dod_value: int | None,
    far_phase: str,
    applicable: bool = True,
) -> MagicMock:
    row = MagicMock()
    row.__getitem__ = lambda self, k: {
        "nist_id": nist_id,
        "status": status,
        "dod_score_value": dod_value,
        "far_above_phase": far_phase,
        "is_applicable": applicable,
    }[k]
    row.get = lambda k, default=None: {
        "nist_id": nist_id,
        "status": status,
        "dod_score_value": dod_value,
        "far_above_phase": far_phase,
        "is_applicable": applicable,
    }.get(k, default)
    return row


@pytest.fixture()
def mock_conn():
    conn = AsyncMock()
    conn.execute = AsyncMock()
    return conn


@pytest.mark.asyncio
async def test_all_controls_implemented_returns_110(mock_conn):
    """When every control is fully implemented, SPRS should be 110."""
    program_id = str(uuid.uuid4())
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control("3.1.1", "fully_implemented", 5, "1"),
            _make_control("3.1.2", "fully_implemented", 3, "1"),
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3"),
        ]
    )

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["sprs_score"] == SPRS_MAX


@pytest.mark.asyncio
async def test_deducts_score_for_unimplemented_controls(mock_conn):
    """Score should be 110 minus sum of dod_score_value for non-implemented controls."""
    program_id = str(uuid.uuid4())
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control("3.1.1", "not_implemented", 5, "1"),
            _make_control("3.1.2", "fully_implemented", 3, "1"),
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3"),
        ]
    )

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["sprs_score"] == SPRS_MAX - 5


@pytest.mark.asyncio
async def test_ssp_not_implemented_floors_to_negative_203(mock_conn):
    """If 3.12.4 is not fully_implemented, SPRS must floor to -203."""
    program_id = str(uuid.uuid4())
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control("3.1.1", "fully_implemented", 5, "1"),
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "not_implemented", 1, "3"),
        ]
    )

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["sprs_score"] == -203


@pytest.mark.asyncio
async def test_not_applicable_controls_not_deducted(mock_conn):
    """Controls marked is_applicable=False must not affect the SPRS score."""
    program_id = str(uuid.uuid4())
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control("3.1.1", "not_implemented", 5, "1", applicable=False),
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3"),
        ]
    )

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["sprs_score"] == SPRS_MAX


@pytest.mark.asyncio
async def test_far_above_phase_gate_stops_at_incomplete_phase(mock_conn):
    """FAR & Above must not count phase N+1 if phase N is incomplete."""
    program_id = str(uuid.uuid4())
    # Phase 1 complete, phase 2 incomplete → only phase 1 score (37) counted
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control("3.1.1", "fully_implemented", 5, "1"),
            _make_control("3.2.1", "not_implemented", 3, "2"),
            _make_control("3.3.1", "fully_implemented", 2, "3"),
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3"),
        ]
    )

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["far_above_score"] == 37


@pytest.mark.asyncio
async def test_far_above_all_phases_complete(mock_conn):
    """All 5 phases complete → far_above_score = 37+32+34+37+47 = 187."""
    program_id = str(uuid.uuid4())
    controls = [
        _make_control(f"3.{i}.1", "fully_implemented", 1, str(i))
        for i in range(1, 6)
    ] + [_make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3")]
    mock_conn.fetch = AsyncMock(return_value=controls)

    result = await calculate_and_save_sprs(program_id, mock_conn)

    assert result["far_above_score"] == 187


@pytest.mark.asyncio
async def test_db_update_called_with_scores(mock_conn):
    """calculate_and_save_sprs must persist scores to the programs table."""
    program_id = str(uuid.uuid4())
    mock_conn.fetch = AsyncMock(
        return_value=[
            _make_control(SPRS_SSP_CONTROL_NIST_ID, "fully_implemented", 1, "3"),
        ]
    )

    await calculate_and_save_sprs(program_id, mock_conn)

    mock_conn.execute.assert_awaited_once()
    call_args = mock_conn.execute.call_args[0]
    assert "UPDATE programs" in call_args[0]
    assert str(program_id) in str(call_args)
