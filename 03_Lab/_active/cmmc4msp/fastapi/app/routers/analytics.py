"""MSP Analytics router — portfolio-wide metrics for MSP admins (P5)."""
from __future__ import annotations

import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.deps import get_current_user

router = APIRouter()


@router.get("/msp-summary")
async def get_msp_summary(
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Return portfolio analytics for MSP admin or super_admin."""
    if user["role"] not in ("msp_admin", "super_admin"):
        raise HTTPException(403, "MSP admin role required")

    msp_id = user.get("msp_id") or None
    msp_uid = uuid.UUID(msp_id) if msp_id else None

    # 1. All orgs under this MSP with their programs + SPRS scores
    org_rows = await conn.fetch(
        """
        SELECT o.id, o.name, o.slug,
               COUNT(DISTINCT p.id) AS program_count,
               MAX(ss.score) AS latest_sprs,
               MAX(p.updated_at) AS last_activity_at
        FROM orgs o
        LEFT JOIN programs p ON o.id = p.org_id
        LEFT JOIN sprs_scores ss ON p.id = ss.program_id
        WHERE o.msp_id = $1
        GROUP BY o.id, o.name, o.slug
        ORDER BY o.name
        """,
        msp_uid,
    )

    # 2. Top failing controls across all orgs
    failing_rows = await conn.fetch(
        """
        SELECT cd.nist_id, cd.requirement_text, COUNT(*) AS fail_count
        FROM program_controls pc
        JOIN control_definitions cd ON pc.control_definition_id = cd.id
        JOIN programs p ON pc.program_id = p.id
        JOIN orgs o ON p.org_id = o.id
        WHERE o.msp_id = $1 AND pc.status IN ('not_implemented', 'partially_implemented')
        GROUP BY cd.nist_id, cd.requirement_text
        ORDER BY fail_count DESC
        LIMIT 10
        """,
        msp_uid,
    )

    # 3. Recent assessments across all orgs (last 7 days)
    recent_rows = await conn.fetch(
        """
        SELECT COUNT(*) AS assessed_this_week,
               SUM(CASE WHEN a.verdict = 'met' THEN 1 ELSE 0 END) AS met_this_week
        FROM assessments a
        JOIN artifacts ar ON a.artifact_id = ar.id
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        JOIN orgs o ON p.org_id = o.id
        WHERE o.msp_id = $1 AND a.created_at > NOW() - INTERVAL '7 days'
        """,
        msp_uid,
    )

    orgs_data = [
        {
            "id": str(r["id"]),
            "name": r["name"],
            "slug": r["slug"],
            "program_count": r["program_count"],
            "latest_sprs": r["latest_sprs"],
            "last_activity_at": r["last_activity_at"].isoformat() if r["last_activity_at"] else None,
        }
        for r in org_rows
    ]

    weekly = recent_rows[0] if recent_rows else None
    return {
        "orgs": orgs_data,
        "org_count": len(orgs_data),
        "top_failing_controls": [
            {
                "nist_id": r["nist_id"],
                "requirement_text": r["requirement_text"][:100],
                "fail_count": r["fail_count"],
            }
            for r in failing_rows
        ],
        "weekly_activity": {
            "assessed_this_week": weekly["assessed_this_week"] if weekly else 0,
            "met_this_week": weekly["met_this_week"] if weekly else 0,
        },
        "sprs_distribution": _sprs_histogram(orgs_data),
    }


def _sprs_histogram(orgs: list[dict]) -> dict:
    """Bin SPRS scores into named ranges."""
    bins: dict[str, int] = {
        "negative": 0,
        "zero_to_50": 0,
        "fifty_to_100": 0,
        "perfect": 0,
    }
    for org in orgs:
        score = org.get("latest_sprs")
        if score is None:
            continue
        if score < 0:
            bins["negative"] += 1
        elif score < 50:
            bins["zero_to_50"] += 1
        elif score < 110:
            bins["fifty_to_100"] += 1
        else:
            bins["perfect"] += 1
    return bins
