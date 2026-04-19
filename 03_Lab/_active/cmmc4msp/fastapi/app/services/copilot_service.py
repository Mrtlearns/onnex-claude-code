"""Compliance Copilot — RAG context assembly and OpenRouter streaming."""
from __future__ import annotations

import json
from typing import AsyncIterator
from uuid import UUID

import asyncpg
import httpx

from app.config import settings
from app.services.embeddings_service import embed_one

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
COPILOT_MODEL = "anthropic/claude-sonnet-4-6"


async def build_context(
    program_control_id: UUID,
    user_message: str,
    org_id: str,
    conn: asyncpg.Connection,
) -> tuple[str, str]:
    """
    Assemble RAG context from 4 sources.
    Returns (system_prompt, context_text).
    """
    # 1. Control + program info
    control = await conn.fetchrow(
        """
        SELECT cd.nist_id, cd.requirement_text, cd.assessment_objective,
               cd.acceptable_proof_guidance, pc.status, pc.implementation_notes,
               p.name AS program_name, o.name AS org_name
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        JOIN programs p ON pc.program_id = p.id
        JOIN orgs o ON p.org_id = o.id
        WHERE pc.id = $1
        """,
        program_control_id,
    )
    if not control:
        return "", ""

    # 2. Org artifacts for this control
    artifacts = await conn.fetch(
        """
        SELECT ar.id, ar.file_name, a.verdict, a.rationale, a.gaps
        FROM artifacts ar
        JOIN assessments a ON a.artifact_id = ar.id
        WHERE ar.program_control_id = $1
        ORDER BY a.created_at DESC LIMIT 5
        """,
        program_control_id,
    )

    # 3. Similar artifact chunks from this org (cosine similarity > 0.6)
    #    Skip when embedding is all zeros to avoid zero-vector cosine issues.
    query_vec = await embed_one(user_message)
    if any(v != 0.0 for v in query_vec):
        similar_chunks = await conn.fetch(
            """
            SELECT ac.chunk_text, ar.file_name, ar.id AS artifact_id
            FROM artifact_chunks ac
            JOIN artifacts ar ON ac.artifact_id = ar.id
            JOIN program_controls pc ON ar.program_control_id = pc.id
            JOIN programs p ON pc.program_id = p.id
            WHERE p.org_id = $1
              AND 1 - (ac.embedding <=> $2::vector) > 0.6
            ORDER BY ac.embedding <=> $2::vector
            LIMIT 8
            """,
            org_id,
            str(query_vec),
        )
    else:
        similar_chunks = []

    # 4. NIST SP 800-171A guide chunks for this control
    nist_chunks = await conn.fetch(
        "SELECT chunk_text, section FROM nist_guide_chunks WHERE nist_id = $1 ORDER BY chunk_index",
        control["nist_id"],
    )

    # Build context string
    context_parts = []

    control_text = (
        f"CONTROL: {control['nist_id']}\n"
        f"REQUIREMENT: {control['requirement_text']}\n"
        f"ASSESSMENT OBJECTIVE: {control['assessment_objective'] or 'N/A'}\n"
        f"ACCEPTABLE PROOF: {control['acceptable_proof_guidance'] or 'N/A'}\n"
        f"CURRENT STATUS: {control['status']}\n"
    )
    if control["implementation_notes"]:
        control_text += f"IMPLEMENTATION NOTES: {control['implementation_notes']}\n"
    context_parts.append(f"=== CONTROL DEFINITION ===\n{control_text}")

    if artifacts:
        art_lines = []
        for a in artifacts:
            art_lines.append(
                f"- File: {a['file_name']} (ID: {a['id']}) | Verdict: {a['verdict']}\n"
                f"  Rationale: {(a['rationale'] or '')[:300]}\n"
                f"  Gaps: {(a['gaps'] or '')[:200]}"
            )
        context_parts.append("=== ORG'S UPLOADED EVIDENCE ===\n" + "\n".join(art_lines))

    if similar_chunks:
        chunk_lines = [
            f"- From '{c['file_name']}': {c['chunk_text'][:400]}"
            for c in similar_chunks
        ]
        context_parts.append("=== RELEVANT EVIDENCE EXCERPTS ===\n" + "\n".join(chunk_lines))

    if nist_chunks:
        nist_lines = [
            f"[{c['section'] or 'General'}] {c['chunk_text'][:500]}"
            for c in nist_chunks
        ]
        context_parts.append("=== NIST SP 800-171A GUIDANCE ===\n" + "\n".join(nist_lines))

    context_text = "\n\n".join(context_parts)

    system_prompt = (
        f"You are a CMMC Level 2 compliance advisor for {control['org_name']}, "
        f"an organization pursuing NIST SP 800-171 compliance. "
        f"You are assisting with control {control['nist_id']}: {control['requirement_text']}.\n\n"
        "IMPORTANT RULES:\n"
        "- Only make claims grounded in the provided context. Do not invent requirements.\n"
        "- When citing an artifact, reference it by file name and ID.\n"
        "- When citing NIST guidance, prefix with 'Per NIST SP 800-171A:'.\n"
        "- If unsure, say so and recommend consulting the MSP advisor.\n"
        "- Be concise but thorough. Use bullet points for lists of requirements.\n"
        "- Never provide legal advice or guarantee C3PAO assessment outcomes.\n\n"
        f"{context_text}"
    )

    return system_prompt, context_text


async def stream_chat(
    system_prompt: str,
    messages: list[dict],
    user_message: str,
) -> AsyncIterator[str]:
    """
    Stream chat completion from OpenRouter.
    Yields SSE-formatted chunks. Yields a final JSON line with usage stats.
    """
    if not settings.openrouter_api_key:
        yield "data: No OpenRouter API key configured.\n\n"
        return

    payload = {
        "model": COPILOT_MODEL,
        "stream": True,
        "messages": [
            {"role": "system", "content": system_prompt},
            *messages,
            {"role": "user", "content": user_message},
        ],
    }

    async with httpx.AsyncClient(timeout=60) as client:
        async with client.stream(
            "POST",
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            content=json.dumps(payload),
        ) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line.startswith("data: "):
                    payload_str = line[6:]
                    if payload_str == "[DONE]":
                        yield "data: [DONE]\n\n"
                        return
                    try:
                        chunk_data = json.loads(payload_str)
                        delta = chunk_data["choices"][0]["delta"].get("content", "")
                        if delta:
                            yield f"data: {json.dumps({'content': delta})}\n\n"
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
