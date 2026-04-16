"""Comply microservice — FastAPI, port 8010.

Endpoints:
  POST /classify              — Classify a PDF or image attachment
  GET  /document/{doc_id}    — Retrieve a stored classification result
  GET  /review                — Queue of documents awaiting human review (HOLD)
  GET  /health                — Health check
"""
from __future__ import annotations

import base64
import logging
import os
import re
import sys
from contextlib import asynccontextmanager
from typing import Any

import asyncpg
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

# ── Path setup so shared/ is importable ───────────────────────────────────
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from models import ClassifyRequest, ClassifyResponse, Classification, LLMRouting  # noqa: E402
from db import get_pool, close_pool                                                 # noqa: E402

from keyword_scanner import scan_text
from title_block import extract_from_pdf, extract_from_image_text, TitleBlockData
from compliance_engine import score

logger = logging.getLogger("comply")
logging.basicConfig(level=logging.INFO)


class PdfToImageRequest(BaseModel):
    content_b64: str
    filename: str

# ── Optional OCR (PaddleOCR) ───────────────────────────────────────────────
try:
    from paddleocr import PaddleOCR
    _ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    logger.info("PaddleOCR loaded")
except Exception:
    _ocr = None
    logger.warning("PaddleOCR not available — image OCR disabled")


# ── App lifecycle ──────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    await get_pool()
    logger.info("comply service ready")
    yield
    await close_pool()


app = FastAPI(title="NDT Comply Service", lifespan=lifespan)


# ── Helpers ────────────────────────────────────────────────────────────────

async def _load_db_keywords(pool: asyncpg.Pool) -> list[dict]:
    rows = await pool.fetch(
        "SELECT keyword, category, weight FROM pipeline.comply_keyword_library"
    )
    return [dict(r) for r in rows]


async def _load_defense_cages(pool: asyncpg.Pool) -> set[str]:
    rows = await pool.fetch(
        "SELECT cage_code FROM pipeline.comply_cage_code_registry WHERE is_defense = TRUE"
    )
    return {r["cage_code"] for r in rows}


def _extract_text(filename: str, content_bytes: bytes) -> tuple[str, TitleBlockData]:
    """Return (full_text, title_block_data) from file content."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        title_block = extract_from_pdf(content_bytes)
        # Also get raw text for keyword scanning
        try:
            import fitz
            doc = fitz.open(stream=content_bytes, filetype="pdf")
            pages = [page.get_text() for page in doc]
            doc.close()
            text = "\n".join(pages)
        except Exception:
            text = ""
        return text, title_block

    elif ext in ("jpg", "jpeg", "png", "bmp", "tiff", "tif"):
        if _ocr is None:
            return "", TitleBlockData()
        try:
            import tempfile, pathlib
            with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as f:
                f.write(content_bytes)
                tmp_path = f.name
            result = _ocr.ocr(tmp_path, cls=True)
            pathlib.Path(tmp_path).unlink(missing_ok=True)
            lines = []
            if result:
                for block in result:
                    if block:
                        for line in block:
                            if line and len(line) >= 2:
                                lines.append(line[1][0])
            text = "\n".join(lines)
            title_block = extract_from_image_text(text)
            return text, title_block
        except Exception as e:
            logger.warning("OCR failed: %s", e)
            return "", TitleBlockData()

    else:
        # Plain text / unknown — decode as UTF-8 and scan directly
        try:
            text = content_bytes.decode("utf-8", errors="replace")
        except Exception:
            text = ""
        title_block = extract_from_image_text(text)
        return text, title_block


async def _persist(
    pool: asyncpg.Pool,
    intake_id: str,
    filename: str,
    result,
) -> str:
    """Persist classification result and return doc_id."""
    row = await pool.fetchrow(
        """
        INSERT INTO pipeline.comply_documents
            (intake_id, filename, classification, llm_routing, risk_score,
             cage_codes, usml_hits, drawing_number, dist_statement)
        VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
        RETURNING id::text
        """,
        intake_id,
        filename,
        result.classification.value,
        result.llm_routing.value,
        result.risk_score,
        result.cage_codes,
        __import__("json").dumps(result.usml_hits),
        result.drawing_number,
        result.dist_statement,
    )
    return row["id"]


# ── Routes ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "comply"}


_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"\b\d{3}[\s.\-]\d{3}[\s.\-]\d{4}\b")


@app.post("/pdf-to-image")
async def pdf_to_image(req: PdfToImageRequest):
    """Render first page of a PDF to PII-scrubbed PNG for LLM vision input.

    Redaction (applied before rendering):
    1. Title block region (bottom 20% of page, full width) — blacked out.
       Engineering drawings universally place company name, approvals,
       CAGE code, revision history, and contact info in this area.
    2. Text-layer scan — any span containing an email address or phone
       number anywhere on the page is individually blacked out.
       (Covers vector PDFs; scanned/rasterized PDFs rely on the area redaction.)

    Uses PyMuPDF at 2× zoom (144 dpi equivalent).
    Returns: { image_b64: str, media_type: "image/png", page_count: int,
               pii_regions_redacted: int }
    """
    try:
        content_bytes = base64.b64decode(req.content_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 content")

    try:
        import fitz  # PyMuPDF — already used by _extract_text()
        doc = fitz.open(stream=content_bytes, filetype="pdf")
        page_count = len(doc)
        page = doc.load_page(0)
        rect = page.rect
        pii_count = 0

        # 1. Title block region — bottom 20% of page, full width
        tb_rect = fitz.Rect(0, rect.height * 0.80, rect.width, rect.height)
        page.add_redact_annot(tb_rect, fill=(0, 0, 0))
        pii_count += 1

        # 2. Scan text layer for emails and phone numbers (vector PDFs)
        for block in page.get_text("dict").get("blocks", []):
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    txt = span.get("text", "")
                    if _EMAIL_RE.search(txt) or _PHONE_RE.search(txt):
                        bbox = span.get("bbox")
                        if bbox:
                            page.add_redact_annot(fitz.Rect(bbox), fill=(0, 0, 0))
                            pii_count += 1

        # Apply all redactions before rendering
        page.apply_redactions()

        mat = fitz.Matrix(2.0, 2.0)   # 2× zoom ≈ 144 dpi
        pix = page.get_pixmap(matrix=mat)
        png_bytes = pix.tobytes("png")
        doc.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF render failed: {e}")

    image_b64 = base64.b64encode(png_bytes).decode()
    logger.info(
        "pdf-to-image: file=%s pages=%d png_bytes=%d pii_regions=%d",
        req.filename, page_count, len(png_bytes), pii_count,
    )
    return {
        "image_b64": image_b64,
        "media_type": "image/png",
        "page_count": page_count,
        "pii_regions_redacted": pii_count,
    }


def _render_to_image(filename: str, content_bytes: bytes) -> tuple[str | None, str | None]:
    """Render file to a PII-scrubbed image for LLM vision input.
    - PDFs: renders first page via PyMuPDF at 2× zoom, redacts title block + PII spans.
    - Images: pass through raw bytes as-is (already visual).
    Returns (image_b64, media_type) or (None, None) on failure.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            import fitz
            doc  = fitz.open(stream=content_bytes, filetype="pdf")
            page = doc.load_page(0)
            rect = page.rect

            # Redact title block (bottom 20%) and any PII spans
            page.add_redact_annot(
                fitz.Rect(0, rect.height * 0.80, rect.width, rect.height),
                fill=(0, 0, 0),
            )
            for block in page.get_text("dict").get("blocks", []):
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        txt = span.get("text", "")
                        if _EMAIL_RE.search(txt) or _PHONE_RE.search(txt):
                            bbox = span.get("bbox")
                            if bbox:
                                page.add_redact_annot(fitz.Rect(bbox), fill=(0, 0, 0))
            page.apply_redactions()

            pix = page.get_pixmap(matrix=fitz.Matrix(2.0, 2.0))
            png_bytes = pix.tobytes("png")
            doc.close()
            return base64.b64encode(png_bytes).decode(), "image/png"
        except Exception as e:
            logger.warning("classify: pdf render failed: %s", e)
            return None, None

    elif ext in ("jpg", "jpeg", "png", "bmp", "tiff", "tif", "webp"):
        # Pass through — the image IS the drawing
        media_type = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
        return base64.b64encode(content_bytes).decode(), media_type

    return None, None


