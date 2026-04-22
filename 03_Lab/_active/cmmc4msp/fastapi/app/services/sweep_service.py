"""Program AI Sweep — bulk gap analysis + prioritized action plan."""
from __future__ import annotations
import json
import uuid
import asyncio
import httpx
import asyncpg
from app.config import settings
from app.logging_config import get_logger

logger = get_logger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
SWEEP_MODEL = "anthropic/claude-sonnet-4-6"
MAX_CONTROLS = 50  # cap for a single sweep to stay within context


async def run_program_sweep(
    sweep_id: uuid.UUID,
    program_id: uuid.UUID,
    requested_by: uuid.UUID,
    pool: asyncpg.Pool,
) -> None:
    """Background task: analyze all non-implemented controls and produce ranked plan."""
    async with pool.acquire() as conn:
        await conn.execute(
            "UPDATE program_sweeps SET status='running' WHERE id=$1", sweep_id
        )
        try:
            # 1. Fetch program level then controls
            program_row = await conn.fetchrow(
                "SELECT cmmc_level FROM programs WHERE id = $1", program_id
            )
            cmmc_level = program_row["cmmc_level"] if program_row else 2
            nist_std = "NIST SP 800-171 Rev 2" if cmmc_level == 2 else "NIST SP 800-172"

            controls = await conn.fetch(
                """
                SELECT pc.id, pc.status, cd.nist_id, cd.requirement_text,
                       cd.assessment_objective,
                       (SELECT COUNT(*) FROM artifacts a WHERE a.program_control_id = pc.id AND a.assessment_status = 'assessed') AS artifact_count,
                       (SELECT cga.gap_report FROM control_gap_analyses cga WHERE cga.program_control_id = pc.id ORDER BY cga.created_at DESC LIMIT 1) AS last_gap_report
                FROM program_controls pc
                JOIN control_definitions cd ON pc.control_definition_id = cd.id
                WHERE pc.program_id = $1
                  AND pc.status NOT IN ('fully_implemented', 'not_applicable')
                  AND pc.is_applicable = TRUE
                ORDER BY cd.far_above_phase ASC, pc.status ASC
                LIMIT $2
                """,
                program_id, MAX_CONTROLS,
            )

            if not controls:
                await conn.execute(
                    "UPDATE program_sweeps SET status='ready', control_count=0, sweep_report=$1, completed_at=now() WHERE id=$2",
                    json.dumps({"actions": [], "summary": "All controls fully implemented or not applicable."}),
                    sweep_id,
                )
                return

            # 2. Build Claude prompt
            control_summaries = []
            for c in controls:
                gap_info = ""
                if c["last_gap_report"]:
                    try:
                        gd = json.loads(c["last_gap_report"]) if isinstance(c["last_gap_report"], str) else c["last_gap_report"]
                        gap_info = f" Missing: {', '.join(gd.get('missing_objectives', [])[:3])}"
                    except Exception:
                        pass
                control_summaries.append(
                    f"- {c['nist_id']} (status={c['status']}, artifacts={c['artifact_count']}){gap_info}: {(c['requirement_text'] or '')[:120]}"
                )

            prompt = f"""You are a CMMC Level {cmmc_level} compliance advisor ({nist_std}). Analyze these {len(controls)} controls that are NOT yet fully implemented.

Controls:
{chr(10).join(control_summaries)}

Produce a JSON object with:
{{
  "summary": "2-3 sentence executive summary of the program's compliance posture",
  "themes": ["list of 2-4 common gap themes across controls"],
  "actions": [
    {{
      "nist_id": "3.X.Y",
      "priority_rank": 1,
      "recommended_action": "specific action in 1 sentence",
      "gap_summary": "why this control is not met in 1-2 sentences",
      "suggested_status": "not_implemented|partially_implemented|planned",
      "confidence": 0.85
    }}
  ]
}}

Rank actions by: (1) Phase 1 controls first, (2) controls with most cross-control impact, (3) controls with existing artifacts that just need review.
Return ONLY valid JSON."""

            async with httpx.AsyncClient(timeout=90) as client:
                resp = await client.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {settings.openrouter_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": SWEEP_MODEL,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.3,
                    },
                )
                resp.raise_for_status()
                content = resp.json()["choices"][0]["message"]["content"]

            # 3. Parse response
            raw = content.strip()
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            report = json.loads(raw.strip())

            # 4. Insert sweep_actions
            actions = report.get("actions", [])
            control_map = {c["nist_id"]: c["id"] for c in controls}

            for action in actions:
                nist_id = action.get("nist_id", "")
                pc_id = control_map.get(nist_id)
                if pc_id:
                    await conn.execute(
                        """
                        INSERT INTO sweep_actions
                          (sweep_id, program_control_id, nist_id, current_status,
                           priority_rank, recommended_action, gap_summary, confidence)
                        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
                        """,
                        sweep_id, pc_id, nist_id,
                        next((c["status"] for c in controls if c["nist_id"] == nist_id), "unknown"),
                        action.get("priority_rank", 99),
                        action.get("recommended_action", ""),
                        action.get("gap_summary", ""),
                        float(action.get("confidence", 0.7)),
                    )

            await conn.execute(
                """
                UPDATE program_sweeps
                SET status='ready', control_count=$1, sweep_report=$2, completed_at=now()
                WHERE id=$3
                """,
                len(controls),
                json.dumps(report),
                sweep_id,
            )

        except Exception as exc:
            import traceback as _tb
            from app.services import error_events_service
            logger.exception("background_task_failed", task="program_sweep", exc=str(exc))
            await conn.execute(
                "UPDATE program_sweeps SET status='failed', error_message=$1, completed_at=now() WHERE id=$2",
                str(exc)[:500],
                sweep_id,
            )
            await error_events_service.record(
                conn,
                source="fastapi",
                component="sweep_service.run_program_sweep",
                message=str(exc),
                severity="error",
                stack_trace=_tb.format_exc(),
            )
            raise
