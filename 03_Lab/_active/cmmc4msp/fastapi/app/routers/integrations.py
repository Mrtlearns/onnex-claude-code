"""Evidence source integrations router."""
import base64
import uuid
from typing import Optional

import asyncpg
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.logging_config import get_logger
from app.services import error_events_service
from app.services.background import run_with_pool

logger = get_logger(__name__)

router = APIRouter()

VALID_PROVIDERS = {"entra_id", "okta", "defender", "crowdstrike", "o365", "splunk"}


class CreateIntegrationRequest(BaseModel):
    org_id: str
    provider: str
    display_name: Optional[str] = None
    credential_type: str = "api_key"
    credential_value: str  # raw value — will be base64-encoded before storing


class UpdateCredentialRequest(BaseModel):
    credential_type: str = "api_key"
    credential_value: str


@router.post("", status_code=201)
async def create_integration(
    body: CreateIntegrationRequest,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Create or update an integration for an org. MSP admin or client admin."""
    if body.provider not in VALID_PROVIDERS:
        raise HTTPException(400, f"Unknown provider. Valid: {', '.join(sorted(VALID_PROVIDERS))}")
    try:
        org_uid = uuid.UUID(body.org_id)
    except ValueError:
        raise HTTPException(422, "Invalid org_id")

    org = await conn.fetchrow("SELECT id FROM orgs WHERE id = $1", org_uid)
    if not org:
        raise HTTPException(404, "Org not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(org_uid) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    # Upsert integration
    integration_id = uuid.uuid4()
    existing = await conn.fetchrow(
        "SELECT id FROM integrations WHERE org_id = $1 AND provider = $2", org_uid, body.provider
    )
    if existing:
        integration_id = existing["id"]
        await conn.execute(
            "UPDATE integrations SET display_name = $1, status = 'active', updated_at = NOW() WHERE id = $2",
            body.display_name or body.provider, integration_id,
        )
    else:
        await conn.execute(
            "INSERT INTO integrations (id, org_id, provider, display_name) VALUES ($1, $2, $3, $4)",
            integration_id, org_uid, body.provider, body.display_name or body.provider,
        )

    # Store credential (base64-encoded)
    encoded = base64.b64encode(body.credential_value.encode()).decode()
    await conn.execute(
        "INSERT INTO integration_credentials (integration_id, credential_type, encrypted_value) VALUES ($1, $2, $3)",
        integration_id, body.credential_type, encoded,
    )

    return {"integration_id": str(integration_id), "provider": body.provider, "status": "active"}


@router.get("")
async def list_integrations(
    org_id: Optional[str] = None,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """List integrations for an org."""
    if org_id:
        try:
            org_uid = uuid.UUID(org_id)
        except ValueError:
            raise HTTPException(422, "Invalid org_id")
    else:
        if not user.get("org_id"):
            raise HTTPException(400, "org_id required")
        org_uid = uuid.UUID(user["org_id"])

    if user["role"] not in ("msp_admin", "super_admin") and str(org_uid) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT id, provider, display_name, status, last_sync_at, last_error, created_at
        FROM integrations WHERE org_id = $1 ORDER BY provider
        """,
        org_uid,
    )
    return {
        "integrations": [
            {
                "id": str(r["id"]),
                "provider": r["provider"],
                "display_name": r["display_name"],
                "status": r["status"],
                "last_sync_at": r["last_sync_at"].isoformat() if r["last_sync_at"] else None,
                "last_error": r["last_error"],
            }
            for r in rows
        ]
    }


@router.post("/{integration_id}/sync", status_code=202)
async def trigger_sync(
    integration_id: str,
    request: Request,
    background_tasks: BackgroundTasks,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Trigger a manual sync for an integration."""
    try:
        int_uid = uuid.UUID(integration_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    integration = await conn.fetchrow(
        "SELECT id, org_id FROM integrations WHERE id = $1", int_uid
    )
    if not integration:
        raise HTTPException(404, "Integration not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(integration["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    pool = request.app.state.pool
    correlation_id = getattr(request.state, "correlation_id", None)
    org_id = str(integration["org_id"]) if integration["org_id"] else None

    async def _sync(conn: asyncpg.Connection) -> None:
        from app.services.integration_service import sync_integration
        await sync_integration(int_uid, conn)

    async def _on_sync_error(conn: asyncpg.Connection, exc: Exception) -> None:
        await conn.execute(
            "UPDATE integrations SET status='error', error_message=$1 WHERE id=$2",
            str(exc)[:2000], int_uid,
        )

    background_tasks.add_task(
        run_with_pool, pool, _sync,
        component="integrations.sync",
        correlation_id=correlation_id,
        org_id=org_id,
        on_error=_on_sync_error,
    )
    return {"status": "syncing", "integration_id": integration_id}


@router.delete("/{integration_id}", status_code=204)
async def revoke_integration(
    integration_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> None:
    """Revoke/disable an integration."""
    try:
        int_uid = uuid.UUID(integration_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    integration = await conn.fetchrow(
        "SELECT id, org_id FROM integrations WHERE id = $1", int_uid
    )
    if not integration:
        raise HTTPException(404, "Integration not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(integration["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    await conn.execute(
        "UPDATE integrations SET status = 'revoked', updated_at = NOW() WHERE id = $1", int_uid
    )


@router.get("/{integration_id}/sync-history")
async def get_sync_history(
    integration_id: str,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get sync history for an integration."""
    try:
        int_uid = uuid.UUID(integration_id)
    except ValueError:
        raise HTTPException(422, "Invalid UUID")

    integration = await conn.fetchrow(
        "SELECT id, org_id FROM integrations WHERE id = $1", int_uid
    )
    if not integration:
        raise HTTPException(404, "Integration not found")
    if user["role"] not in ("msp_admin", "super_admin") and str(integration["org_id"]) != user.get("org_id"):
        raise HTTPException(403, "Access denied")

    rows = await conn.fetch(
        """
        SELECT id, synced_at, artifacts_created, artifacts_updated, status, error_detail
        FROM integration_sync_log
        WHERE integration_id = $1
        ORDER BY synced_at DESC LIMIT 20
        """,
        int_uid,
    )
    return {
        "history": [
            {
                "id": str(r["id"]),
                "synced_at": r["synced_at"].isoformat(),
                "artifacts_created": r["artifacts_created"],
                "artifacts_updated": r["artifacts_updated"],
                "status": r["status"],
                "error_detail": r["error_detail"],
            }
            for r in rows
        ]
    }
