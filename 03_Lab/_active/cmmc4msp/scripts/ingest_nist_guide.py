#!/usr/bin/env python3
"""
Ingest NIST SP 800-171A assessment guidance into nist_guide_chunks.

Usage:
    python scripts/ingest_nist_guide.py --input nist_800_171a.json

The input JSON should be an array of objects:
  {
    "nist_id": "3.1.1",
    "section": "Discussion",
    "text": "3.1.1 requires limiting system access to authorized users..."
  }

Real NIST SP 800-171A data can be sourced from:
  https://csrc.nist.gov/publications/detail/sp/800-171a/final
  Convert the PDF assessment guide to JSON using the structure above.
  Group by control ID (nist_id) and section for best retrieval quality.

Notes:
  - Existing chunks for the same (nist_id, chunk_index) are overwritten (upsert).
  - Each entry in the JSON array becomes one chunk with an auto-assigned index
    within its nist_id group.
  - Embeddings are generated via OpenRouter (OPENROUTER_API_KEY must be set).
"""
import argparse
import asyncio
import json
import os
import sys

import asyncpg

# Add fastapi/ to path so app.config and app.services can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "fastapi"))

from app.config import settings  # noqa: E402
from app.services.embeddings_service import embed_batch  # noqa: E402


async def ingest(input_path: str) -> None:
    with open(input_path, encoding="utf-8") as f:
        entries = json.load(f)

    if not entries:
        print("No entries found in input file.")
        return

    print(f"Loaded {len(entries)} entries — generating embeddings…")
    texts = [e["text"] for e in entries]
    embeddings = await embed_batch(texts)

    # Group by nist_id to assign chunk_index within each control
    by_control: dict[str, list] = {}
    for entry, emb in zip(entries, embeddings):
        nid = entry["nist_id"]
        by_control.setdefault(nid, []).append((entry, emb))

    conn = await asyncpg.connect(settings.postgres_dsn)
    try:
        inserted = 0
        for nid, items in by_control.items():
            for idx, (entry, emb) in enumerate(items):
                await conn.execute(
                    """
                    INSERT INTO nist_guide_chunks (nist_id, section, chunk_text, chunk_index, embedding)
                    VALUES ($1, $2, $3, $4, $5)
                    ON CONFLICT (nist_id, chunk_index) DO UPDATE
                    SET chunk_text = EXCLUDED.chunk_text,
                        embedding  = EXCLUDED.embedding
                    """,
                    nid,
                    entry.get("section", "General"),
                    entry["text"],
                    idx,
                    str(emb),
                )
                inserted += 1

        print(f"Ingested {inserted} chunks across {len(by_control)} controls.")
    finally:
        await conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ingest NIST SP 800-171A guidance chunks.")
    parser.add_argument("--input", required=True, help="Path to JSON input file")
    args = parser.parse_args()
    asyncio.run(ingest(args.input))
