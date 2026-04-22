"""Policy draft generation service — OpenRouter + DOCX conversion."""
from __future__ import annotations

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
import asyncpg

from app.config import settings
from app.logging_config import get_logger
from app.services.docx_service import markdown_to_docx
from app.services.minio_service import upload_bytes

logger = get_logger(__name__)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DRAFT_MODEL = "anthropic/claude-opus-4-7"
DRAFTS_BUCKET = "cmmc-drafts"


async def build_policy_context(
    program_control_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> dict:
    """Assemble context for policy generation from DB."""
    control = await conn.fetchrow(
        """
        SELECT cd.nist_id, cd.requirement_text, cd.assessment_objective,
               cd.acceptable_proof_guidance, cd.is_objective,
               pc.implementation_notes, pc.program_id,
               p.name AS program_name, p.system_name, p.cmmc_level,
               o.id AS org_id, o.name AS org_name, o.cage_code
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        JOIN programs p ON pc.program_id = p.id
        JOIN orgs o ON p.org_id = o.id
        WHERE pc.id = $1
        """,
        program_control_id,
    )
    if not control:
        return {}

    hardware = await conn.fetch(
        "SELECT asset_name, asset_type, os FROM hardware_inventory WHERE org_id = $1 LIMIT 15",
        control["org_id"],
    )
    software = await conn.fetch(
        "SELECT name, version, purpose FROM software_inventory WHERE org_id = $1 LIMIT 15",
        control["org_id"],
    )
    cloud = await conn.fetch(
        "SELECT provider, service_name, purpose FROM cloud_services_inventory WHERE org_id = $1 LIMIT 10",
        control["org_id"],
    )
    objectives = await conn.fetch(
        """
        SELECT requirement_text, assessment_objective FROM control_definitions
        WHERE nist_id LIKE $1 AND is_objective = TRUE ORDER BY nist_id
        """,
        control["nist_id"] + ".%",
    )
    nist_chunks = await conn.fetch(
        "SELECT chunk_text FROM nist_guide_chunks WHERE nist_id = $1 ORDER BY chunk_index LIMIT 5",
        control["nist_id"],
    )

    return {
        "control": dict(control),
        "hardware": [dict(r) for r in hardware],
        "software": [dict(r) for r in software],
        "cloud": [dict(r) for r in cloud],
        "objectives": [dict(r) for r in objectives],
        "nist_chunks": [r["chunk_text"] for r in nist_chunks],
    }


def _build_prompt(ctx: dict) -> str:
    ctrl = ctx["control"]
    hw_summary = ", ".join(r["asset_name"] for r in ctx["hardware"][:5]) or "Not specified"
    sw_summary = ", ".join(r["name"] for r in ctx["software"][:5]) or "Not specified"
    cloud_summary = (
        ", ".join(f"{r['provider']} {r['service_name']}" for r in ctx["cloud"])
        or "Not specified"
    )
    objectives_text = (
        "\n".join(f"- {r['requirement_text']}" for r in ctx["objectives"])
        or ctrl["requirement_text"]
    )
    nist_text = (
        "\n\n".join(ctx["nist_chunks"][:3]) or "No additional guidance available."
    )
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    cmmc_level = ctrl.get("cmmc_level", 2)
    nist_std = "NIST SP 800-171 Rev 2" if cmmc_level == 2 else "NIST SP 800-172"
    return f"""You are a CMMC Level {cmmc_level} compliance policy writer targeting {nist_std}. Generate a complete, professionally written policy document.

ORGANIZATION:
- Name: {ctrl['org_name']}
- CAGE Code: {ctrl.get('cage_code') or 'TBD'}
- System Name: {ctrl.get('system_name') or 'Primary Information System'}
- Hardware: {hw_summary}
- Software: {sw_summary}
- Cloud Services: {cloud_summary}

CONTROL TO ADDRESS:
- NIST ID: {ctrl['nist_id']}
- Requirement: {ctrl['requirement_text']}
- Objectives that must be addressed:
{objectives_text}

NIST SP 800-171A IMPLEMENTATION GUIDANCE:
{nist_text}

DOCUMENT REQUIREMENTS:
1. Title: "{ctrl['org_name']} {ctrl['nist_id']} Policy"
2. Revision: 1.0 | Date: {today}
3. Approved by: [APPROVER NAME]
4. Sections: Purpose, Scope, Policy Statements (one per objective), Procedures, Roles and Responsibilities, Exceptions, Review Schedule, References
5. Reference actual systems from the inventory by name where relevant
6. Policy statements must directly map to the NIST objectives listed above
7. Use plain English for a small defense contractor
8. Length: 800–1500 words
9. Format: Markdown with # H1, ## H2, ### H3, **bold**, - bullet lists

Generate the complete policy document now."""


async def generate_policy_draft(
    program_control_id: uuid.UUID,
    generated_by: uuid.UUID,
    conn: asyncpg.Connection,
    minio,
) -> uuid.UUID:
    """
    Generate a policy draft:
    1. Build context from DB
    2. Call OpenRouter (claude-opus-4-7) or use offline mode
    3. Save markdown to policy_drafts table
    4. Convert to DOCX + upload to MinIO (non-fatal if fails)
    Returns draft_id.
    """
    ctx = await build_policy_context(program_control_id, conn)
    if not ctx:
        raise ValueError(f"program_control {program_control_id} not found")

    prompt = _build_prompt(ctx)

    if settings.openrouter_api_key:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                OPENROUTER_URL,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": DRAFT_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 2048,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            markdown_content = data["choices"][0]["message"]["content"]
    else:
        markdown_content = (
            f"# {ctx['control']['org_name']} Policy Draft\n\n"
            "*Generated in offline mode — configure OPENROUTER_API_KEY for real generation.*\n\n"
            f"## Purpose\n\nThis policy addresses {ctx['control']['nist_id']}: "
            f"{ctx['control']['requirement_text']}\n"
        )

    content_hash = hashlib.sha256(markdown_content.encode()).hexdigest()
    draft_id = uuid.uuid4()

    await conn.execute(
        """
        INSERT INTO policy_drafts
            (id, program_control_id, generated_by, content_markdown, content_hash, model_used, generation_params)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        """,
        draft_id,
        program_control_id,
        generated_by,
        markdown_content,
        content_hash,
        DRAFT_MODEL,
        json.dumps(
            {
                "nist_id": ctx["control"]["nist_id"],
                "org_name": ctx["control"]["org_name"],
            }
        ),
    )

    # Convert to DOCX + upload — non-fatal if anything fails
    try:
        docx_bytes = markdown_to_docx(
            markdown_content,
            org_name=ctx["control"]["org_name"],
            control_id=ctx["control"]["nist_id"],
        )
        minio_key = f"{program_control_id}/{draft_id}/policy.docx"
        upload_bytes(
            minio,
            DRAFTS_BUCKET,
            minio_key,
            docx_bytes,
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )
        await conn.execute(
            "UPDATE policy_drafts SET minio_key = $1 WHERE id = $2",
            minio_key,
            draft_id,
        )
    except Exception as exc:
        import traceback as _tb
        from app.services import error_events_service
        logger.exception("background_task_failed", task="policy_draft_docx_upload", exc=str(exc))
        await error_events_service.record(
            conn,
            source="fastapi",
            component="policy_draft_service.generate",
            message=str(exc),
            severity="error",
            stack_trace=_tb.format_exc(),
        )
        await conn.execute(
            "UPDATE policy_drafts SET error_message=$1 WHERE id=$2",
            str(exc)[:2000],
            draft_id,
        )
        # DOCX upload failure is non-fatal; markdown still usable

    return draft_id
