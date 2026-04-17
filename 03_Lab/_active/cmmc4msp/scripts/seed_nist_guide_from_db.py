"""
Seed nist_guide_chunks from existing control_definitions.

Pulls requirement_text, assessment_objective, and acceptable_proof_guidance
from control_definitions and inserts them as searchable chunks for the
Copilot RAG pipeline. Embeddings are generated via OpenRouter.

Usage (run inside fastapi container or with correct env):
    python scripts/seed_nist_guide_from_db.py
"""
import asyncio
import os
import re
import sys

import asyncpg

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "fastapi"))

from app.config import settings  # noqa: E402
from app.services.embeddings_service import embed_batch  # noqa: E402


def split_proof_guidance(text: str) -> list[tuple[str, str]]:
    """Split EXAMINE/INTERVIEW/TEST sections into (section, text) tuples."""
    pattern = r'\b(EXAMINE|INTERVIEW|TEST)\s*:'
    parts = re.split(pattern, text)
    result = []
    i = 1
    while i < len(parts) - 1:
        section = parts[i]
        content = parts[i + 1].strip().rstrip(']').lstrip('[').strip()
        if content:
            result.append((section.title(), content))
        i += 2
    return result or [("Guidance", text)]


async def seed() -> None:
    conn = await asyncpg.connect(settings.postgres_dsn)
    try:
        rows = await conn.fetch(
            """
            SELECT nist_id, requirement_text, assessment_objective, acceptable_proof_guidance
            FROM control_definitions
            WHERE nist_id IS NOT NULL
            ORDER BY nist_id
            """
        )
        print(f"Found {len(rows)} control definitions — building chunks…")

        entries: list[tuple[str, str, str]] = []  # (nist_id, section, text)

        for row in rows:
            nist_id = row["nist_id"]

            # Chunk 1: Requirement text
            if row["requirement_text"]:
                entries.append((nist_id, "Requirement", row["requirement_text"]))

            # Chunk 2: Assessment objective
            if row["assessment_objective"]:
                entries.append((nist_id, "Assessment Objective", row["assessment_objective"]))

            # Chunks 3+: Proof guidance sections
            if row["acceptable_proof_guidance"]:
                for section, text in split_proof_guidance(row["acceptable_proof_guidance"]):
                    entries.append((nist_id, section, text))

        print(f"Generated {len(entries)} chunks — embedding in batches…")

        texts = [e[2] for e in entries]
        # Embed in batches of 20 to avoid rate limits
        batch_size = 20
        all_embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            embs = await embed_batch(batch)
            all_embeddings.extend(embs)
            print(f"  Embedded {min(i + batch_size, len(texts))}/{len(texts)}")

        # Group by nist_id for chunk_index assignment
        by_control: dict[str, list] = {}
        for (nid, section, text), emb in zip(entries, all_embeddings):
            by_control.setdefault(nid, []).append((section, text, emb))

        inserted = 0
        for nid, items in by_control.items():
            for idx, (section, text, emb) in enumerate(items):
                await conn.execute(
                    """
                    INSERT INTO nist_guide_chunks (nist_id, section, chunk_text, chunk_index, embedding)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (nist_id, chunk_index) DO UPDATE
                    SET section     = EXCLUDED.section,
                        chunk_text  = EXCLUDED.chunk_text,
                        embedding   = EXCLUDED.embedding
                    """,
                    nid,
                    section,
                    text,
                    idx,
                    str(emb),
                )
                inserted += 1

        print(f"Done — inserted/updated {inserted} chunks across {len(by_control)} controls.")

    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
