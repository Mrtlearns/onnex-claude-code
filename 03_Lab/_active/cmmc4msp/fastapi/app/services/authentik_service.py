"""Authentik API wrapper — user lifecycle for invite acceptance.

Handles user creation via the Authentik REST API v3.
Requires AUTHENTIK_URL and AUTHENTIK_API_TOKEN in environment.

Raises AuthentikError on all API-level failures so callers can translate
to appropriate HTTP responses without catching generic exceptions.
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class AuthentikError(Exception):
    """Raised when Authentik API returns an error or is unreachable."""


async def create_user(
    email: str,
    full_name: str,
    password: str,
    username: str | None = None,
) -> str:
    """Create a user in Authentik and return the Authentik user PK (string UUID).

    The user is created in the default tenant and immediately active.
    A password is set via a separate call after creation.
    """
    if not settings.authentik_url or not settings.authentik_api_token:
        raise AuthentikError("Authentik integration not configured (AUTHENTIK_URL/AUTHENTIK_API_TOKEN missing)")

    uname = username or email.split("@")[0].lower().replace(".", "_")

    headers = {
        "Authorization": f"Bearer {settings.authentik_api_token}",
        "Content-Type": "application/json",
    }
    base = settings.authentik_url.rstrip("/")

    async with httpx.AsyncClient(timeout=15) as client:
        # 1. Create core user
        create_resp = await client.post(
            f"{base}/api/v3/core/users/",
            headers=headers,
            json={
                "username": uname,
                "name": full_name,
                "email": email,
                "is_active": True,
                "groups": [],
            },
        )

        if create_resp.status_code == 400:
            detail = create_resp.json()
            # username collision — retry with uuid suffix
            if "username" in detail:
                import uuid as _uuid
                uname = f"{uname}_{_uuid.uuid4().hex[:6]}"
                create_resp = await client.post(
                    f"{base}/api/v3/core/users/",
                    headers=headers,
                    json={
                        "username": uname,
                        "name": full_name,
                        "email": email,
                        "is_active": True,
                        "groups": [],
                    },
                )

        if create_resp.status_code not in (200, 201):
            logger.error("Authentik create user failed: %s %s", create_resp.status_code, create_resp.text)
            raise AuthentikError(f"Failed to create Authentik user (HTTP {create_resp.status_code})")

        user_data = create_resp.json()
        authentik_pk = str(user_data["pk"])

        # 2. Set password
        pwd_resp = await client.post(
            f"{base}/api/v3/core/users/{authentik_pk}/set_password/",
            headers=headers,
            json={"password": password},
        )
        if pwd_resp.status_code not in (200, 204):
            logger.error("Authentik set_password failed HTTP %s — rolling back user %s", pwd_resp.status_code, authentik_pk)
            # Best-effort cleanup: delete the user we just created
            try:
                await client.delete(
                    f"{base}/api/v3/core/users/{authentik_pk}/",
                    headers=headers,
                )
            except Exception:
                pass
            raise AuthentikError(f"Failed to set password for Authentik user (HTTP {pwd_resp.status_code})")

    return authentik_pk


async def _delete_user_best_effort(authentik_pk: str) -> None:
    """Best-effort Authentik user deletion — used for rollback on DB failure."""
    if not settings.authentik_url or not settings.authentik_api_token:
        return
    headers = {"Authorization": f"Bearer {settings.authentik_api_token}"}
    base = settings.authentik_url.rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.delete(f"{base}/api/v3/core/users/{authentik_pk}/", headers=headers)
    except Exception:
        logger.warning("Best-effort Authentik user delete failed for pk=%s", authentik_pk)


async def get_user_by_email(email: str) -> dict | None:
    """Look up an Authentik user by email. Returns the user dict or None."""
    if not settings.authentik_url or not settings.authentik_api_token:
        return None

    headers = {"Authorization": f"Bearer {settings.authentik_api_token}"}
    base = settings.authentik_url.rstrip("/")

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(
            f"{base}/api/v3/core/users/",
            headers=headers,
            params={"search": email},
        )
        if resp.status_code != 200:
            return None
        results = resp.json().get("results", [])
        for user in results:
            if user.get("email", "").lower() == email.lower():
                return user
    return None
