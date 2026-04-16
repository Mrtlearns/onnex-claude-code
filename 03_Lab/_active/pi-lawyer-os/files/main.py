"""
PI Lawyer OS — Files Service
Document upload/download for case management.
POST /files/upload   — multipart: file, case_id, doc_type, name
GET  /files/{id}     — stream file back (JWT required)
GET  /files/health   — liveness probe
"""

import os
import uuid
import mimetypes
import threading
import urllib.request as _ureq
from pathlib import Path

import jwt
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# ── Config ──────────────────────────────────────────────────

JWT_SECRET = os.environ["JWT_SECRET"]
DB_URI = os.environ["DB_URI"]
DATA_DIR = Path(os.environ.get("DATA_DIR", "/data"))
JWT_ALGORITHM = "HS256"

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".txt"}
MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# ── App ──────────────────────────────────────────────────────

app = FastAPI(title="PI Lawyer OS Files", root_path="/files")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bearer = HTTPBearer()

# ── Auth ──────────────────────────────────────────────────────

def get_claims(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    try:
        return jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ── DB helper ────────────────────────────────────────────────

def get_db():
    conn = psycopg2.connect(DB_URI, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
    finally:
        conn.close()

# ── Routes ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    case_id: str = Form(...),
    doc_type: str = Form(default="other"),
    name: str = Form(default=""),
    claims: dict = Depends(get_claims),
    conn=Depends(get_db),
):
    firm_id = claims.get("firm_id")
    user_id = claims.get("sub")
    if not firm_id:
        raise HTTPException(status_code=403, detail="No firm context in token")

    # Validate extension
    original_name = file.filename or "upload"
    ext = Path(original_name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type {ext} not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Read and check size
    content = await file.read()
    if len(content) > MAX_SIZE_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 50MB limit")

    # Store: /data/{firm_id}/{case_id}/{uuid}{ext}
    dest_dir = DATA_DIR / firm_id / case_id
    dest_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = f"{firm_id}/{case_id}/{file_id}{ext}"
    full_path = DATA_DIR / file_path
    full_path.write_bytes(content)

    # Determine MIME type
    mime_type = file.content_type or mimetypes.guess_type(original_name)[0] or "application/octet-stream"

    # Insert document record
    display_name = name or original_name
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO documents (id, firm_id, case_id, name, file_path, file_size, mime_type, doc_type, uploaded_by)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, file_path, doc_type, mime_type, file_size, created_at
            """,
            (file_id, firm_id, case_id, display_name, file_path,
             len(content), mime_type, doc_type, user_id),
        )
        row = dict(cur.fetchone())
        conn.commit()

    # Fire-and-forget: trigger document embedding for RAG (non-blocking)
    def _trigger_embed(doc_id: str) -> None:
        try:
            req = _ureq.Request(
                f"http://pilaweros-ai:8002/embed-document?document_id={doc_id}",
                method="POST",
                headers={"X-Internal-Key": os.environ.get("INTERNAL_API_KEY", "pilaweros_internal_key_changeme")},
            )
            _ureq.urlopen(req, timeout=5)
        except Exception:
            pass  # Non-fatal: embedding is best-effort
    threading.Thread(target=_trigger_embed, args=(str(file_id),), daemon=True).start()

    return {
        "id": row["id"],
        "name": row["name"],
        "file_path": row["file_path"],
        "doc_type": row["doc_type"],
        "mime_type": row["mime_type"],
        "file_size": row["file_size"],
        "created_at": row["created_at"].isoformat() if row["created_at"] else None,
    }


@app.get("/{document_id}")
def download_file(
    document_id: str,
    claims: dict = Depends(get_claims),
    conn=Depends(get_db),
):
    firm_id = claims.get("firm_id")
    if not firm_id:
        raise HTTPException(status_code=403, detail="No firm context in token")

    # Fetch document record (RLS enforced via firm_id check)
    with conn.cursor() as cur:
        cur.execute(
            "SELECT name, file_path, mime_type, firm_id FROM documents WHERE id = %s",
            (document_id,),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    if str(row["firm_id"]) != firm_id:
        raise HTTPException(status_code=403, detail="Access denied")

    full_path = DATA_DIR / row["file_path"]
    if not full_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    mime = row["mime_type"] or "application/octet-stream"
    filename = row["name"]

    def iter_file():
        with open(full_path, "rb") as f:
            while chunk := f.read(65536):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
