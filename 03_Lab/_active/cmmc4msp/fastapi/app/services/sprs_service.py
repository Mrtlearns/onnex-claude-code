"""SPRS and FAR & Above score calculation service."""
import asyncpg

# The SSP control — if not implemented, SPRS floors to -203
SPRS_SSP_CONTROL_NIST_ID = "3.12.4"

# Maximum SPRS score per DoD methodology
SPRS_MAX = 110

# Phase gate score allocations (cumulative sum = 187, capped at 110 in SPRS)
_PHASE_SCORES: dict[int, int] = {1: 37, 2: 32, 3: 34, 4: 37, 5: 47}


async def calculate_and_save_sprs(
    program_id: str,
    conn: asyncpg.Connection,
) -> dict:
    """
    Calculate SPRS and FAR & Above scores from current program_controls state
    and persist both values back to the programs table.

    Returns {"sprs_score": int, "far_above_score": int}.
    """
    rows = await conn.fetch(
        """
        SELECT
            pc.status,
            pc.is_applicable,
            cd.dod_score_value,
            cd.nist_id,
            cd.far_above_phase
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        WHERE pc.program_id = $1
          AND cd.is_objective = FALSE
        """,
        program_id,
    )

    sprs_score = SPRS_MAX
    ssp_implemented = True

    for row in rows:
        if not row["is_applicable"]:
            continue

        if row["nist_id"] == SPRS_SSP_CONTROL_NIST_ID:
            if row["status"] != "fully_implemented":
                ssp_implemented = False

        if row["status"] != "fully_implemented" and row["dod_score_value"]:
            sprs_score -= row["dod_score_value"]

    # If SSP control is not implemented, SPRS is pegged to -203
    if not ssp_implemented:
        sprs_score = -203

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
            # No controls in this phase; skip but don't break
            continue

        phase_complete = all(
            r["status"] == "fully_implemented" for r in phase_rows
        )
        if phase_complete:
            far_score += _PHASE_SCORES[phase_num]
        else:
            break  # Phase gate: stop counting at first incomplete phase

    await conn.execute(
        """
        UPDATE programs
        SET sprs_score = $1, far_above_score = $2, updated_at = NOW()
        WHERE id = $3
        """,
        sprs_score,
        far_score,
        program_id,
    )

    return {"sprs_score": sprs_score, "far_above_score": far_score}
