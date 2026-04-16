#!/usr/bin/env python3
"""
MSG File Extraction API Server
FastAPI backend for .msg file upload and extraction.

Usage:
  pip install -r requirements.txt
  python msg_api_server.py

Server runs on http://localhost:8000
"""

import logging
import os
import tempfile

MSG_API_BASE_URL = os.environ.get("MSG_API_BASE_URL", "")
from datetime import datetime
from pathlib import Path

import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from msg_extractor import MSGExtractor

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MSG Extraction API",
    description="Extract email bodies and attachments from .msg files",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_TMP = Path(tempfile.gettempdir())
TEMP_UPLOAD_DIR = _TMP / "msg_uploads"
TEMP_UPLOAD_DIR.mkdir(exist_ok=True)

EXTRACTION_BASE = str(_TMP / "msg_extractions")


def _format_result(result: dict, base_url: str) -> dict:
    """Convert extractor result to frontend-friendly format."""
    if not result.get("success"):
        return {
            "success": False,
            "error":   result.get("error", "Unknown error"),
            "file":    result.get("file"),
        }

    attachments = []
    for att in result.get("attachments", []):
        if "error" not in att:
            folder   = att.get("folder", "")
            filename = att.get("filename", "")
            entry = {
                "filename":     filename,
                "size":         att.get("size_bytes", 0),
                "size_kb":      round(att.get("size_bytes", 0) / 1024, 1),
                "downloadUrl":  f"{base_url}/api/download/{folder}/{filename}",
                "filtered":     att.get("filtered", False),
                "filterReason": att.get("filter_reason", ""),
            }
            attachments.append(entry)

    active_count = sum(1 for a in attachments if not a["filtered"])

    return {
        "success": True,
        "email": {
            "from":        result.get("sender"),
            "to":          result.get("to"),
            "subject":     result.get("subject"),
            "date":        result.get("date"),
            "body":        result.get("body"),
            "bodyPreview": (result.get("body") or "")[:300] + "...",
        },
        "attachments":     attachments,
        "attachmentCount": active_count,
        "extractedAt":     datetime.now().isoformat(),
    }


@app.get("/")
async def root():
    return {
        "status":  "ok",
        "service": "MSG Extraction API",
        "endpoints": {
            "upload":   "POST /api/upload",
            "batch":    "POST /api/batch",
            "download": "GET  /api/download/{folder}/{filename}",
            "health":   "GET  /api/health",
            "docs":     "GET  /docs",
        },
    }


@app.get("/api/health")
async def health():
    return {
        "status":    "healthy",
        "timestamp": datetime.now().isoformat(),
    }


@app.post("/api/upload")
async def upload_msg(file: UploadFile = File(...)):
    """Upload and extract a single .msg file."""
    if not (file.filename or "").lower().endswith(".msg"):
        raise HTTPException(status_code=400, detail="File must be a .msg file")

    temp_path = TEMP_UPLOAD_DIR / file.filename
    try:
        content = await file.read()
        temp_path.write_bytes(content)

        logger.info(f"Processing: {file.filename}")

        extractor = MSGExtractor(output_base_dir=EXTRACTION_BASE)
        result    = extractor.extract_single_msg(str(temp_path))

        # Build absolute download URLs using the server's own base
        # The frontend will receive http://localhost:8000/api/download/... links
        response = _format_result(result, base_url=MSG_API_BASE_URL)

        if response["success"]:
            logger.info(f"Extracted: {result['subject']}")
        else:
            logger.error(f"Failed: {response['error']}")

        return response

    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if temp_path.exists():
            temp_path.unlink(missing_ok=True)


@app.post("/api/batch")
async def upload_batch(files: list[UploadFile] = File(...)):
    """Upload and extract multiple .msg files."""
    results = []
    extractor = MSGExtractor(output_base_dir=EXTRACTION_BASE)

    for f in files:
        if not (f.filename or "").lower().endswith(".msg"):
            results.append({"success": False, "file": f.filename, "error": "Not a .msg file"})
            continue

        temp_path = TEMP_UPLOAD_DIR / f.filename
        try:
            temp_path.write_bytes(await f.read())
            raw    = extractor.extract_single_msg(str(temp_path))
            result = _format_result(raw, base_url=MSG_API_BASE_URL)
            results.append(result)
        except Exception as e:
            results.append({"success": False, "file": f.filename, "error": str(e)})
        finally:
            temp_path.unlink(missing_ok=True)

    succeeded = sum(1 for r in results if r.get("success"))
    return {
        "batch":   results,
        "summary": {
            "total":     len(results),
            "succeeded": succeeded,
            "failed":    len(results) - succeeded,
        },
    }


@app.get("/api/download/{folder}/{filename}")
async def download_attachment(folder: str, filename: str):
    """Download an extracted attachment by folder + filename."""
    # Sanitize to prevent directory traversal
    safe_folder   = folder.replace("..", "").replace("/", "").replace("\\", "")
    safe_filename = filename.replace("..", "").replace("/", "").replace("\\", "")

    file_path = Path(EXTRACTION_BASE) / "attachments" / safe_folder / safe_filename

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Attachment not found")

    logger.info(f"Downloading: {safe_filename}")
    return FileResponse(
        path=file_path,
        filename=safe_filename,
        media_type="application/octet-stream",
    )


if __name__ == "__main__":
    print(
        "\nNDT Portal -- MSG Extraction API\n"
        "  http://localhost:8000\n"
        "  POST /api/upload   -- single .msg file\n"
        "  POST /api/batch    -- multiple .msg files\n"
        "  GET  /api/download -- attachment download\n"
        "  GET  /docs         -- Swagger UI\n"
        "Press Ctrl+C to stop.\n"
    )
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
