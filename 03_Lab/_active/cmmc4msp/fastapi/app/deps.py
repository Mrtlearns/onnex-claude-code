"""Auth dependencies — validates JWTs and enforces 4-tier RBAC hierarchy.

Supports dual JWT algorithms:
  - HS256 with JWT_SECRET: used by test tokens and service-to-service calls
  - RS256 via JWKS: used by Authentik-issued tokens (OIDC flow from Next.js)
"""
import os
import json
import logging
import time
from functools import lru_cache

import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)
JWT_SECRET = os.getenv("JWT_SECRET", "")
ALGORITHM = "HS256"
JWKS_URL = os.getenv(
    "AUTHENTIK_JWKS_URL",
    "http://authentik-server:9000/application/o/cmmc4msp/jwks/",
)

# Ordered hierarchy — lower index = less privileged
ROLE_HIERARCHY = ["client_user", "client_admin", "msp_admin", "super_admin"]


def _role_rank(role: str) -> int:
    try:
        return ROLE_HIERARCHY.index(role)
    except ValueError:
        return -1


def _peek_alg(token: str) -> str:
    """Decode JWT header (no verification) to read the alg field."""
    try:
        header = jwt.get_unverified_header(token)
        return header.get("alg", "HS256")
    except Exception:
        return "HS256"


_jwks_cache: list[dict] = []
_jwks_fetched_at: float = 0.0
_JWKS_TTL = 300  # 5 minutes


def _fetch_jwks() -> list[dict]:
    """Fetch JWKS from Authentik with 5-minute in-memory cache."""
    global _jwks_cache, _jwks_fetched_at
    now = time.monotonic()
    if _jwks_cache and (now - _jwks_fetched_at) < _JWKS_TTL:
        return _jwks_cache
    try:
        resp = httpx.get(JWKS_URL, timeout=5.0)
        resp.raise_for_status()
        _jwks_cache = resp.json().get("keys", [])
        _jwks_fetched_at = now
        return _jwks_cache
    except Exception as exc:
        logger.warning("Failed to fetch JWKS from %s: %s", JWKS_URL, exc)
        return _jwks_cache


def _decode_rs256(token: str) -> dict:
    """Verify an RS256 JWT using Authentik's public JWK."""
    keys = _fetch_jwks()
    if not keys:
        raise HTTPException(status_code=401, detail="Unable to fetch JWKS for token verification")

    for key in keys:
        try:
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                options={"verify_aud": False},
            )
            return payload
        except JWTError:
            continue

    raise HTTPException(status_code=401, detail="RS256 JWT verification failed")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    try:
        alg = _peek_alg(token)

        if alg == "RS256":
            payload = _decode_rs256(token)
        else:
            payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])

        user_id: str = payload.get("sub")
        org_id: str = payload.get("org_id", "")
        role: str = payload.get("role", "client_user")
        msp_id: str = payload.get("msp_id", "")

        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        return {
            "user_id": user_id,
            "org_id": org_id,
            "role": role,
            "msp_id": msp_id,
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------------------------------------------------------------------------
# Role guard dependencies
# ---------------------------------------------------------------------------

async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    """Onnex internal staff only."""
    if user["role"] != "super_admin":
        raise HTTPException(status_code=403, detail="Onnex super admin required")
    return user


async def require_msp_admin(user: dict = Depends(get_current_user)) -> dict:
    """Allows super_admin or msp_admin."""
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(status_code=403, detail="MSP admin or above required")
    return user


async def require_client_admin_or_above(
    user: dict = Depends(get_current_user),
) -> dict:
    if _role_rank(user["role"]) < _role_rank("client_admin"):
        raise HTTPException(
            status_code=403,
            detail="Client admin or above required",
        )
    return user


# ---------------------------------------------------------------------------
# Scoped data-access helpers (called inside route handlers, not as Depends)
# ---------------------------------------------------------------------------

def require_same_org(org_id: str, user: dict) -> None:
    """
    Raises 403 if the user cannot access the given org.
    - super_admin / msp_admin: unrestricted (MSP scoping enforced separately)
    - client_admin / client_user: own org only
    """
    if user["role"] in ("super_admin", "msp_admin"):
        return
    if user.get("org_id") != org_id:
        raise HTTPException(
            status_code=403,
            detail="Access denied to this organization",
        )


def require_msp_owns_org(org_msp_id: str | None, user: dict) -> None:
    """
    For msp_admin: verifies the org belongs to the same MSP as the user.
    super_admin bypasses. Call after fetching the org row.
    """
    if user["role"] == "super_admin":
        return
    if user["role"] == "msp_admin":
        if str(org_msp_id or "") != str(user.get("msp_id") or ""):
            raise HTTPException(
                status_code=403,
                detail="This organization belongs to a different MSP",
            )
        return
    raise HTTPException(status_code=403, detail="Insufficient privileges")
