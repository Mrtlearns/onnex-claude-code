"""SSP Narrative Generation via Conversational Interview."""
from __future__ import annotations

import json
import uuid
from datetime import date

import httpx
import asyncpg

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
SSP_MODEL = "anthropic/claude-sonnet-4-6"

# 5 SSP sections, each mapped to interview questions
SECTIONS: dict[str, dict] = {
    "system_description": {
        "label": "System Description",
        "questions": [
            {"id": "q1", "text": "What is the primary purpose of the system covered by this SSP? In a sentence or two, describe what it does."},
            {"id": "q2", "text": "What does this system allow your organization to do that relates to your DoD work or contracts?"},
            {"id": "q3", "text": "How many users interact with this system, and what are their primary roles?"},
            {"id": "q4", "text": "Is this a single system or a collection of systems/applications that work together?"},
        ],
    },
    "environment_of_operation": {
        "label": "Environment of Operation",
        "questions": [
            {"id": "q5", "text": "Where is your system hosted? (On-premises servers, cloud like Azure/AWS/GCP, or a mix?)"},
            {"id": "q6", "text": "Walk me through how an employee accesses the system — from sitting at their desk to getting to their work."},
            {"id": "q7", "text": "Are there any remote access scenarios? VPN, remote desktop, work-from-home?"},
            {"id": "q8", "text": "What physical locations house your systems or the people who use them?"},
        ],
    },
    "information_types": {
        "label": "CUI Information Types",
        "questions": [
            {"id": "q9", "text": "What types of information does this system handle that relate to your DoD contracts? (e.g., drawings, specifications, test results, proposals)"},
            {"id": "q10", "text": "Does this system create, store, process, or transmit technical data — like engineering drawings or performance specs?"},
        ],
    },
    "security_requirements": {
        "label": "Security Requirements",
        "questions": [
            {"id": "q11", "text": "How do employees log in to the system? Username/password only, or multi-factor authentication?"},
            {"id": "q12", "text": "Who is responsible for IT security in your organization? Is it an internal IT person, or a managed service provider?"},
            {"id": "q13", "text": "What happens when someone leaves the organization — how quickly are their accounts disabled?"},
        ],
    },
    "interconnections": {
        "label": "Interconnections",
        "questions": [
            {"id": "q14", "text": "Does your system connect to or share information with any other systems — like a cloud storage service, a client portal, or a subcontractor's network?"},
            {"id": "q15", "text": "Do any of your systems receive automatic software updates from external sources?"},
        ],
    },
}

SSP_FIELD_MAP: dict[str, str] = {
    "system_description": "ssp_system_description",
    "environment_of_operation": "ssp_environment_of_operation",
    "information_types": "ssp_information_types",
    "security_requirements": "ssp_security_requirements",
    "interconnections": "ssp_interconnections",
}


async def pre_populate_from_inventory(
    program_id: uuid.UUID, conn: asyncpg.Connection
) -> dict:
    """Return pre-populated answers from inventory tables."""
    program = await conn.fetchrow(
        "SELECT p.system_name, o.name AS org_name FROM programs p JOIN orgs o ON p.org_id = o.id WHERE p.id = $1",
        program_id,
    )
    hw = await conn.fetch(
        "SELECT asset_name, asset_type FROM hardware_inventory WHERE org_id = (SELECT org_id FROM programs WHERE id = $1) LIMIT 5",
        program_id,
    )
    cloud = await conn.fetch(
        "SELECT provider, service_name FROM cloud_services_inventory WHERE org_id = (SELECT org_id FROM programs WHERE id = $1) LIMIT 5",
        program_id,
    )
    users = await conn.fetchval(
        "SELECT COUNT(*) FROM users WHERE org_id = (SELECT org_id FROM programs WHERE id = $1)",
        program_id,
    )

    pre: dict[str, str] = {}
    if program:
        if program["system_name"]:
            pre["q1"] = (
                f"The system, {program['system_name']}, supports "
                f"{program['org_name']}'s DoD contract work."
            )
        if hw:
            pre["q4"] = (
                f"The system includes {len(hw)} hardware assets: "
                + ", ".join(r["asset_name"] for r in hw[:3])
            )
        if cloud:
            pre["q5"] = "Cloud-hosted using " + ", ".join(
                f"{r['provider']} {r['service_name']}" for r in cloud[:3]
            )
        if users:
            pre["q3"] = f"Approximately {users} users across various roles."

    return pre


async def generate_section(
    section: str,
    responses: dict,
    program: dict,
    conn: asyncpg.Connection,
) -> str:
    """Generate narrative for one SSP section."""
    section_def = SECTIONS.get(section)
    if not section_def:
        raise ValueError(f"Unknown section: {section}")

    # Gather relevant Q&A for this section
    qa_pairs = []
    for q in section_def["questions"]:
        answer = responses.get(q["id"], "")
        if answer:
            qa_pairs.append(f"Q: {q['text']}\nA: {answer}")

    qa_text = "\n\n".join(qa_pairs) if qa_pairs else "No answers provided."

    prompt = f"""Based on the following interview answers, write a professional {section_def['label']} section for a NIST SP 800-171 System Security Plan.

ORGANIZATION: {program.get('org_name', 'Unknown')} | CAGE Code: {program.get('cage_code', 'TBD')}
PROGRAM: {program.get('program_name', 'Unknown')} | System: {program.get('system_name', 'Primary Information System')}

INTERVIEW ANSWERS:
{qa_text}

REQUIREMENTS:
- 200–400 words
- Professional, formal tone appropriate for DoD documentation
- Reference the organization name and system name explicitly
- Do not fabricate specific technical details not provided in the interview answers
- Do not use passive constructions or the phrase "it should be noted"
- End with a sentence about the organization's commitment to protecting CUI

Write the {section_def['label']} section now."""

    if not settings.openrouter_api_key:
        return (
            f"[{section_def['label']}]\n\n"
            f"{program.get('org_name', 'The organization')} maintains a comprehensive approach to "
            f"{section.replace('_', ' ')}. This section will be completed upon MSP review.\n\n"
            f"(Configure OPENROUTER_API_KEY for AI-generated narrative.)"
        )

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": SSP_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 800,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]
