"""Evidence drift detection service (A3).

Compares a re-embedded artifact against its stored baseline embedding.
When semantic drift exceeds the threshold, records the event and flags the
control so reviewers can inspect the change.
"""
from __future__ import annotations

import json
import uuid
from typing import Optional

import httpx
import numpy as np
import asyncpg

from app.config import settings
from app.services.embeddings_service import embed_one

DRIFT_MODEL = "anthropic/claude-haiku-4-5"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_DRIFT_THRESHOLD = 0.15


def cosine_distance(a: list[float], b: list[float]) -> float:
    """Return 1 - cosine_similarity. Range [0, 1]. Higher = more different."""
    va = np.array(a, dtype=float)
    vb = np.array(b, dtype=float)
    norm_a = float(np.linalg.norm(va))
    norm_b = float(np.linalg.norm(vb))
    if norm_a == 0 or norm_b == 0:
        return 1.0
    return float(1.0 - np.dot(va, vb) / (norm_a * norm_b))


async def generate_drift_summary(
    original_text: str,
    current_text: str,
    drift_score: float,
) -> str:
    """Call Claude Haiku via OpenRouter to produce a human-readable drift summary.

    Falls back to a plain-text description when no API key is configured.
    """
    if not settings.openrouter_api_key:
        return (
            f"Semantic drift score: {drift_score:.2f}. "
            "Manual review recommended."
        )

    prompt = (
        f"A compliance artifact has changed since its original assessment.\n"
        f"The semantic drift score is {drift_score:.2f} (0 = identical, 1 = completely different).\n\n"
        f"ORIGINAL TEXT (excerpt):\n{original_text[:2000]}\n\n"
        f"CURRENT TEXT (excerpt):\n{current_text[:2000]}\n\n"
        "In 2-4 sentences, describe what appears to have changed and why it might matter "
        "for CMMC compliance. Focus on substantive changes, not formatting."
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": DRIFT_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 256,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"]


async def check_artifact_drift(
    artifact_id: uuid.UUID,
    current_text: str,
    conn: asyncpg.Connection,
    threshold: float = DEFAULT_DRIFT_THRESHOLD,
) -> Optional[float]:
    """Re-embed current_text and compare to stored baseline embedding.

    Returns:
        drift_score (float) if drift > threshold and DB is updated.
        None if stable, no baseline, or artifact not found.
    """
    artifact = await conn.fetchrow(
        "SELECT baseline_embedding, extracted_text FROM artifacts WHERE id = $1",
        artifact_id,
    )
    if not artifact or not artifact["baseline_embedding"]:
        return None

    current_vec = await embed_one(current_text)

    # Parse baseline from pg vector string format "[1.0, 2.0, ...]"
    baseline_raw = artifact["baseline_embedding"]
    if isinstance(baseline_raw, str):
        baseline_vec: list[float] = json.loads(
            baseline_raw.replace("(", "[").replace(")", "]")
        )
    else:
        baseline_vec = list(baseline_raw)

    drift_score = cosine_distance(baseline_vec, current_vec)
    if drift_score <= threshold:
        return None

    # Drift detected — generate human-readable summary
    original_text = artifact.get("extracted_text", "") or ""
    summary = await generate_drift_summary(original_text, current_text, drift_score)

    # Persist drift state on artifact
    await conn.execute(
        """
        UPDATE artifacts SET
            current_embedding  = $1,
            drift_score        = $2,
            drift_status       = 'drifted',
            drift_detected_at  = NOW(),
            drift_summary      = $3
        WHERE id = $4
        """,
        str(current_vec),
        drift_score,
        summary,
        artifact_id,
    )

    # Flag the parent program_control
    await conn.execute(
        """
        UPDATE program_controls SET has_drifted_evidence = TRUE
        WHERE id = (SELECT program_control_id FROM artifacts WHERE id = $1)
        """,
        artifact_id,
    )

    # Log drift event
    await conn.execute(
        """
        INSERT INTO artifact_drift_events (artifact_id, drift_score, drift_summary, model_used)
        VALUES ($1, $2, $3, $4)
        """,
        artifact_id,
        drift_score,
        summary,
        DRIFT_MODEL,
    )

    return drift_score
