#!/usr/bin/env python3
"""
MSG File Extraction API Server
FastAPI backend for .msg file upload and extraction.
Integrates with Next.js frontend.

Usage:
  python3 msg_api_server.py
  
Server runs on http://localhost:8000
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
import tempfile
import shutil
import os
from pathlib import Path
from datetime import datetime
import uvicorn
import logging
from msg_extractor import MSGExtractor
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="MSG Extraction API",
    description="Extract email bodies and attachments from .msg files",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create temp directory for uploads
TEMP_UPLOAD_DIR = Path("/tmp/msg_uploads")
TEMP_UPLOAD_DIR.mkdir(exist_ok=True)

class MSGExtractionResponse:
    """Format extraction results for frontend."""
    
    @staticmethod
    def format_result(extractor_result: dict) -> dict:
        """Convert extractor result to frontend-friendly format."""
        if not extractor_result.get("success"):
            return {
                "success": False,
                "error": extractor_result.get("error", "Unknown error"),
                "file": extractor_result.get("file")
            }
        
        # Format attachments with download URLs
        attachments = []
        for att in extractor_result.get("attachments", []):
            if "error" not in att:
                attachments.append({
                    "filename": att.get("filename"),
                    "size": att.get("size_bytes", 0),
                    "size_kb": round(att.get("size_bytes", 0) / 1024, 1),
                    "path": att.get("path"),
                    "downloadUrl": f"/api/download/{Path(att.get('path')).parent.name}/{att.get('filename')}"
                })
        
        return {
            "success": True,
            "email": {
                "from": extractor_result.get("sender"),
                "to": extractor_result.get("to"),
                "subject": extractor_result.get("subject"),
                "date": extractor_result.get("date"),
                "body": extractor_result.get("body"),
                "bodyPreview": (extractor_result.get("body") or "")[:200] + "..."
            },
            "attachments": attachments,
            "attachmentCount": len(attachments),
            "extractedAt": datetime.now().isoformat()
        }


@app.get("/")
async def root():
    """Health check endpoint."""
    return {
        "status": "ok",
        "service": "MSG Extraction API",
        "endpoints": {
            "upload": "POST /api/upload",
            "download": "GET /api/download/{folder}/{filename}",
            "health": "GET /"
        }
    }


@app.post("/api/upload")
async def upload_msg_file(file: UploadFile = File(...)):
    """
    Upload and extract a single .msg file.
    
    Returns: Extracted email content + attachment metadata
    """
    # Validate file
    if not file.filename.endswith('.msg'):
        raise HTTPException(
            status_code=400,
            detail="File must be a .msg file"
        )
    
    temp_file_path = None
    
    try:
        # Save uploaded file to temp directory
        temp_file_path = TEMP_UPLOAD_DIR / file.filename
        with open(temp_file_path, 'wb') as f:
            content = await file.read()
            f.write(content)
        
        logger.info(f"📧 Processing: {file.filename}")
        
        # Extract using MSGExtractor
        extractor = MSGExtractor(output_base_dir="/tmp/msg_extractions")
        result = extractor.extract_single_msg(str(temp_file_path))
        
        # Format response
        response = MSGExtractionResponse.format_result(result)
        
        if response["success"]:
            logger.info(f"✓ Successfully extracted: {result['subject']}")
        else:
            logger.error(f"✗ Extraction failed: {response['error']}")
        
        return response
    
    except Exception as e:
        logger.error(f"❌ Error processing file: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing file: {str(e)}"
        )
    
    finally:
        # Cleanup temp file
        if temp_file_path and temp_file_path.exists():
            try:
                temp_file_path.unlink()
            except:
                pass


@app.get("/api/download/{folder}/{filename}")
async def download_attachment(folder: str, filename: str):
    """
    Download an extracted attachment.
    
    Args:
        folder: Email subject folder name
        filename: Attachment filename
    """
    try:
        # Sanitize path to prevent directory traversal
        safe_folder = folder.replace("..", "").replace("/", "")
        safe_filename = filename.replace("..", "").replace("/", "")
        
        file_path = Path("/tmp/msg_extractions/attachments") / safe_folder / safe_filename
        
        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")
        
        logger.info(f"📥 Downloading: {safe_filename}")
        
        return FileResponse(
            path=file_path,
            filename=safe_filename,
            media_type="application/octet-stream"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Download error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/batch")
async def upload_batch(files: list[UploadFile] = File(...)):
    """
    Upload and extract multiple .msg files (batch processing).
    
    Returns: Array of extraction results
    """
    results = []
    
    for file in files:
        if not file.filename.endswith('.msg'):
            results.append({
                "success": False,
                "file": file.filename,
                "error": "Not a .msg file"
            })
            continue
        
        temp_file_path = None
        
        try:
            temp_file_path = TEMP_UPLOAD_DIR / file.filename
            with open(temp_file_path, 'wb') as f:
                content = await file.read()
                f.write(content)
            
            extractor = MSGExtractor(output_base_dir="/tmp/msg_extractions")
            result = extractor.extract_single_msg(str(temp_file_path))
            
            formatted = MSGExtractionResponse.format_result(result)
            results.append(formatted)
            
        except Exception as e:
            results.append({
                "success": False,
                "file": file.filename,
                "error": str(e)
            })
        
        finally:
            if temp_file_path and temp_file_path.exists():
                try:
                    temp_file_path.unlink()
                except:
                    pass
    
    # Summary
    succeeded = sum(1 for r in results if r.get("success"))
    
    return {
        "batch": results,
        "summary": {
            "total": len(results),
            "succeeded": succeeded,
            "failed": len(results) - succeeded
        }
    }


@app.get("/api/health")
async def health_check():
    """Detailed health check."""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "temp_dir": str(TEMP_UPLOAD_DIR),
        "temp_dir_exists": TEMP_UPLOAD_DIR.exists()
    }


if __name__ == "__main__":
    print("""
    ╔════════════════════════════════════════╗
    ║   MSG Extraction API - Starting...     ║
    ╚════════════════════════════════════════╝
    
    📍 Server: http://localhost:8000
    🎯 Upload endpoint: POST /api/upload
    📥 Download endpoint: GET /api/download/{folder}/{filename}
    🔄 Batch upload: POST /api/batch
    
    🔗 Frontend: Connect from http://localhost:3000
    📊 Docs: http://localhost:8000/docs
    
    Press Ctrl+C to stop.
    """)
    
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
