"""Evidence source integration service — 6 provider connectors."""
import base64
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
import asyncpg

from app.config import settings

VALID_PROVIDERS = {"entra_id", "okta", "defender", "crowdstrike", "o365", "splunk"}


def _get_credential(cred_value: str) -> str:
    """Decode base64 credential."""
    return base64.b64decode(cred_value).decode()


async def get_integration_credentials(
    integration_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> Optional[dict]:
    """Fetch the most recent credential for an integration."""
    row = await conn.fetchrow(
        """
        SELECT credential_type, encrypted_value, expires_at
        FROM integration_credentials
        WHERE integration_id = $1
        ORDER BY created_at DESC LIMIT 1
        """,
        integration_id,
    )
    if not row:
        return None
    return {
        "type": row["credential_type"],
        "value": _get_credential(row["encrypted_value"]),
        "expires_at": row["expires_at"],
    }


async def pull_entra_id_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull user list + conditional access policies from Microsoft Graph API."""
    token = cred["value"]
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        # Fetch users
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,accountEnabled",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            users = resp.json().get("value", [])
            evidence.append({
                "file_name": f"entra_id_user_roster_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "entra_id", "type": "user_roster", "users": users, "count": len(users)}),
                "controls": ["3.1.1", "3.1.2", "3.5.1"],  # AC + IA family controls
            })
        # Fetch conditional access policies
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            policies = resp.json().get("value", [])
            evidence.append({
                "file_name": f"entra_id_ca_policies_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "entra_id", "type": "conditional_access_policies", "policies": policies}),
                "controls": ["3.1.1", "3.3.1", "3.5.3"],
            })
    return evidence


async def pull_okta_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull Okta user list + MFA policies."""
    token = cred["value"]
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://api.okta.com/api/v1/users?limit=200",
            headers={"Authorization": f"SSWS {token}", "Accept": "application/json"},
        )
        if resp.status_code == 200:
            users = resp.json()
            evidence.append({
                "file_name": f"okta_user_roster_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "okta", "type": "user_roster", "users": users[:50], "count": len(users)}),
                "controls": ["3.1.1", "3.5.1", "3.5.2"],
            })
        resp = await client.get(
            "https://api.okta.com/api/v1/policies?type=MFA_ENROLL",
            headers={"Authorization": f"SSWS {token}", "Accept": "application/json"},
        )
        if resp.status_code == 200:
            policies = resp.json()
            evidence.append({
                "file_name": f"okta_mfa_policies_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "okta", "type": "mfa_policies", "policies": policies}),
                "controls": ["3.5.3"],
            })
    return evidence


async def pull_defender_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull Microsoft Defender endpoint security posture."""
    token = cred["value"]
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://api.securitycenter.microsoft.com/api/machines?$select=id,computerDnsName,osPlatform,riskScore,healthStatus",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            machines = resp.json().get("value", [])
            evidence.append({
                "file_name": f"defender_endpoint_posture_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "defender", "type": "endpoint_posture", "machines": machines[:50], "count": len(machines)}),
                "controls": ["3.14.1", "3.14.2", "3.11.2"],
            })
    return evidence


async def pull_crowdstrike_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull CrowdStrike Falcon device + detection summary."""
    token = cred["value"]
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://api.crowdstrike.com/devices/queries/devices/v1?limit=100",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            device_ids = resp.json().get("resources", [])
            evidence.append({
                "file_name": f"crowdstrike_device_inventory_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "crowdstrike", "type": "device_inventory", "device_ids": device_ids, "count": len(device_ids)}),
                "controls": ["3.14.1", "3.14.6", "3.11.3"],
            })
    return evidence


