"""Notification preferences router."""
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user
from app.services.email_service import VALID_CATEGORIES

router = APIRouter()

CATEGORIES = list(VALID_CATEGORIES)


class PrefUpdate(BaseModel):
    preferences: dict[str, bool]  # {"assignment": True, "invite": False}


@router.get("/preferences")
async def get_preferences(
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Get all notification preferences for current user."""
    rows = await conn.fetch(
        "SELECT category, enabled FROM user_notification_preferences WHERE user_id = $1",
        uuid.UUID(user["user_id"]),
    )
    saved = {r["category"]: r["enabled"] for r in rows}
    # Fill in defaults (True) for categories not yet saved
    prefs = {cat: saved.get(cat, True) for cat in CATEGORIES}
    return {"preferences": prefs}


@router.patch("/preferences")
async def update_preferences(
    body: PrefUpdate,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Upsert notification preferences."""
    invalid = set(body.preferences) - VALID_CATEGORIES
    if invalid:
        raise HTTPException(400, f"Unknown categories: {', '.join(sorted(invalid))}")

    user_uid = uuid.UUID(user["user_id"])
    for category, enabled in body.preferences.items():
        await conn.execute(
            """
            INSERT INTO user_notification_preferences (user_id, category, enabled)
            VALUES ($1, $2, $3)
            ON CONFLICT (user_id, category) DO UPDATE SET enabled = $3, updated_at = NOW()
            """,
            user_uid, category, enabled,
        )
    return {"updated": list(body.preferences.keys())}


@router.get("/unsubscribe/{token}")
async def unsubscribe(
    token: str,
    conn: asyncpg.Connection = Depends(get_db),
) -> dict:
    """Public unsubscribe link — disables ALL email for this token's user."""
    user = await conn.fetchrow(
        "SELECT id FROM users WHERE unsubscribe_token = $1", token
    )
    if not user:
        raise HTTPException(404, "Invalid unsubscribe token")

    for cat in VALID_CATEGORIES:
        await conn.execute(
            """
            INSERT INTO user_notification_preferences (user_id, category, enabled)
            VALUES ($1, $2, FALSE)
            ON CONFLICT (user_id, category) DO UPDATE SET enabled = FALSE, updated_at = NOW()
            """,
            user["id"], cat,
        )
    return {"message": "You have been unsubscribed from all emails."}
