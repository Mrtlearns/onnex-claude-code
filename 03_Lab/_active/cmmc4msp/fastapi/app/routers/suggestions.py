"""Suggestions router — Evidence RAG cross-control reuse.

For a given artifact, compute cosine similarity between the artifact's chunk
embeddings (averaged) and all control definition requirement embeddings.
Returns the top-N matches with supporting chunk excerpts.

Also exposes a program-level reuse summary for the dashboard panel.
"""
from __future__ import annotations

import asyncio
import logging
import uuid

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.database import get_db
from app.deps import get_current_user, require_same_org
from app.services import embeddings_service

router = APIRouter()
logger = logging.getLogger(__name__)

_TOP_N = 15
_SIMILARITY_THRESHOLD = 0.50  # floor for showing a suggestion
_REUSE_THRESHOLD = 0.55        # floor for "could satisfy" count in dashboard


@router.post("/{artifact_id}/suggest-controls")
async def suggest_controls_for_artifact(
    artifact_id: str,
    request: Request,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Return top-15 controls that this artifact's text semantically covers.

    Computes or retrieves cached suggestions. Use ?refresh=true to force recompute.
    """
    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(422, "Invalid artifact_id")

    artifact = await conn.fetchrow(
        """
        SELECT ar.id, ar.file_name, ar.minio_key, p.org_id, ar.program_control_id,
               pc.program_id
        FROM artifacts ar
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ar.id = $1
        """,
        art_uid,
    )
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    require_same_org(str(artifact["org_id"]), user)

    refresh = request.query_params.get("refresh", "").lower() == "true"

    # Check cache
    if not refresh:
        cached = await conn.fetch(
            """
            SELECT acs.control_definition_id, acs.similarity_score, acs.top_chunk_texts,
                   acs.applied_at IS NOT NULL AS applied,
                   cd.nist_id, cd.cmmc_id, cd.requirement_text, cd.family, cd.family_abbrev
            FROM artifact_control_suggestions acs
            JOIN control_definitions cd ON acs.control_definition_id = cd.id
            WHERE acs.artifact_id = $1
            ORDER BY acs.similarity_score DESC
            LIMIT $2
            """,
            art_uid,
            _TOP_N,
        )
        if cached:
            return _format_suggestions(artifact_id, cached)

    # Need to compute — fetch chunks
    chunks = await conn.fetch(
        "SELECT chunk_text, chunk_index, embedding FROM artifact_chunks WHERE artifact_id = $1 ORDER BY chunk_index",
        art_uid,
    )

    if not chunks:
        # No chunks yet — try to generate them on-the-fly from extracted_text
        art_text_row = await conn.fetchrow(
            "SELECT extracted_text FROM artifacts WHERE id = $1", art_uid
        )
        extracted = art_text_row["extracted_text"] if art_text_row else ""
        if not extracted:
            return {"artifact_id": artifact_id, "suggestions": [], "note": "No text extracted yet — upload and wait for processing"}

        from app.services.extraction_service import chunk_text as _chunk_text
        raw_chunks = _chunk_text(extracted)
        if not raw_chunks:
            return {"artifact_id": artifact_id, "suggestions": []}

        texts = [c["chunk_text"] for c in raw_chunks]
        vectors = await embeddings_service.embed_batch(texts)

        def _fmt_vec(v: list) -> str:
            return "[" + ",".join(str(x) for x in v) + "]"

        for c, vec in zip(raw_chunks, vectors):
            await conn.execute(
                """
                INSERT INTO artifact_chunks (artifact_id, chunk_index, chunk_text, page_number, embedding)
                VALUES ($1, $2, $3, $4, $5::vector)
                ON CONFLICT (artifact_id, chunk_index) DO UPDATE SET embedding = EXCLUDED.embedding
                """,
                art_uid, c["chunk_index"], c["chunk_text"], c["page_number"],
                _fmt_vec(vec),
            )

        chunk_embeddings = vectors
        chunk_texts = texts
    else:
        def _parse_vec(v) -> list[float]:
            if isinstance(v, str):
                return [float(x) for x in v.strip("[]").split(",")]
            return list(v)

        chunk_embeddings = [_parse_vec(c["embedding"]) for c in chunks if c["embedding"]]
        chunk_texts = [c["chunk_text"] for c in chunks]

    if not chunk_embeddings:
        return {"artifact_id": artifact_id, "suggestions": []}

    # Average chunk embeddings → artifact vector
    n = len(chunk_embeddings)
    dims = len(chunk_embeddings[0])
    avg_vec = [sum(chunk_embeddings[j][d] for j in range(n)) / n for d in range(dims)]
    vec_str = "[" + ",".join(f"{v:.6f}" for v in avg_vec) + "]"

    # Cosine similarity against all control definition embeddings
    rows = await conn.fetch(
        """
        SELECT cde.control_definition_id,
               1 - (cde.requirement_embedding <=> $1::vector) AS sim,
               cd.nist_id, cd.cmmc_id, cd.requirement_text, cd.family, cd.family_abbrev
        FROM control_definition_embeddings cde
        JOIN control_definitions cd ON cde.control_definition_id = cd.id
        WHERE cde.requirement_embedding IS NOT NULL
        ORDER BY sim DESC
        LIMIT $2
        """,
        vec_str,
        _TOP_N * 2,
    )

    if not rows:
        return {"artifact_id": artifact_id, "suggestions": [], "note": "Control embeddings not seeded yet — run seed_control_embeddings.py"}

    # For top matches, find supporting chunk excerpts
    suggestions_to_cache = []
    results = []
    for row in rows:
        sim = float(row["sim"])
        if sim < _SIMILARITY_THRESHOLD:
            break
        if len(results) >= _TOP_N:
            break

        # Top-3 supporting chunks for this control
        ctrl_vec_row = await conn.fetchrow(
            "SELECT requirement_embedding FROM control_definition_embeddings WHERE control_definition_id = $1",
            row["control_definition_id"],
        )
        raw_cv = ctrl_vec_row["requirement_embedding"] if ctrl_vec_row else None
        if raw_cv is not None:
            ctrl_vec = [float(x) for x in str(raw_cv).strip("[]").split(",")] if isinstance(raw_cv, str) else list(raw_cv)
        else:
            ctrl_vec = avg_vec
        ctrl_vec_str = "[" + ",".join(f"{v:.6f}" for v in ctrl_vec) + "]"

        supporting = await conn.fetch(
            """
            SELECT chunk_text,
                   1 - (embedding <=> $2::vector) AS chunk_sim
            FROM artifact_chunks
            WHERE artifact_id = $1 AND embedding IS NOT NULL
            ORDER BY chunk_sim DESC
            LIMIT 3
            """,
            art_uid,
            ctrl_vec_str,
        )
        top_chunks = [r["chunk_text"][:300] for r in supporting]

        results.append({
            "control_definition_id": str(row["control_definition_id"]),
            "nist_id": row["nist_id"],
            "cmmc_id": row["cmmc_id"],
            "requirement_text": row["requirement_text"],
            "family": row["family"],
            "family_abbrev": row["family_abbrev"],
            "similarity_score": round(sim, 4),
            "supporting_chunks": top_chunks,
        })
        suggestions_to_cache.append((row["control_definition_id"], sim, top_chunks))

    # Cache results
    for ctrl_id, sim, top_chunks in suggestions_to_cache:
        await conn.execute(
            """
            INSERT INTO artifact_control_suggestions
              (artifact_id, control_definition_id, similarity_score, top_chunk_texts)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (artifact_id, control_definition_id) DO UPDATE
              SET similarity_score = EXCLUDED.similarity_score,
                  top_chunk_texts = EXCLUDED.top_chunk_texts,
                  generated_at = NOW()
            """,
            art_uid, ctrl_id, sim, top_chunks,
        )

    return {"artifact_id": artifact_id, "suggestions": results}


def _format_suggestions(artifact_id: str, rows: list) -> dict:
    return {
        "artifact_id": artifact_id,
        "suggestions": [
            {
                "control_definition_id": str(r["control_definition_id"]),
                "nist_id": r["nist_id"],
                "cmmc_id": r["cmmc_id"],
                "requirement_text": r["requirement_text"],
                "family": r["family"],
                "family_abbrev": r["family_abbrev"],
                "similarity_score": round(float(r["similarity_score"]), 4),
                "supporting_chunks": list(r["top_chunk_texts"] or []),
                "applied": bool(r["applied"]) if r.get("applied") is not None else False,
            }
            for r in rows
        ],
        "cached": True,
    }


# ---------------------------------------------------------------------------
# POST /{artifact_id}/apply-to-control
# ---------------------------------------------------------------------------

class ApplyBody(BaseModel):
    control_definition_id: str
    program_id: str


@router.post("/{artifact_id}/apply-to-control")
async def apply_suggestion(
    artifact_id: str,
    body: ApplyBody,
    conn: asyncpg.Connection = Depends(get_db),
    user: dict = Depends(get_current_user),
) -> dict:
    """Mark an artifact_control_suggestions row as applied for a given control."""
    # Validate artifact UUID
    try:
        art_uid = uuid.UUID(artifact_id)
    except ValueError:
        raise HTTPException(422, "Invalid artifact_id")

    # Validate body UUIDs
    try:
        ctrl_def_uid = uuid.UUID(body.control_definition_id)
    except ValueError:
        raise HTTPException(422, "Invalid control_definition_id")
    try:
        prog_uid = uuid.UUID(body.program_id)
    except ValueError:
        raise HTTPException(422, "Invalid program_id")

    # Fetch artifact and verify org access
    artifact = await conn.fetchrow(
        """
        SELECT ar.id, p.org_id
        FROM artifacts ar
        JOIN program_controls pc ON ar.program_control_id = pc.id
        JOIN programs p ON pc.program_id = p.id
        WHERE ar.id = $1
        """,
        art_uid,
    )
    if not artifact:
        raise HTTPException(404, "Artifact not found")

    require_same_org(str(artifact["org_id"]), user)

    # Find program_controls row
    pc_row = await conn.fetchrow(
        """
        SELECT id FROM program_controls
        WHERE control_definition_id = $1 AND program_id = $2
        """,
        ctrl_def_uid,
        prog_uid,
    )
    if not pc_row:
        raise HTTPException(404, "Program control not found for given control_definition_id and program_id")

    # Resolve applied_by — only set FK if the user actually exists in users table
    applied_by: uuid.UUID | None = None
    try:
        candidate = uuid.UUID(user["user_id"])
        exists = await conn.fetchval("SELECT 1 FROM users WHERE id = $1", candidate)
        if exists:
            applied_by = candidate
    except (ValueError, KeyError):
        pass

    # Upsert into artifact_control_suggestions
    await conn.execute(
        """
        INSERT INTO artifact_control_suggestions
          (artifact_id, control_definition_id, similarity_score, top_chunk_texts, applied_at, applied_by)
        VALUES ($1, $2, 0, ARRAY[]::TEXT[], NOW(), $3)
        ON CONFLICT (artifact_id, control_definition_id) DO UPDATE
          SET applied_at = NOW(),
              applied_by = $3
        """,
        art_uid,
        ctrl_def_uid,
        applied_by,
    )

    return {"ok": True, "program_control_id": str(pc_row["id"])}
