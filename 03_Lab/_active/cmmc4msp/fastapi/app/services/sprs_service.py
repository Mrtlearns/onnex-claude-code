"""SPRS and FAR & Above score calculation service.

Level 2: SPRS scoring (−203 to 110) per DoD methodology.
Level 3: Readiness percentage (0–100) — no SPRS for DIBCAC-assessed programs.
"""
import asyncpg

# Per-level configuration
LEVEL_CONFIG: dict[int, dict] = {
    2: {
        "scoring_type": "sprs",
        "max_score": 110,
        "floor_score": -203,
        "ssp_control": "3.12.4",
        "phase_scores": {1: 37, 2: 32, 3: 34, 4: 37, 5: 47},
    },
    3: {
        "scoring_type": "readiness_pct",
        "max_score": None,
        "floor_score": None,
        "ssp_control": "3.12.4",
        "phase_scores": {},
    },
}


async def calculate_and_save_sprs(
    program_id: str,
    conn: asyncpg.Connection,
) -> dict:
    """
    Calculate scores from current program_controls state and persist to programs.

    Level 2 → {"sprs_score": int, "far_above_score": int}
    Level 3 → {"readiness_pct": int, "sprs_score": None, "far_above_score": 0}
    """
    program_row = await conn.fetchrow(
        "SELECT cmmc_level FROM programs WHERE id = $1",
        program_id,
    )
    cmmc_level = program_row["cmmc_level"] if program_row else 2
    cfg = LEVEL_CONFIG[cmmc_level]

    rows = await conn.fetch(
        """
        SELECT
            pc.status,
            pc.is_applicable,
            cd.dod_score_value,
            cd.nist_id,
            cd.far_above_phase,
            cd.cmmc_level AS control_level
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.program_id = $1
          AND cd.is_objective = FALSE
        """,
        program_id,
    )

    if cmmc_level == 3:
        return await _calculate_readiness(program_id, rows, cfg, conn)
    return await _calculate_sprs(program_id, rows, cfg, conn)


async def _calculate_sprs(
    program_id: str,
    rows: list,
    cfg: dict,
    conn: asyncpg.Connection,
) -> dict:
    """SPRS calculation for Level 2 programs — unchanged DoD methodology."""
    sprs_score = cfg["max_score"]
    ssp_implemented = True

    for row in rows:
        if not row["is_applicable"]:
            continue

        if row["nist_id"] == cfg["ssp_control"]:
            if row["status"] != "fully_implemented":
                ssp_implemented = False

        if row["status"] != "fully_implemented" and row["dod_score_value"]:
            sprs_score -= row["dod_score_value"]

    if not ssp_implemented:
        sprs_score = cfg["floor_score"]

    # FAR & Above: phase-gated — stop accumulating at first incomplete phase
    far_score = 0
    for phase_num in range(1, 6):
        phase_str = str(phase_num)
        phase_rows = [
            r
            for r in rows
            if r["far_above_phase"] == phase_str and r["is_applicable"]
        ]
        if not phase_rows:
            continue

        phase_complete = all(r["status"] == "fully_implemented" for r in phase_rows)
        if phase_complete:
            far_score += cfg["phase_scores"][phase_num]
        else:
            break

    await conn.execute(
        """
        UPDATE programs
        SET sprs_score = $1, far_above_score = $2, readiness_pct = NULL, updated_at = NOW()
        WHERE id = $3
        """,
        sprs_score,
        far_score,
        program_id,
    )

    return {"sprs_score": sprs_score, "far_above_score": far_score}


async def _calculate_readiness(
    program_id: str,
    rows: list,
    cfg: dict,
    conn: asyncpg.Connection,
) -> dict:
    """Readiness percentage for Level 3 programs (no SPRS methodology)."""
    applicable = [r for r in rows if r["is_applicable"]]
    total = len(applicable)
    done = sum(1 for r in applicable if r["status"] == "fully_implemented")

    readiness_pct = round((done / total) * 100) if total > 0 else 0

    await conn.execute(
        """
        UPDATE programs
        SET sprs_score = NULL, far_above_score = 0, readiness_pct = $1, updated_at = NOW()
        WHERE id = $2
        """,
        readiness_pct,
        program_id,
    )

    return {"sprs_score": None, "far_above_score": 0, "readiness_pct": readiness_pct}
