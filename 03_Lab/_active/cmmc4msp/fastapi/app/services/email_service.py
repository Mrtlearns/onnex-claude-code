"""Email delivery via Resend REST API."""
import uuid

import httpx

from app.config import settings

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "no-reply@cmmc4msp.on-nex.us"

VALID_CATEGORIES = {
    "invite", "assignment", "poam_deadline",
    "weekly_digest", "phase_unlock", "assessment_complete",
}


async def send_email(
    to: str,
    subject: str,
    html: str,
    category: str,
    reference_id: str | None = None,
    conn=None,  # asyncpg connection for logging; optional
) -> str:
    """Send via Resend. Logs to email_log if conn provided. Returns provider message ID."""
    if not settings.resend_api_key:
        return "no-key"

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(
            RESEND_API_URL,
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json={"from": FROM_ADDRESS, "to": to, "subject": subject, "html": html},
        )
        resp.raise_for_status()
        provider_id = resp.json().get("id", "")

    if conn is not None:
        await conn.execute(
            """
            INSERT INTO email_log (recipient_email, category, subject, reference_id, provider_id)
            VALUES ($1, $2, $3, $4, $5)
            """,
            to, category, subject,
            uuid.UUID(reference_id) if reference_id else None,
            provider_id,
        )

    return provider_id


async def check_preference(user_id: str, category: str, conn) -> bool:
    """Returns True if user has this category enabled (default True if no pref row)."""
    row = await conn.fetchrow(
        "SELECT enabled FROM user_notification_preferences WHERE user_id = $1 AND category = $2",
        user_id, category,
    )
    return row["enabled"] if row else True
