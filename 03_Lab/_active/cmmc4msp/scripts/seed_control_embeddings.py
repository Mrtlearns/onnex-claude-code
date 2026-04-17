#!/usr/bin/env python
"""Seed control_definition_embeddings table.

Reads all 110 control_definitions (+ their objectives text) from Postgres,
embeds requirement_text + guidance text via OpenRouter text-embedding-3-small,
and upserts into control_definition_embeddings.

Idempotent — ON CONFLICT DO UPDATE so safe to re-run.

Usage (from inside the fastapi container or with env vars set):
    python scripts/seed_control_embeddings.py

Or from host via docker exec:
    docker exec cmmc-fastapi python scripts/seed_control_embeddings.py
"""
from __future__ import annotations

import asyncio
import logging
import os
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Ensure app package is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


async def main() -> None:
    from app.config import settings
    from app.database import create_pool
    from app.services.embeddings_service import embed_batch

    if not settings.openrouter_api_key:
        logger.error("OPENROUTER_API_KEY not set — cannot embed controls")
        sys.exit(1)

    pool = await create_pool()

    try:
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT id, nist_id, requirement_text,
                       assessment_objective,
                       acceptable_proof_guidance
                FROM control_definitions
                WHERE is_objective = false
                  AND requirement_text IS NOT NULL
                  AND requirement_text != ''
                ORDER BY nist_id
                """
            )

        logger.info("Loaded %d control definitions", len(rows))

        # Build texts to embed
        req_texts: list[str] = []
        guidance_texts: list[str] = []
        ids = []

        for row in rows:
            req = (row["requirement_text"] or "").strip()
            guidance_parts = []
            if row["assessment_objective"]:
                guidance_parts.append(row["assessment_objective"])
            if row["acceptable_proof_guidance"]:
                guidance_parts.append(row["acceptable_proof_guidance"])
            guidance = " ".join(guidance_parts).strip() or req

            req_texts.append(req)
            guidance_texts.append(guidance)
            ids.append(row["id"])

        logger.info("Embedding %d requirement texts…", len(req_texts))
        req_vectors = await embed_batch(req_texts)

        logger.info("Embedding %d guidance texts…", len(guidance_texts))
        guidance_vectors = await embed_batch(guidance_texts)

        logger.info("Upserting embeddings into control_definition_embeddings…")

        def fmt_vec(v: list) -> str:
            return "[" + ",".join(str(x) for x in v) + "]"

        async with pool.acquire() as conn:
            upserted = 0
            for ctrl_id, req_vec, guid_vec in zip(ids, req_vectors, guidance_vectors):
                await conn.execute(
                    """
                    INSERT INTO control_definition_embeddings
                      (control_definition_id, requirement_embedding, guidance_embedding, updated_at)
                    VALUES ($1, $2::vector, $3::vector, NOW())
                    ON CONFLICT (control_definition_id) DO UPDATE
                      SET requirement_embedding = EXCLUDED.requirement_embedding,
                          guidance_embedding     = EXCLUDED.guidance_embedding,
                          updated_at             = NOW()
                    """,
                    ctrl_id, fmt_vec(req_vec), fmt_vec(guid_vec),
                )
                upserted += 1
                if upserted % 20 == 0:
                    logger.info("  %d / %d controls seeded", upserted, len(ids))

        logger.info("Done — %d controls embedded and stored", upserted)

    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