@app.post("/classify", response_model=ClassifyResponse)
async def classify(req: ClassifyRequest):
    # Decode content
    try:
        content_bytes = base64.b64decode(req.content_b64)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid base64 content")

    pool = await get_pool()

    # Load DB keywords and CAGE codes
    db_keywords   = await _load_db_keywords(pool)
    defense_cages = await _load_defense_cages(pool)

    # Extract text + title block
    text, title_block = _extract_text(req.filename, content_bytes)

    # Render file to PII-scrubbed image for LLM vision
    rendered_b64, rendered_media_type = _render_to_image(req.filename, content_bytes)

    # Keyword scan
    hits = scan_text(text, db_keywords)

    # Score
    result = score(hits, title_block, defense_cages)

    logger.info(
        "classify: file=%s classification=%s routing=%s score=%d rendered=%s",
        req.filename, result.classification, result.llm_routing, result.risk_score,
        "yes" if rendered_b64 else "no",
    )

    # Persist
    doc_id = await _persist(pool, req.intake_id, req.filename, result)

    return ClassifyResponse(
        doc_id=doc_id,
        intake_id=req.intake_id,
        filename=req.filename,
        classification=result.classification,
        llm_routing=result.llm_routing,
        risk_score=result.risk_score,
        cage_codes=result.cage_codes,
        usml_hits=result.usml_hits,
        drawing_number=result.drawing_number,
        dist_statement=result.dist_statement,
        extracted_text=text or None,
        rendered_image_b64=rendered_b64,
        rendered_media_type=rendered_media_type,
    )


@app.get("/document/{doc_id}")
async def get_document(doc_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM pipeline.comply_documents WHERE id = $1::uuid",
        doc_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    return dict(row)


@app.get("/review")
async def review_queue(limit: int = 50):
    """Return documents awaiting human review (HOLD routing)."""
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id::text, intake_id::text, filename, classification,
               risk_score, drawing_number, dist_statement, created_at
        FROM pipeline.comply_documents
        WHERE llm_routing = 'HOLD'
        ORDER BY created_at DESC
        LIMIT $1
        """,
        limit,
    )
    return [dict(r) for r in rows]
