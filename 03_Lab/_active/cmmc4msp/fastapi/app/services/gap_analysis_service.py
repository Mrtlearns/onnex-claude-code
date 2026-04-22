"""Gap synthesis service — maps artifacts to control objectives using Claude."""
from __future__ import annotations

import json
import uuid
from typing import Optional

import httpx
import asyncpg

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GAP_MODEL = "anthropic/claude-sonnet-4-6"


async def run_gap_analysis(
    program_control_id: uuid.UUID,
    requested_by: uuid.UUID,
    conn: asyncpg.Connection,
) -> uuid.UUID:
    """
    1. Create placeholder gap_analysis record (status=generating)
    2. Fetch objectives for this control
    3. Fetch all assessed artifacts for this control + their assessment rationale
    4. Fetch cross-control artifacts from same org with cosine similarity > 0.5
    5. Build Claude prompt, call OpenRouter
    6. Parse JSON response
    7. Save results to control_gap_analyses
    Returns analysis_id.
    """
    # Create placeholder
    analysis_id = uuid.uuid4()
    await conn.execute(
        """
        INSERT INTO control_gap_analyses (id, program_control_id, requested_by, status)
        VALUES ($1, $2, $3, 'generating')
        """,
        analysis_id, program_control_id, requested_by,
    )

    try:
        # Fetch control info + objectives
        control = await conn.fetchrow(
            """
            SELECT cd.nist_id, cd.requirement_text, p.cmmc_level
            FROM program_controls pc
            JOIN control_definitions cd ON pc.control_definition_id = cd.id
            JOIN programs p ON pc.program_id = p.id
            WHERE pc.id = $1
            """,
            program_control_id,
        )
        if not control:
            raise ValueError("Control not found")

        objectives = await conn.fetch(
            """
            SELECT nist_id, requirement_text
            FROM control_definitions
            WHERE nist_id LIKE $1 AND is_objective = TRUE
            ORDER BY nist_id
            """,
            control["nist_id"] + ".%",
        )

        # Direct artifacts for this control
        direct_artifacts = await conn.fetch(
            """
            SELECT ar.id, ar.file_name, a.verdict, a.rationale, a.gaps_noted
            FROM artifacts ar
            JOIN assessments a ON a.artifact_id = ar.id
            WHERE ar.program_control_id = $1
            ORDER BY a.created_at DESC LIMIT 10
            """,
            program_control_id,
        )

        # Cross-control artifacts (cosine similarity > 0.5) — from same program
        cross_artifacts = await conn.fetch(
            """
            SELECT ar.id, ar.file_name, a.verdict, a.rationale,
                   cd2.nist_id AS source_control
            FROM artifact_chunks ac
            JOIN artifacts ar ON ac.artifact_id = ar.id
            JOIN assessments a ON a.artifact_id = ar.id
            JOIN program_controls pc2 ON ar.program_control_id = pc2.id
            JOIN control_definitions cd2 ON pc2.control_definition_id = cd2.id
            JOIN program_controls pc ON pc.id = $1
            WHERE pc2.program_id = pc.program_id
              AND ar.program_control_id != $1
              AND 1 - (ac.embedding <=> (
                  SELECT embedding FROM artifact_chunks
                  WHERE artifact_id IN (
                      SELECT id FROM artifacts WHERE program_control_id = $1 LIMIT 1
                  ) LIMIT 1
              )) > 0.5
            ORDER BY ac.embedding <=> (
                SELECT embedding FROM artifact_chunks
                WHERE artifact_id IN (
                    SELECT id FROM artifacts WHERE program_control_id = $1 LIMIT 1
                ) LIMIT 1
            )
            LIMIT 8
            """,
            program_control_id,
        )

        artifact_ids = (
            [str(r["id"]) for r in direct_artifacts]
            + [str(r["id"]) for r in cross_artifacts]
        )

        # Build prompt
        obj_text = "\n".join(
            f"[{chr(ord('a') + i)}] {obj['nist_id']}: {obj['requirement_text']}"
            for i, obj in enumerate(objectives)
        ) if objectives else f"[a] {control['nist_id']}: {control['requirement_text']}"

        direct_text = "\n".join(
            f"- {r['file_name']}: verdict={r['verdict']}, rationale={str(r['rationale'] or '')[:300]}, gaps={str(r['gaps_noted'] or '')[:150]}"
            for r in direct_artifacts
        ) or "No direct evidence uploaded."

        cross_text = "\n".join(
            f"- {r['file_name']} (from {r['source_control']}): verdict={r['verdict']}, rationale={str(r['rationale'] or '')[:200]}"
            for r in cross_artifacts
        ) or "No related cross-control evidence found."

        cmmc_level = control.get("cmmc_level", 2)
        nist_std = "NIST SP 800-171 Rev 2" if cmmc_level == 2 else "NIST SP 800-172"
        prompt = f"""You are a CMMC Level {cmmc_level} compliance gap analyst ({nist_std}).

CONTROL: {control['nist_id']} — {control['requirement_text']}

ALL OBJECTIVES (each must be satisfied):
{obj_text}

DIRECT EVIDENCE FOR THIS CONTROL:
{direct_text}

RELATED EVIDENCE FROM OTHER CONTROLS (similarity > 0.5):
{cross_text}

TASK: For each objective [a], [b], etc., assess coverage. Return a JSON object:
{{
  "objectives": [
    {{
      "letter": "a",
      "text": "...",
      "coverage": "Met" | "Partially Met" | "Not Covered",
      "covered_by": ["filename"],
      "evidence_needed": null | "Concrete description of what to upload"
    }}
  ],
  "overall_assessment": "X of Y objectives covered. ...",
  "suggested_next_upload": "The highest-impact next artifact would be..."
}}

Return ONLY valid JSON. No markdown, no explanation."""

        # Call OpenRouter
        gap_report: dict = {}
        if settings.openrouter_api_key:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": GAP_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "max_tokens": 1500,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]
                gap_report = json.loads(content)
        else:
            # Offline fallback
            letters = [chr(ord('a') + i) for i in range(max(1, len(objectives)))]
            gap_report = {
                "objectives": [
                    {
                        "letter": l,
                        "text": "N/A",
                        "coverage": "Not Covered",
                        "covered_by": [],
                        "evidence_needed": "OpenRouter API key not configured.",
                    }
                    for l in letters
                ],
                "overall_assessment": "0 of N objectives covered. Configure OPENROUTER_API_KEY.",
                "suggested_next_upload": "Configure OPENROUTER_API_KEY for real analysis.",
            }

        objs = gap_report.get("objectives", [])
        covered = sum(1 for o in objs if o.get("coverage") == "Met")
        total = len(objs)
        pct = covered / total if total > 0 else 0.0

        await conn.execute(
            """
            UPDATE control_gap_analyses SET
                status = 'ready',
                gap_report = $1,
                objectives_covered = $2,
                objectives_total = $3,
                coverage_pct = $4,
                overall_assessment = $5,
                suggested_next_upload = $6,
                model_used = $7,
                artifact_ids_analyzed = $8,
                updated_at = NOW()
            WHERE id = $9
            """,
            json.dumps(gap_report),
            covered, total, pct,
            gap_report.get("overall_assessment", ""),
            gap_report.get("suggested_next_upload", ""),
            GAP_MODEL,
            [uuid.UUID(aid) for aid in artifact_ids] if artifact_ids else None,
            analysis_id,
        )

    except Exception as exc:
        await conn.execute(
            "UPDATE control_gap_analyses SET status = 'error', updated_at = NOW() WHERE id = $1",
            analysis_id,
        )
        raise

    return analysis_id
