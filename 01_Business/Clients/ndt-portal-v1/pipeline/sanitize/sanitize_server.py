"""Sanitize microservice — FastAPI, port 8011.

Endpoints:
  POST /sanitize              — Tokenize PII/CUI entities in text
  POST /reidentify            — Reverse tokenization (role-gated)
  GET  /job/{job_id}          — Retrieve sanitization job metadata
  GET  /health                — Health check
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException

# ── Path setup ─────────────────────────────────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from models import SanitizeRequest, SanitizeResponse, ReidentifyRequest, ReidentifyResponse, LLMRouting  # noqa: E402
from db import get_pool, close_pool                                                                         # noqa: E402
from config import vault_key as get_vault_key                                                               # noqa: E402

from presidio_engine import build_analyzer
from vault import derive_token, encrypt, decrypt, role_can_reveal

logger = logging.getLogger("sanitize")
logging.basicConfig(level=logging.INFO)

# Module-level analyzer (loaded once at startup)
_analyzer = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _analyzer
    _analyzer = build_analyzer()
    await get_pool()
    logger.info("sanitize service ready")
    yield
    await close_pool()


app = FastAPI(title="NDT Sanitize Service", lifespan=lifespan)


# ── Helpers ────────────────────────────────────────────────────────────────

def _tokenize_text(text: str, vault_key: bytes) -> tuple[str, list[dict]]:
    """Run Presidio analysis and replace entities with tokens.

    Returns:
        (sanitized_text, list of {token, entity_type, original, score})
    """
    results = _analyzer.analyze(
        text=text,
        language="en",
        entities=[
            "PERSON", "EMAIL_ADDRESS", "EMAIL_HEADER", "PHONE_NUMBER", "ORGANIZATION",
            "DRAWING_NUMBER", "PART_NUMBER", "CAGE_CODE", "CONTRACT_NUMBER",
            "CERT_ID", "PROJECT_CODE",
        ],
    )

    # Sort by start, then de-duplicate overlapping spans (keep highest score)
    results.sort(key=lambda r: (r.start, -r.score))
    non_overlapping: list = []
    last_end = -1
    for r in results:
        if r.start >= last_end:
            non_overlapping.append(r)
            last_end = r.end

    replacements: list[dict] = []
    adjusted_text = text
    adj_offset = 0

    for r in non_overlapping:
        original  = text[r.start:r.end]
        token     = derive_token(r.entity_type, original, vault_key)
        adj_start = r.start + adj_offset
        adj_end   = r.end   + adj_offset
        adjusted_text  = adjusted_text[:adj_start] + token + adjusted_text[adj_end:]
        adj_offset    += len(token) - (r.end - r.start)
        replacements.append({
            "token":       token,
            "entity_type": r.entity_type,
            "original":    original,
            "score":       r.score,
        })

    return adjusted_text, replacements


async def _store_vault_entries(
    pool,
    job_id: str,
    replacements: list[dict],
    vault_key: bytes,
) -> None:
    """Encrypt originals and store in sanitize_token_vault."""
    for rep in replacements:
        ciphertext, iv = encrypt(rep["original"], vault_key)
        await pool.execute(
            """
            INSERT INTO pipeline.sanitize_token_vault
                (job_id, token, entity_type, encrypted_val, iv)
            VALUES ($1::uuid, $2, $3, $4, $5)
            ON CONFLICT (job_id, token) DO NOTHING
            """,
            job_id,
            rep["token"],
            rep["entity_type"],
            ciphertext,
            iv,
        )


async def _restore_tokens(
    pool,
    job_id: str,
    text: str,
    caller_role: str,
    vault_key: bytes,
) -> tuple[str, list[str]]:
    """Replace tokens in text with decrypted originals (role-gated)."""
    rows = await pool.fetch(
        "SELECT token, entity_type, encrypted_val, iv FROM pipeline.sanitize_token_vault WHERE job_id = $1::uuid",
        job_id,
    )

    restored = text
    revealed: list[str] = []

    for row in rows:
        token       = row["token"]
        entity_type = row["entity_type"]
        if token not in text:
            continue
        if not role_can_reveal(caller_role, entity_type):
            continue
        try:
            plaintext = decrypt(bytes(row["encrypted_val"]), bytes(row["iv"]), vault_key)
            restored  = restored.replace(token, plaintext)
            revealed.append(token)
        except Exception as e:
            logger.warning("decrypt failed for token %s: %s", token, e)

    return restored, revealed


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "sanitize"}


@app.post("/sanitize", response_model=SanitizeResponse)
async def sanitize(req: SanitizeRequest):
    if _analyzer is None:
        raise HTTPException(status_code=503, detail="Analyzer not ready")

    vkey = get_vault_key()
    pool = await get_pool()

    # Tokenize
    sanitized_text, replacements = _tokenize_text(req.text, vkey)

    # Compute input hash for dedup / audit
    input_hash = hashlib.sha256(req.text.encode()).hexdigest()

    # Create job record
    row = await pool.fetchrow(
        """
        INSERT INTO pipeline.sanitize_jobs
            (comply_doc_id, entity_count, input_hash)
        VALUES ($1, $2, $3)
        RETURNING id::text
        """,
        req.comply_doc_id,
        len(replacements),
        input_hash,
    )
    job_id = row["id"]

    # Store vault entries
    await _store_vault_entries(pool, job_id, replacements, vkey)

    logger.info(
        "sanitize: job=%s entities=%d routing=%s",
        job_id, len(replacements), req.routing,
    )

    return SanitizeResponse(
        job_id=job_id,
        sanitized_text=sanitized_text,
        entity_count=len(replacements),
        routing=req.routing,
    )


@app.post("/reidentify", response_model=ReidentifyResponse)
async def reidentify(req: ReidentifyRequest):
    vkey = get_vault_key()
    pool = await get_pool()

    # Restore tokens
    restored_text, revealed = await _restore_tokens(
        pool, req.job_id, req.text, req.caller_role, vkey,
    )

    # Audit log
    for token in revealed:
        await pool.execute(
            """
            INSERT INTO pipeline.sanitize_reidentify_audit
                (job_id, token, caller_role, caller_identity)
            VALUES ($1::uuid, $2, $3, $4)
            """,
            req.job_id,
            token,
            req.caller_role,
            req.caller_identity,
        )

    return ReidentifyResponse(
        reidentified_text=restored_text,
        tokens_revealed=revealed,
    )


@app.get("/job/{job_id}")
async def get_job(job_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT id::text, comply_doc_id::text, entity_count, input_hash, created_at FROM pipeline.sanitize_jobs WHERE id = $1::uuid",
        job_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    return dict(row)