async def pull_o365_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull Office 365 Secure Score + DLP policies."""
    token = cred["value"]
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(
            "https://graph.microsoft.com/v1.0/security/secureScores?$top=1",
            headers={"Authorization": f"Bearer {token}"},
        )
        if resp.status_code == 200:
            scores = resp.json().get("value", [])
            evidence.append({
                "file_name": f"o365_secure_score_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "o365", "type": "secure_score", "scores": scores}),
                "controls": ["3.1.1", "3.13.1", "3.14.1"],
            })
    return evidence


async def pull_splunk_evidence(cred: dict, org_id: uuid.UUID) -> list[dict]:
    """Pull Splunk audit log summary."""
    token = cred["value"]
    instance_url = (cred.get("instance_url") or "").rstrip("/") or "https://splunk-instance"
    evidence = []
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            f"{instance_url}/services/search/jobs/export",
            headers={"Authorization": f"Splunk {token}", "Accept": "application/json"},
            data={"search": "search index=_audit | head 100 | table _time user action", "output_mode": "json"},
        )
        if resp.status_code == 200:
            logs = resp.text
            evidence.append({
                "file_name": f"splunk_audit_logs_{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
                "content": json.dumps({"source": "splunk", "type": "audit_logs", "sample": logs[:5000]}),
                "controls": ["3.3.1", "3.3.2"],
            })
    return evidence


PROVIDER_PULLERS = {
    "entra_id": pull_entra_id_evidence,
    "okta": pull_okta_evidence,
    "defender": pull_defender_evidence,
    "crowdstrike": pull_crowdstrike_evidence,
    "o365": pull_o365_evidence,
    "splunk": pull_splunk_evidence,
}


async def sync_integration(
    integration_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> dict:
    """
    Run one full sync cycle for an integration.
    Returns sync summary.
    """
    integration = await conn.fetchrow(
        "SELECT id, org_id, provider, instance_url FROM integrations WHERE id = $1 AND status = 'active'",
        integration_id,
    )
    if not integration:
        raise ValueError(f"Integration {integration_id} not found or not active")

    cred = await get_integration_credentials(integration_id, conn)
    if not cred:
        raise ValueError(f"No credentials for integration {integration_id}")

    # Pass instance_url into cred dict so provider pullers (e.g. Splunk) can use it
    cred["instance_url"] = integration["instance_url"] or ""

    puller = PROVIDER_PULLERS.get(integration["provider"])
    if not puller:
        raise ValueError(f"Unknown provider: {integration['provider']}")

    try:
        evidence_list = await puller(cred, integration["org_id"])
    except Exception as exc:
        await conn.execute(
            "UPDATE integrations SET status = 'error', last_error = $1, updated_at = NOW() WHERE id = $2",
            str(exc), integration_id,
        )
        await conn.execute(
            "INSERT INTO integration_sync_log (integration_id, status, error_detail) VALUES ($1, 'error', $2)",
            integration_id, str(exc),
        )
        raise

    artifacts_created = 0
    for ev in evidence_list:
        # Find ALL matching program_controls for this evidence item
        pc_rows = await conn.fetch(
            """
            SELECT pc.id FROM program_controls pc
            JOIN control_definitions cd ON pc.control_definition_id = cd.id
            JOIN programs p ON pc.program_id = p.id
            WHERE p.org_id = $1 AND cd.nist_id = ANY($2)
            """,
            integration["org_id"], ev.get("controls", []),
        )
        for pc_row in pc_rows:
            art_id = uuid.uuid4()
            await conn.execute(
                """
                INSERT INTO artifacts (id, file_name, mime_type, assessment_status, source_type, source_integration_id, program_control_id)
                VALUES ($1, $2, 'application/json', 'pending', $3, $4, $5)
                """,
                art_id, ev["file_name"], integration["provider"], integration_id, pc_row["id"],
            )
            artifacts_created += 1

    await conn.execute(
        "UPDATE integrations SET last_sync_at = NOW(), last_error = NULL, status = 'active', updated_at = NOW() WHERE id = $1",
        integration_id,
    )
    await conn.execute(
        "INSERT INTO integration_sync_log (integration_id, artifacts_created, status) VALUES ($1, $2, 'success')",
        integration_id, artifacts_created,
    )

    return {"artifacts_created": artifacts_created, "provider": integration["provider"]}
