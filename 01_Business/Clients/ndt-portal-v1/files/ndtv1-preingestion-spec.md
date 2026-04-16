# ndtv1 — Pre-Ingestion Compliance Classifier & Sanitization Layer
## Build Specification for Claude Code Execution
**Version:** 1.0.0  
**Project:** ndtv1  
**Classification:** Internal Engineering Specification  
**Scope:** Pre-ingestion pipeline only — compliance triage + sanitization before vector storage

---

## 0. Overview & Architecture Position

This spec covers two sequential services that sit **before** the tokenization layer and vector ingestion pipeline:

```
[Document Intake]
       │
       ▼
┌─────────────────────────────┐
│  Service 1: Compliance      │  ← This spec
│  Classifier (ndtv1-comply)  │
└────────────┬────────────────┘
             │ PASS / FLAG / REJECT + classification metadata
             ▼
┌─────────────────────────────┐
│  Service 2: Sanitization    │  ← This spec
│  Layer (ndtv1-sanitize)     │
└────────────┬────────────────┘
             │ Sanitized payload + token manifest
             ▼
     [Tokenization Layer]  ← Separate build
             │
             ▼
     [Vector Storage / pgvector]
```

Both services are **stateless compute** backed by the existing PostgreSQL instance. No new databases required.

---

## 1. Repository Structure

```
ndtv1/
├── CLAUDE.md                          # Project context for Claude Code sessions
├── docker-compose.yml
├── .env.example
│
├── services/
│   ├── comply/                        # Service 1: Compliance Classifier
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py                    # FastAPI entrypoint
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py             # Pydantic request/response models
│   │   │   └── db_models.py           # SQLAlchemy ORM models
│   │   ├── classifiers/
│   │   │   ├── __init__.py
│   │   │   ├── title_block.py         # Title block OCR + field extraction
│   │   │   ├── keyword_scanner.py     # ITAR/EAR keyword detection
│   │   │   ├── cage_lookup.py         # CAGE code resolver
│   │   │   ├── spec_analyzer.py       # MIL-SPEC / distribution statement detector
│   │   │   └── risk_scorer.py         # Composite risk score engine
│   │   ├── extractors/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_extractor.py       # PyMuPDF-based PDF → image + text
│   │   │   ├── image_extractor.py     # Direct image OCR (TIFF, PNG, JPEG)
│   │   │   └── metadata_extractor.py  # XMP, EXIF, PDF metadata
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── classify.py            # POST /classify
│   │   │   ├── review.py              # GET/PATCH /review (human review queue)
│   │   │   └── health.py              # GET /health
│   │   └── tests/
│   │       ├── test_classifier.py
│   │       └── fixtures/
│   │
│   └── sanitize/                      # Service 2: Sanitization Layer
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── main.py
│       ├── config.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── schemas.py
│       │   └── db_models.py
│       ├── sanitizers/
│       │   ├── __init__.py
│       │   ├── text_sanitizer.py      # Presidio-backed text sanitization
│       │   ├── image_sanitizer.py     # Presidio ImageRedactor + bounding boxes
│       │   ├── metadata_sanitizer.py  # Strip all document metadata
│       │   └── recognizers/
│       │       ├── __init__.py
│       │       ├── drawing_number.py  # Custom: DWG-XXXX-RevX patterns
│       │       ├── part_number.py     # Custom: PN- patterns
│       │       ├── project_code.py    # Custom: job/work order IDs
│       │       ├── cert_id.py         # Custom: NADCAP, cert IDs
│       │       ├── cage_code.py       # Custom: 5-char CAGE codes
│       │       └── contract_number.py # Custom: DoD contract numbers
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── sanitize.py            # POST /sanitize
│       │   ├── reidentify.py          # POST /reidentify (controlled)
│       │   └── health.py
│       └── tests/
│           ├── test_sanitizer.py
│           └── fixtures/
│
├── shared/                            # Shared utilities
│   ├── __init__.py
│   ├── db.py                          # SQLAlchemy async engine + session factory
│   ├── crypto.py                      # AES-256-SIV token generation
│   ├── logging.py                     # Structured JSON logging
│   └── exceptions.py                  # Domain exceptions
│
├── migrations/
│   ├── env.py                         # Alembic config
│   └── versions/
│       └── 001_initial_schema.py      # All tables for both services
│
└── scripts/
    ├── seed_keyword_db.py             # Seed ITAR/EAR keyword tables
    ├── seed_cage_codes.py             # Load known defense CAGE codes
    └── test_pipeline.sh               # End-to-end test with sample drawing
```

---

## 2. Environment Variables

```bash
# .env.example

# Database (existing ndtv1 postgres)
DATABASE_URL=postgresql+asyncpg://ndtv1:password@postgres:5432/ndtv1

# Service ports
COMPLY_PORT=8010
SANITIZE_PORT=8011

# Crypto
TOKEN_SECRET_KEY=<32-byte hex — generate with: openssl rand -hex 32>
TOKEN_NAMESPACE=ndtv1-prod

# OCR
PADDLEOCR_LANG=en
TESSERACT_PATH=/usr/bin/tesseract

# Presidio
PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000
PRESIDIO_IMAGE_REDACTOR_URL=http://presidio-image-redactor:3001

# Routing
# Documents flagged ITAR route to local LLM endpoint, not cloud API
LOCAL_LLM_ENDPOINT=http://ollama:11434
CLOUD_LLM_ENDPOINT=https://api.anthropic.com

# Review queue
REQUIRE_HUMAN_REVIEW_FOR=ITAR,NEEDS_REVIEW
AUTO_PASS_CLASSIFICATIONS=CLEAN,EAR_LOW

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json
```

---

## 3. Database Schema

```sql
-- migrations/versions/001_initial_schema.py
-- Run via: alembic upgrade head

-- ─────────────────────────────────────────
-- COMPLY SERVICE TABLES
-- ─────────────────────────────────────────

CREATE TYPE classification_status AS ENUM (
    'CLEAN',           -- No indicators found, safe for cloud LLM
    'EAR_LOW',         -- EAR indicators, low risk, cloud LLM with tokenization
    'EAR_HIGH',        -- EAR indicators, elevated, local LLM only
    'ITAR',            -- ITAR indicators confirmed, local LLM only, flag for review
    'NEEDS_REVIEW',    -- Ambiguous signals, hold for human review
    'REJECTED'         -- Explicit ITAR marking or Distribution D/E/F, do not process
);

CREATE TYPE llm_routing AS ENUM (
    'CLOUD_OK',        -- Can use cloud LLM (with tokenization)
    'LOCAL_ONLY',      -- Must use local inference only
    'HOLD'             -- Do not route until human review complete
);

CREATE TABLE comply_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id           VARCHAR(255) NOT NULL UNIQUE,    -- External reference ID
    filename            VARCHAR(500) NOT NULL,
    file_hash           VARCHAR(64) NOT NULL,             -- SHA-256 of original file
    file_size_bytes     BIGINT NOT NULL,
    mime_type           VARCHAR(100) NOT NULL,
    
    -- Classification result
    classification      classification_status NOT NULL DEFAULT 'NEEDS_REVIEW',
    llm_routing         llm_routing NOT NULL DEFAULT 'HOLD',
    risk_score          DECIMAL(5,2),                    -- 0.00 to 100.00
    confidence          DECIMAL(5,2),                    -- 0.00 to 1.00
    
    -- Extracted title block fields
    drawing_number      VARCHAR(255),
    part_number         VARCHAR(255),
    cage_code           VARCHAR(10),
    revision            VARCHAR(20),
    program_name        VARCHAR(500),
    distribution_stmt   VARCHAR(10),                     -- A, B, C, D, E, F
    
    -- Detection signals (stored as JSONB arrays)
    itar_signals        JSONB DEFAULT '[]',
    ear_signals         JSONB DEFAULT '[]',
    milspec_refs        JSONB DEFAULT '[]',
    usml_categories     JSONB DEFAULT '[]',
    
    -- Flags
    has_explicit_marking    BOOLEAN DEFAULT FALSE,
    has_distribution_stmt   BOOLEAN DEFAULT FALSE,
    has_military_program    BOOLEAN DEFAULT FALSE,
    has_defense_cage        BOOLEAN DEFAULT FALSE,
    has_milspec_refs        BOOLEAN DEFAULT FALSE,
    has_usml_category       BOOLEAN DEFAULT FALSE,
    
    -- Human review
    reviewed_by         VARCHAR(255),
    reviewed_at         TIMESTAMPTZ,
    review_notes        TEXT,
    review_override     classification_status,           -- Human can override classifier
    
    -- Audit
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_ms       INTEGER                          -- Processing time
);

CREATE TABLE comply_keyword_library (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(50) NOT NULL,    -- 'ITAR', 'EAR', 'MILSPEC', 'PROGRAM', 'DISTRIBUTION'
    keyword         VARCHAR(500) NOT NULL,
    weight          DECIMAL(4,2) NOT NULL DEFAULT 1.0,  -- Contribution to risk score
    exact_match     BOOLEAN DEFAULT FALSE,
    description     TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comply_cage_code_registry (
    cage_code       VARCHAR(10) PRIMARY KEY,
    company_name    VARCHAR(500),
    is_defense      BOOLEAN DEFAULT FALSE,
    risk_level      VARCHAR(20),             -- 'HIGH', 'MEDIUM', 'LOW'
    notes           TEXT,
    last_updated    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comply_docs_status ON comply_documents(classification);
CREATE INDEX idx_comply_docs_routing ON comply_documents(llm_routing);
CREATE INDEX idx_comply_docs_intake ON comply_documents(intake_id);
CREATE INDEX idx_comply_docs_cage ON comply_documents(cage_code);


-- ─────────────────────────────────────────
-- SANITIZE SERVICE TABLES
-- ─────────────────────────────────────────

CREATE TYPE entity_type AS ENUM (
    'COMPANY',
    'PERSON',
    'DRAWING',
    'PARTNUM',
    'PROJECT',
    'CERTID',
    'CAGECODE',
    'CONTRACT',
    'SERIAL',
    'LOCATION',
    'EMAIL',
    'PHONE',
    'ADDRESS',
    'CUSTOM'
);

CREATE TABLE sanitize_jobs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comply_doc_id       UUID REFERENCES comply_documents(id),
    intake_id           VARCHAR(255) NOT NULL,
    job_namespace       VARCHAR(64) NOT NULL,    -- Scopes tokens per job/client
    
    -- Sanitization results
    original_hash       VARCHAR(64) NOT NULL,
    sanitized_hash      VARCHAR(64),
    
    -- Counts
    entities_detected   INTEGER DEFAULT 0,
    entities_replaced   INTEGER DEFAULT 0,
    
    -- Text sanitization
    original_text_path  TEXT,                   -- Reference only, not stored
    sanitized_text      TEXT,                   -- Sanitized version safe for LLM
    
    -- Image sanitization
    original_image_path TEXT,
    sanitized_image_path TEXT,
    redaction_regions   JSONB DEFAULT '[]',      -- Bounding boxes that were redacted
    
    -- Metadata strip report
    metadata_removed    JSONB DEFAULT '[]',      -- List of metadata fields removed
    
    status              VARCHAR(50) DEFAULT 'PENDING',
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    completed_at        TIMESTAMPTZ,
    processing_ms       INTEGER
);

CREATE TABLE sanitize_token_vault (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID REFERENCES sanitize_jobs(id) ON DELETE CASCADE,
    job_namespace   VARCHAR(64) NOT NULL,
    
    token           VARCHAR(50) NOT NULL,        -- e.g., COMPANY__A94F7K2M
    entity_type     entity_type NOT NULL,
    
    -- Encrypted original value
    -- Stored as: pgcrypto AES-256 encrypt(original_value, TOKEN_SECRET_KEY)
    encrypted_value BYTEA NOT NULL,
    
    -- For audit and cross-reference
    value_hash      VARCHAR(64) NOT NULL,        -- SHA-256 of plaintext (for dedup lookup)
    
    -- Re-identification access control
    reidentify_roles    TEXT[] DEFAULT ARRAY['admin', 'compliance_officer'],
    
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    accessed_at     TIMESTAMPTZ,
    access_count    INTEGER DEFAULT 0,
    
    UNIQUE(job_namespace, token)
);

CREATE TABLE sanitize_reidentify_audit (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID REFERENCES sanitize_jobs(id),
    token           VARCHAR(50) NOT NULL,
    requested_by    VARCHAR(255) NOT NULL,
    request_reason  TEXT,
    granted         BOOLEAN NOT NULL,
    ip_address      VARCHAR(45),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_vault_namespace ON sanitize_token_vault(job_namespace);
CREATE INDEX idx_token_vault_token ON sanitize_token_vault(token);
CREATE INDEX idx_token_vault_hash ON sanitize_token_vault(value_hash);
CREATE INDEX idx_sanitize_jobs_comply ON sanitize_jobs(comply_doc_id);
CREATE INDEX idx_sanitize_jobs_intake ON sanitize_jobs(intake_id);
```

---

## 4. Service 1: Compliance Classifier (ndtv1-comply)

### 4.1 FastAPI Application — `services/comply/main.py`

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .routes import classify, review, health
from shared.db import init_db
from shared.logging import setup_logging

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield

app = FastAPI(
    title="ndtv1 Compliance Classifier",
    version="1.0.0",
    lifespan=lifespan
)

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(classify.router, prefix="/classify", tags=["classify"])
app.include_router(review.router, prefix="/review", tags=["review"])
```

### 4.2 Pydantic Schemas — `services/comply/models/schemas.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum

class ClassificationStatus(str, Enum):
    CLEAN = "CLEAN"
    EAR_LOW = "EAR_LOW"
    EAR_HIGH = "EAR_HIGH"
    ITAR = "ITAR"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    REJECTED = "REJECTED"

class LLMRouting(str, Enum):
    CLOUD_OK = "CLOUD_OK"
    LOCAL_ONLY = "LOCAL_ONLY"
    HOLD = "HOLD"

class ClassifyRequest(BaseModel):
    intake_id: str = Field(..., description="Caller-supplied unique reference ID")
    filename: str
    file_content: str = Field(..., description="Base64-encoded file content")
    mime_type: str = Field(..., pattern="^(application/pdf|image/(tiff|png|jpeg|jpg))$")
    customer_context: Optional[str] = Field(None, description="Known customer name if available")
    job_namespace: Optional[str] = Field(None, description="Job/client namespace for token scoping")

class DetectedSignal(BaseModel):
    signal_type: str      # 'ITAR_KEYWORD', 'MILSPEC_REF', 'USML_CATEGORY', etc.
    value: str            # What was found
    location: str         # 'TITLE_BLOCK', 'NOTES', 'DRAWING_FIELD', 'METADATA'
    weight: float         # Risk contribution
    confidence: float

class TitleBlockFields(BaseModel):
    drawing_number: Optional[str] = None
    part_number: Optional[str] = None
    cage_code: Optional[str] = None
    revision: Optional[str] = None
    program_name: Optional[str] = None
    distribution_statement: Optional[str] = None
    title: Optional[str] = None
    sheet: Optional[str] = None
    scale: Optional[str] = None

class ClassifyResponse(BaseModel):
    doc_id: UUID
    intake_id: str
    classification: ClassificationStatus
    llm_routing: LLMRouting
    risk_score: float
    confidence: float
    title_block: TitleBlockFields
    itar_signals: List[DetectedSignal]
    ear_signals: List[DetectedSignal]
    milspec_refs: List[str]
    usml_categories: List[str]
    flags: dict
    processing_ms: int
    requires_human_review: bool
    review_reason: Optional[str] = None

class ReviewUpdateRequest(BaseModel):
    reviewer_id: str
    override_classification: Optional[ClassificationStatus] = None
    notes: str
    approved: bool
```

### 4.3 Classification Route — `services/comply/routes/classify.py`

```python
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import base64, time
from uuid import uuid4

from shared.db import get_session
from ..models.schemas import ClassifyRequest, ClassifyResponse
from ..extractors.pdf_extractor import extract_pdf
from ..extractors.image_extractor import extract_image
from ..extractors.metadata_extractor import extract_metadata
from ..classifiers.title_block import extract_title_block
from ..classifiers.keyword_scanner import scan_keywords
from ..classifiers.cage_lookup import lookup_cage
from ..classifiers.spec_analyzer import analyze_specs
from ..classifiers.risk_scorer import compute_risk_score

router = APIRouter()

@router.post("", response_model=ClassifyResponse)
async def classify_document(
    request: ClassifyRequest,
    session: AsyncSession = Depends(get_session)
):
    start_ms = time.time()
    
    # Decode file
    file_bytes = base64.b64decode(request.file_content)
    file_hash = compute_sha256(file_bytes)
    
    # Check for duplicate (idempotent)
    existing = await get_existing_classification(session, file_hash)
    if existing:
        return existing
    
    # Step 1: Extract content based on MIME type
    if request.mime_type == "application/pdf":
        extracted = await extract_pdf(file_bytes)
    else:
        extracted = await extract_image(file_bytes)
    
    # Step 2: Extract metadata (for stripping later)
    metadata = await extract_metadata(file_bytes, request.mime_type)
    
    # Step 3: Extract title block fields
    title_block = await extract_title_block(
        extracted.images,     # List of page images
        extracted.text_blocks # OCR text with bounding boxes
    )
    
    # Step 4: Run all classifiers in parallel
    keyword_signals = await scan_keywords(extracted.full_text, title_block)
    cage_signals = await lookup_cage(title_block.cage_code, session) if title_block.cage_code else []
    spec_signals = await analyze_specs(extracted.full_text, title_block)
    
    # Step 5: Compute composite risk score
    all_signals = keyword_signals + cage_signals + spec_signals
    score_result = compute_risk_score(all_signals, title_block)
    
    # Step 6: Persist and return
    doc = await save_classification(
        session, request, file_hash, title_block, score_result, all_signals
    )
    
    elapsed = int((time.time() - start_ms) * 1000)
    
    return ClassifyResponse(
        doc_id=doc.id,
        intake_id=request.intake_id,
        classification=score_result.classification,
        llm_routing=score_result.llm_routing,
        risk_score=score_result.risk_score,
        confidence=score_result.confidence,
        title_block=title_block,
        itar_signals=[s for s in all_signals if s.signal_type.startswith('ITAR')],
        ear_signals=[s for s in all_signals if s.signal_type.startswith('EAR')],
        milspec_refs=score_result.milspec_refs,
        usml_categories=score_result.usml_categories,
        flags=score_result.flags,
        processing_ms=elapsed,
        requires_human_review=score_result.classification in ['NEEDS_REVIEW', 'ITAR'],
        review_reason=score_result.review_reason
    )
```

### 4.4 Title Block Extractor — `services/comply/classifiers/title_block.py`

```python
"""
Title block extraction for engineering drawings.
Strategy: Detect title block region (typically bottom 20-25% of drawing),
run targeted OCR on that region, parse known field labels.
"""
import re
from dataclasses import dataclass
from typing import List, Optional
from paddleocr import PaddleOCR

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

# Common title block field label patterns
FIELD_PATTERNS = {
    'drawing_number': [
        r'(?:DWG|DRAWING|DRG)[.\s#-]*(?:NO|NUM|NUMBER)?[.\s:]*([A-Z0-9\-]{3,30})',
        r'(?:DOC|DOCUMENT)[.\s#-]*(?:NO|NUM|NUMBER)?[.\s:]*([A-Z0-9\-]{3,30})',
    ],
    'part_number': [
        r'(?:P/N|PN|PART[.\s]?NO|PART[.\s]?NUMBER)[.\s:]*([A-Z0-9\-\/]{3,30})',
    ],
    'cage_code': [
        r'(?:CAGE|CAGE[.\s]?CODE)[.\s:]*([A-Z0-9]{5})\b',
        r'\b([A-Z0-9]{5})\b(?=.*(?:CAGE|SUPPLIER|MFR))',
    ],
    'revision': [
        r'(?:REV|REVISION|RV)[.\s:]*([A-Z0-9\-]{1,5})\b',
    ],
    'distribution_statement': [
        r'DISTRIBUTION[.\s]?STATEMENT[.\s:]*([A-F])\b',
        r'DIST[.\s]?STMT[.\s:]*([A-F])\b',
    ],
    'program_name': [
        r'(?:PROGRAM|PROJECT|ACFT|AIRCRAFT|SYSTEM)[.\s:]*([A-Z0-9\s\-]{3,50})',
    ],
    'export_marking': [
        r'(EXPORT[.\s]CONTROLLED)',
        r'(ITAR[.\s]CONTROLLED)',
        r'(EAR[.\s]CONTROLLED)',
        r'ECCN[.\s:]*([A-Z0-9]{5,8})',
        r'(SUBJECT[.\s]TO[.\s]EAR)',
        r'(NO[.\s]LICENSE[.\s]REQUIRED)',
        r'(EXPORT[.\s]ADMIN[.\s]REGULATIONS)',
    ]
}

async def extract_title_block(images: list, text_blocks: list) -> dict:
    results = {}
    
    for image in images:
        # Focus on bottom 25% — standard title block location
        h = image.shape[0]
        title_region = image[int(h * 0.75):h, :]
        
        ocr_result = ocr.ocr(title_region, cls=True)
        if not ocr_result or not ocr_result[0]:
            continue
            
        full_text = ' '.join([line[1][0] for line in ocr_result[0]])
        
        for field, patterns in FIELD_PATTERNS.items():
            if field in results:
                continue
            for pattern in patterns:
                match = re.search(pattern, full_text, re.IGNORECASE)
                if match:
                    results[field] = match.group(1).strip()
                    break
    
    return results
```

### 4.5 Keyword Scanner — `services/comply/classifiers/keyword_scanner.py`

```python
"""
Scans document text against the keyword library in PostgreSQL.
Supports exact match and regex pattern matching.
"""
from sqlalchemy import select
from ..models.db_models import KeywordLibrary

# Hard-coded critical keywords that always trigger regardless of DB state
CRITICAL_ITAR_KEYWORDS = [
    "ITAR CONTROLLED", "EXPORT CONTROLLED", "SUBJECT TO ITAR",
    "DISTRIBUTION STATEMENT D", "DISTRIBUTION STATEMENT E", 
    "DISTRIBUTION STATEMENT F", "USML CATEGORY",
    "TECHNICAL DATA CONTROLLED", "NOT FOR EXPORT"
]

USML_CATEGORIES = {
    "CAT IV": "Launch vehicles, guided missiles",
    "CAT VIII": "Aircraft, engines, associated equipment",
    "CAT X": "Personal protective equipment",
    "CAT XI": "Military electronics",
    "CAT XII": "Fire control, laser equipment",
    "CAT XIII": "Materials and miscellaneous articles",
    "CAT XV": "Spacecraft systems",
    "CAT XVI": "Nuclear weapons design equipment",
    "CATEGORY IV": "Launch vehicles, guided missiles",
    "CATEGORY VIII": "Aircraft, engines, associated equipment",
}

MILITARY_PROGRAMS = [
    "F-35", "F35", "JSF", "JOINT STRIKE FIGHTER",
    "F-22", "F22", "RAPTOR",
    "F-16", "F16", "FALCON",
    "F-18", "F18", "F/A-18", "HORNET", "SUPER HORNET",
    "B-2", "B2", "SPIRIT",
    "B-21", "B21", "RAIDER",
    "AH-64", "AH64", "APACHE",
    "UH-60", "UH60", "BLACKHAWK",
    "CH-47", "CH47", "CHINOOK",
    "V-22", "V22", "OSPREY",
    "A-10", "A10", "WARTHOG",
    "PATRIOT", "HIMARS", "JAVELIN", "STINGER",
    "TRIDENT", "MINUTEMAN", "ATLAS V",
    "EEEV", "EVOLVED EXPENDABLE",
]

MILSPEC_PATTERNS = [
    r"MIL-DTL-\d+",
    r"MIL-PRF-\d+",
    r"MIL-STD-\d+",
    r"MIL-HDBK-\d+",
    r"MIL-SPEC-\d+",
    r"MIL-[A-Z]+-\d+",
    r"DEF-STAN-\d+-\d+",
    r"ASTM[.\s][A-Z]\d+",    # Some ASTM specs are controlled
    r"AMS[.\s]\d+",          # Aerospace Material Specs
    r"NASM\d+",              # National Aerospace Standard
    r"AN[.\s]\d+",           # Army-Navy standards
    r"MS\d+",                # Military Standard parts
    r"NAS\d+",               # National Aerospace Standard
]

async def scan_keywords(text: str, title_block: dict, session) -> list:
    signals = []
    text_upper = text.upper()
    
    # 1. Critical ITAR keywords (always ITAR classification)
    for keyword in CRITICAL_ITAR_KEYWORDS:
        if keyword in text_upper:
            signals.append({
                'signal_type': 'ITAR_CRITICAL_KEYWORD',
                'value': keyword,
                'location': 'DOCUMENT',
                'weight': 10.0,  # Maximum weight
                'confidence': 1.0
            })
    
    # 2. Distribution statement in title block
    dist_stmt = title_block.get('distribution_statement')
    if dist_stmt and dist_stmt.upper() in ['D', 'E', 'F']:
        signals.append({
            'signal_type': 'ITAR_DISTRIBUTION_STATEMENT',
            'value': f"DISTRIBUTION STATEMENT {dist_stmt.upper()}",
            'location': 'TITLE_BLOCK',
            'weight': 10.0,
            'confidence': 1.0
        })
    elif dist_stmt and dist_stmt.upper() in ['B', 'C']:
        signals.append({
            'signal_type': 'EAR_DISTRIBUTION_STATEMENT',
            'value': f"DISTRIBUTION STATEMENT {dist_stmt.upper()}",
            'location': 'TITLE_BLOCK',
            'weight': 7.0,
            'confidence': 0.95
        })
    
    # 3. USML category references
    import re
    for category, description in USML_CATEGORIES.items():
        if category in text_upper:
            signals.append({
                'signal_type': 'ITAR_USML_CATEGORY',
                'value': f"{category} — {description}",
                'location': 'DOCUMENT',
                'weight': 9.0,
                'confidence': 0.95
            })
    
    # 4. Military program references
    for program in MILITARY_PROGRAMS:
        if program.upper() in text_upper:
            signals.append({
                'signal_type': 'ITAR_MILITARY_PROGRAM',
                'value': program,
                'location': 'DOCUMENT',
                'weight': 6.0,
                'confidence': 0.80
            })
    
    # 5. MIL-SPEC references
    for pattern in MILSPEC_PATTERNS:
        matches = re.findall(pattern, text_upper)
        for match in matches:
            signals.append({
                'signal_type': 'MILSPEC_REFERENCE',
                'value': match,
                'location': 'NOTES',
                'weight': 3.0,
                'confidence': 0.85
            })
    
    # 6. Load additional keywords from DB
    db_keywords = await session.execute(
        select(KeywordLibrary).where(KeywordLibrary.active == True)
    )
    for kw in db_keywords.scalars():
        if kw.exact_match:
            if kw.keyword.upper() in text_upper:
                signals.append({
                    'signal_type': f'{kw.category}_DB_KEYWORD',
                    'value': kw.keyword,
                    'location': 'DOCUMENT',
                    'weight': float(kw.weight),
                    'confidence': 0.85
                })
        else:
            matches = re.findall(kw.keyword, text_upper, re.IGNORECASE)
            for match in matches:
                signals.append({
                    'signal_type': f'{kw.category}_DB_PATTERN',
                    'value': match,
                    'location': 'DOCUMENT',
                    'weight': float(kw.weight),
                    'confidence': 0.75
                })
    
    return signals
```

### 4.6 Risk Scorer — `services/comply/classifiers/risk_scorer.py`

```python
"""
Composite risk scoring engine.
Converts detected signals into a classification and LLM routing decision.
"""
from dataclasses import dataclass
from typing import List, Optional

@dataclass
class ScoreResult:
    risk_score: float           # 0-100
    confidence: float           # 0-1
    classification: str
    llm_routing: str
    milspec_refs: List[str]
    usml_categories: List[str]
    flags: dict
    review_reason: Optional[str]

# Score thresholds
THRESHOLDS = {
    'REJECTED':     {'min_score': 0, 'requires_critical': True},  # Any critical ITAR keyword = REJECTED
    'ITAR':         {'min_score': 25},
    'NEEDS_REVIEW': {'min_score': 15},
    'EAR_HIGH':     {'min_score': 10},
    'EAR_LOW':      {'min_score': 5},
    'CLEAN':        {'min_score': 0},
}

ROUTING_MAP = {
    'REJECTED':     'HOLD',
    'ITAR':         'LOCAL_ONLY',
    'NEEDS_REVIEW': 'HOLD',
    'EAR_HIGH':     'LOCAL_ONLY',
    'EAR_LOW':      'CLOUD_OK',
    'CLEAN':        'CLOUD_OK',
}

def compute_risk_score(signals: list, title_block: dict) -> ScoreResult:
    # Check for instant rejection triggers
    critical_signals = [s for s in signals if s.get('weight', 0) >= 10.0]
    if critical_signals:
        return ScoreResult(
            risk_score=100.0,
            confidence=1.0,
            classification='REJECTED',
            llm_routing='HOLD',
            milspec_refs=_extract_milspecs(signals),
            usml_categories=_extract_usml(signals),
            flags=_build_flags(signals, title_block),
            review_reason=f"Critical ITAR indicator: {critical_signals[0]['value']}"
        )
    
    # Compute weighted score
    total_score = min(sum(s.get('weight', 0) for s in signals), 100.0)
    
    # Signal count weighting (more signals = more confident)
    signal_count = len(signals)
    confidence = min(0.5 + (signal_count * 0.1), 1.0)
    
    # Determine classification
    if total_score >= THRESHOLDS['ITAR']['min_score']:
        classification = 'ITAR'
        review_reason = f"Risk score {total_score:.1f} — ITAR threshold exceeded"
    elif total_score >= THRESHOLDS['NEEDS_REVIEW']['min_score']:
        classification = 'NEEDS_REVIEW'
        review_reason = f"Risk score {total_score:.1f} — ambiguous signals require review"
    elif total_score >= THRESHOLDS['EAR_HIGH']['min_score']:
        classification = 'EAR_HIGH'
        review_reason = None
    elif total_score >= THRESHOLDS['EAR_LOW']['min_score']:
        classification = 'EAR_LOW'
        review_reason = None
    else:
        classification = 'CLEAN'
        review_reason = None
    
    return ScoreResult(
        risk_score=total_score,
        confidence=confidence,
        classification=classification,
        llm_routing=ROUTING_MAP[classification],
        milspec_refs=_extract_milspecs(signals),
        usml_categories=_extract_usml(signals),
        flags=_build_flags(signals, title_block),
        review_reason=review_reason
    )

def _build_flags(signals, title_block) -> dict:
    signal_types = [s.get('signal_type', '') for s in signals]
    return {
        'has_explicit_marking': any('CRITICAL_KEYWORD' in t for t in signal_types),
        'has_distribution_stmt': any('DISTRIBUTION' in t for t in signal_types),
        'has_military_program': any('MILITARY_PROGRAM' in t for t in signal_types),
        'has_defense_cage': any('CAGE' in t for t in signal_types),
        'has_milspec_refs': any('MILSPEC' in t for t in signal_types),
        'has_usml_category': any('USML' in t for t in signal_types),
    }
```

---

## 5. Service 2: Sanitization Layer (ndtv1-sanitize)

### 5.1 Custom Presidio Recognizers

**Drawing Number Recognizer — `services/sanitize/sanitizers/recognizers/drawing_number.py`**

```python
from presidio_analyzer import PatternRecognizer, Pattern

class DrawingNumberRecognizer(PatternRecognizer):
    """
    Detects engineering drawing numbers.
    Common formats: DWG-LM-4471-RevC, 1234567-001, ABC-XXXX-XXX
    """
    PATTERNS = [
        Pattern("DRAWING_NUMBER_DWG", r"\bDWG[-\s]?[A-Z0-9]{2,}[-\s]?[A-Z0-9\-]{2,20}\b", 0.85),
        Pattern("DRAWING_NUMBER_NUMERIC", r"\b\d{7,10}[-\s]?\d{3}\b", 0.75),
        Pattern("DRAWING_NUMBER_ALPHA", r"\b[A-Z]{1,5}[-_]\d{4,6}[-_][A-Z0-9]{1,5}\b", 0.70),
        Pattern("DRAWING_NUMBER_DOC", r"\bDOC[-\s]?[A-Z0-9\-]{5,25}\b", 0.80),
    ]
    
    def __init__(self):
        super().__init__(
            supported_entity="DRAWING_NUMBER",
            patterns=self.PATTERNS,
            context=["drawing", "drg", "dwg", "document", "number", "no.", "#"],
        )
```

**Part Number Recognizer — `services/sanitize/sanitizers/recognizers/part_number.py`**

```python
from presidio_analyzer import PatternRecognizer, Pattern

class PartNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("PART_NUMBER_PN", r"\bP/?N[-:\s]?[A-Z0-9\-\/]{3,25}\b", 0.90),
        Pattern("PART_NUMBER_DASH", r"\b[A-Z]{1,4}-\d{4,8}[-\/]?\d{0,4}\b", 0.70),
        Pattern("PART_NUMBER_NSN", r"\b\d{4}-\d{2}-\d{3}-\d{4}\b", 0.95),  # NATO Stock Number
    ]
    
    def __init__(self):
        super().__init__(
            supported_entity="PART_NUMBER",
            patterns=self.PATTERNS,
            context=["part", "p/n", "pn", "item", "stock", "nsn"],
        )
```

**CAGE Code Recognizer — `services/sanitize/sanitizers/recognizers/cage_code.py`**

```python
from presidio_analyzer import PatternRecognizer, Pattern

class CAGECodeRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("CAGE_CODE", r"\b[A-Z0-9]{5}\b", 0.60),  # Low base — needs context
    ]
    
    def __init__(self):
        super().__init__(
            supported_entity="CAGE_CODE",
            patterns=self.PATTERNS,
            context=["cage", "cage code", "supplier", "vendor", "manufacturer", "mfr", "mfg"],
        )
```

**DoD Contract Number Recognizer — `services/sanitize/sanitizers/recognizers/contract_number.py`**

```python
from presidio_analyzer import PatternRecognizer, Pattern

class ContractNumberRecognizer(PatternRecognizer):
    """
    DoD contract format: FA8620-21-C-0042, W911NF-20-1-0001, N00019-18-C-0001
    Format: Activity Code (2 alpha) + Station Code (4 digit) + FY (2 digit) + 
            Type (1 alpha) + Serial (4 digit)
    """
    PATTERNS = [
        Pattern("DOD_CONTRACT", 
            r"\b[A-Z]{1,2}\d{4,6}-\d{2}-[A-Z]-\d{4,5}\b", 0.90),
        Pattern("CONTRACT_GEN",
            r"\b(?:CONTRACT|CONT|CONTR)[.\s#:]*([A-Z0-9\-]{8,20})\b", 0.80),
        Pattern("DFARS_REF",
            r"\bDFARS[-\s]?\d+\.\d+\b", 0.85),
    ]
    
    def __init__(self):
        super().__init__(
            supported_entity="CONTRACT_NUMBER",
            patterns=self.PATTERNS,
            context=["contract", "award", "dfars", "far", "solicitation"],
        )
```

### 5.2 Token Generation — `shared/crypto.py`

```python
"""
Deterministic reversible token generation.
Same input + same namespace = same token every time.
Uses HMAC-SHA256 for deterministic derivation, pgcrypto for storage encryption.
"""
import hmac
import hashlib
import base64
import os
from typing import Optional

class TokenVault:
    def __init__(self, secret_key: bytes, namespace: str):
        self.secret_key = secret_key
        self.namespace = namespace
    
    def generate_token(self, entity_type: str, value: str) -> str:
        """
        Deterministic: same value+namespace always produces same token.
        Token format: ENTITYTYPE__XXXXXXXX (8 char base62)
        """
        scoped_input = f"{self.namespace}:{entity_type}:{value}"
        h = hmac.new(
            self.secret_key,
            scoped_input.encode('utf-8'),
            hashlib.sha256
        ).digest()
        # Base62 encode for safe use in LLM prompts
        token_part = base64.urlsafe_b64encode(h)[:8].decode('utf-8').upper()
        return f"{entity_type.upper()}__{token_part}"
    
    def get_value_hash(self, value: str) -> str:
        """SHA-256 hash of plaintext for dedup lookups without decryption."""
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

def encrypt_value(value: str, key: bytes) -> bytes:
    """AES-256-GCM encryption for vault storage."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, value.encode('utf-8'), None)
    return nonce + ciphertext  # Prepend nonce for storage

def decrypt_value(encrypted: bytes, key: bytes) -> str:
    """AES-256-GCM decryption from vault."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    nonce = encrypted[:12]
    ciphertext = encrypted[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode('utf-8')
```

### 5.3 Text Sanitizer — `services/sanitize/sanitizers/text_sanitizer.py`

```python
"""
Presidio-based text sanitization with custom NDT recognizers.
Produces sanitized text + token manifest for vault storage.
"""
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig
from typing import Tuple
import re

from .recognizers.drawing_number import DrawingNumberRecognizer
from .recognizers.part_number import PartNumberRecognizer
from .recognizers.cage_code import CAGECodeRecognizer
from .recognizers.contract_number import ContractNumberRecognizer
from shared.crypto import TokenVault

class NDTTextSanitizer:
    def __init__(self, vault: TokenVault):
        self.vault = vault
        self.analyzer = self._build_analyzer()
        self.anonymizer = AnonymizerEngine()
    
    def _build_analyzer(self) -> AnalyzerEngine:
        registry = RecognizerRegistry()
        registry.load_predefined_recognizers()
        
        # Add NDT domain-specific recognizers
        registry.add_recognizer(DrawingNumberRecognizer())
        registry.add_recognizer(PartNumberRecognizer())
        registry.add_recognizer(CAGECodeRecognizer())
        registry.add_recognizer(ContractNumberRecognizer())
        
        return AnalyzerEngine(registry=registry)
    
    def sanitize(self, text: str) -> Tuple[str, dict]:
        """
        Returns: (sanitized_text, token_manifest)
        token_manifest: {token: original_value} for vault storage
        """
        # Detect entities
        results = self.analyzer.analyze(
            text=text,
            language='en',
            entities=[
                "PERSON", "ORGANIZATION", "EMAIL_ADDRESS", "PHONE_NUMBER",
                "LOCATION", "URL", "IP_ADDRESS",
                # Custom NDT entities
                "DRAWING_NUMBER", "PART_NUMBER", "CAGE_CODE", "CONTRACT_NUMBER",
            ],
            score_threshold=0.6
        )
        
        token_manifest = {}
        
        # Build operator map: each entity type gets a custom replace operator
        operators = {}
        for result in results:
            original_value = text[result.start:result.end]
            token = self.vault.generate_token(result.entity_type, original_value)
            token_manifest[token] = original_value
            operators[result.entity_type] = OperatorConfig(
                "replace", {"new_value": token}
            )
        
        # Anonymize
        anonymized = self.anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators=operators
        )
        
        return anonymized.text, token_manifest
    
    def reidentify(self, sanitized_text: str, token_manifest: dict) -> str:
        """Reverse token replacement for authorized consumers."""
        result = sanitized_text
        for token, original in token_manifest.items():
            result = result.replace(token, original)
        return result
```

### 5.4 Image Sanitizer — `services/sanitize/sanitizers/image_sanitizer.py`

```python
"""
Image redaction pipeline for engineering drawings.
Strategy:
1. Run OCR to get text with bounding boxes
2. Run text sanitizer to identify entities
3. Black-box redact identified regions in original image
4. Return redacted image + bounding box manifest
"""
import numpy as np
import cv2
from paddleocr import PaddleOCR
from typing import List, Tuple
import fitz  # PyMuPDF

from .text_sanitizer import NDTTextSanitizer

ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)

class NDTImageSanitizer:
    def __init__(self, text_sanitizer: NDTTextSanitizer):
        self.text_sanitizer = text_sanitizer
    
    async def sanitize_image(self, image_bytes: bytes) -> dict:
        """
        Returns:
        - redacted_image_bytes: image with sensitive regions blacked out
        - ocr_text: full OCR text
        - sanitized_text: tokenized OCR text for LLM
        - token_manifest: {token: original} mapping
        - redaction_regions: list of bounding boxes that were redacted
        """
        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            raise ValueError("Could not decode image")
        
        # OCR with bounding boxes
        ocr_result = ocr.ocr(image, cls=True)
        if not ocr_result or not ocr_result[0]:
            return {
                'redacted_image_bytes': image_bytes,
                'ocr_text': '',
                'sanitized_text': '',
                'token_manifest': {},
                'redaction_regions': []
            }
        
        # Build word→bbox mapping
        word_bboxes = []
        full_text_parts = []
        for line in ocr_result[0]:
            bbox = line[0]   # [[x1,y1],[x2,y1],[x2,y2],[x1,y2]]
            text = line[1][0]
            confidence = line[1][1]
            if confidence > 0.5:
                word_bboxes.append({'text': text, 'bbox': bbox, 'confidence': confidence})
                full_text_parts.append(text)
        
        full_text = ' '.join(full_text_parts)
        
        # Sanitize the OCR text
        sanitized_text, token_manifest = self.text_sanitizer.sanitize(full_text)
        
        # Find which words were replaced (appear in token_manifest values)
        redaction_regions = []
        redacted_image = image.copy()
        
        for token, original_value in token_manifest.items():
            # Find words in OCR output that match original values
            for word_info in word_bboxes:
                if word_info['text'].strip().upper() in original_value.upper():
                    bbox = word_info['bbox']
                    # Convert polygon to rectangle
                    x_coords = [p[0] for p in bbox]
                    y_coords = [p[1] for p in bbox]
                    x1, y1 = int(min(x_coords)) - 3, int(min(y_coords)) - 3
                    x2, y2 = int(max(x_coords)) + 3, int(max(y_coords)) + 3
                    
                    # Black out the region
                    cv2.rectangle(redacted_image, (x1, y1), (x2, y2), (0, 0, 0), -1)
                    
                    redaction_regions.append({
                        'token': token,
                        'entity_type': token.split('__')[0],
                        'bbox': {'x1': x1, 'y1': y1, 'x2': x2, 'y2': y2},
                        'original_word': word_info['text']
                    })
        
        # Encode redacted image back to bytes
        _, buffer = cv2.imencode('.png', redacted_image)
        redacted_bytes = buffer.tobytes()
        
        return {
            'redacted_image_bytes': redacted_bytes,
            'ocr_text': full_text,
            'sanitized_text': sanitized_text,
            'token_manifest': token_manifest,
            'redaction_regions': redaction_regions
        }
    
    async def sanitize_pdf(self, pdf_bytes: bytes) -> dict:
        """
        Multi-page PDF sanitization.
        Returns per-page results + combined sanitized text.
        """
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        all_results = []
        combined_sanitized_text = []
        combined_token_manifest = {}
        
        for page_num, page in enumerate(doc):
            # Render page to image at 300 DPI
            mat = fitz.Matrix(300/72, 300/72)
            pix = page.get_pixmap(matrix=mat)
            page_image_bytes = pix.tobytes("png")
            
            page_result = await self.sanitize_image(page_image_bytes)
            page_result['page_number'] = page_num + 1
            all_results.append(page_result)
            
            combined_sanitized_text.append(page_result['sanitized_text'])
            combined_token_manifest.update(page_result['token_manifest'])
        
        doc.close()
        
        return {
            'pages': all_results,
            'combined_sanitized_text': '\n\n'.join(combined_sanitized_text),
            'combined_token_manifest': combined_token_manifest,
            'total_redactions': sum(len(r['redaction_regions']) for r in all_results)
        }
```

### 5.5 Metadata Sanitizer — `services/sanitize/sanitizers/metadata_sanitizer.py`

```python
"""
Strip all embedded metadata from documents before LLM processing.
Handles: PDF XMP/metadata, image EXIF, file system timestamps.
"""
import fitz
from PIL import Image
from PIL.ExifTags import TAGS
import io
import piexif

METADATA_FIELDS_TO_STRIP = [
    'Author', 'Creator', 'Producer', 'Subject', 'Keywords',
    'Company', 'LastModifiedBy', 'Manager', 'Template',
    'Title',  # Drawing title OK for LLM but strip author/company
]

async def strip_pdf_metadata(pdf_bytes: bytes) -> tuple:
    """Returns (clean_pdf_bytes, removed_fields_report)"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    removed = []
    
    # Get existing metadata
    metadata = doc.metadata
    for field, value in metadata.items():
        if value:
            removed.append({'field': field, 'had_value': True})
    
    # Strip all metadata
    doc.set_metadata({})
    
    # Also strip XMP metadata
    try:
        doc.del_xml_metadata()
    except:
        pass
    
    clean_bytes = doc.tobytes(garbage=4, deflate=True)
    doc.close()
    
    return clean_bytes, removed

async def strip_image_metadata(image_bytes: bytes, mime_type: str) -> tuple:
    """Returns (clean_image_bytes, removed_fields_report)"""
    removed = []
    
    img = Image.open(io.BytesIO(image_bytes))
    
    # Extract EXIF data for reporting
    exif_data = img._getexif() if hasattr(img, '_getexif') and img._getexif() else {}
    if exif_data:
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            removed.append({'field': str(tag), 'had_value': bool(value)})
    
    # Create clean image without EXIF
    clean_buffer = io.BytesIO()
    
    # Convert to RGB if needed (strips alpha + EXIF)
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGB')
    
    # Save without EXIF
    img.save(clean_buffer, format='PNG', optimize=True)
    clean_buffer.seek(0)
    
    return clean_buffer.read(), removed
```

### 5.6 Sanitize Route — `services/sanitize/routes/sanitize.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import base64, time, os
from uuid import uuid4

from shared.db import get_session
from shared.crypto import TokenVault, encrypt_value
from ..models.schemas import SanitizeRequest, SanitizeResponse
from ..sanitizers.text_sanitizer import NDTTextSanitizer
from ..sanitizers.image_sanitizer import NDTImageSanitizer
from ..sanitizers.metadata_sanitizer import strip_pdf_metadata, strip_image_metadata

router = APIRouter()

@router.post("", response_model=SanitizeResponse)
async def sanitize_document(
    request: SanitizeRequest,
    session: AsyncSession = Depends(get_session)
):
    start_ms = time.time()
    
    secret_key = bytes.fromhex(os.environ['TOKEN_SECRET_KEY'])
    namespace = request.job_namespace or os.environ.get('TOKEN_NAMESPACE', 'default')
    
    vault = TokenVault(secret_key=secret_key, namespace=namespace)
    text_sanitizer = NDTTextSanitizer(vault=vault)
    image_sanitizer = NDTImageSanitizer(text_sanitizer=text_sanitizer)
    
    file_bytes = base64.b64decode(request.file_content)
    
    # Step 1: Strip metadata FIRST (before any processing)
    if request.mime_type == 'application/pdf':
        clean_bytes, metadata_removed = await strip_pdf_metadata(file_bytes)
        result = await image_sanitizer.sanitize_pdf(clean_bytes)
    else:
        clean_bytes, metadata_removed = await strip_image_metadata(file_bytes, request.mime_type)
        result = await image_sanitizer.sanitize_image(clean_bytes)
    
    # Step 2: Persist job record
    job_id = uuid4()
    await save_sanitize_job(session, job_id, request, result, metadata_removed)
    
    # Step 3: Persist token vault entries
    token_manifest = result.get('combined_token_manifest') or result.get('token_manifest', {})
    for token, original_value in token_manifest.items():
        entity_type = token.split('__')[0]
        encrypted = encrypt_value(original_value, secret_key)
        value_hash = vault.get_value_hash(original_value)
        await save_token(session, job_id, namespace, token, entity_type, encrypted, value_hash)
    
    await session.commit()
    elapsed = int((time.time() - start_ms) * 1000)
    
    # Return sanitized content — NEVER return original values
    pages = result.get('pages', [])
    
    return SanitizeResponse(
        job_id=str(job_id),
        intake_id=request.intake_id,
        sanitized_text=result.get('combined_sanitized_text') or result.get('sanitized_text', ''),
        sanitized_image_b64=base64.b64encode(
            pages[0]['redacted_image_bytes'] if pages else result.get('redacted_image_bytes', b'')
        ).decode() if request.return_image else None,
        token_count=len(token_manifest),
        tokens_by_type=_count_by_type(token_manifest),
        redaction_count=result.get('total_redactions') or len(result.get('redaction_regions', [])),
        metadata_fields_removed=metadata_removed,
        processing_ms=elapsed
    )

@router.post("/reidentify")
async def reidentify(
    request: ReidentifyRequest,
    session: AsyncSession = Depends(get_session)
):
    """
    Controlled re-identification. 
    Requires: valid job_id, caller role in reidentify_roles, audit trail.
    """
    # Validate caller has permission
    # Log all re-identification attempts regardless of outcome
    # Retrieve only tokens caller is authorized for
    # Return reconstituted text
    pass
```

---

## 6. Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  comply:
    build:
      context: .
      dockerfile: services/comply/Dockerfile
    container_name: ndtv1-comply
    ports:
      - "${COMPLY_PORT:-8010}:8010"
    env_file: .env
    depends_on:
      - postgres
      - presidio-analyzer
    volumes:
      - ./shared:/app/shared
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8010/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  sanitize:
    build:
      context: .
      dockerfile: services/sanitize/Dockerfile
    container_name: ndtv1-sanitize
    ports:
      - "${SANITIZE_PORT:-8011}:8011"
    env_file: .env
    depends_on:
      - postgres
      - presidio-analyzer
      - presidio-image-redactor
    volumes:
      - ./shared:/app/shared
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8011/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
    container_name: ndtv1-presidio-analyzer
    ports:
      - "3000:3000"
    restart: unless-stopped

  presidio-image-redactor:
    image: mcr.microsoft.com/presidio-image-redactor:latest
    container_name: ndtv1-presidio-image-redactor
    ports:
      - "3001:3001"
    restart: unless-stopped

  # Use existing postgres — add to existing compose or reference external
  postgres:
    image: postgres:16-alpine
    container_name: ndtv1-postgres
    environment:
      POSTGRES_DB: ndtv1
      POSTGRES_USER: ndtv1
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    restart: unless-stopped

volumes:
  pgdata:
```

---

## 7. Python Dependencies

```txt
# services/comply/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.3
pydantic==2.9.0
pydantic-settings==2.5.2
pymupdf==1.24.11         # PDF processing
paddleocr==2.8.1         # Layout-aware OCR
paddlepaddle==2.6.2      # PaddleOCR backend
pillow==10.4.0
numpy==1.26.4
opencv-python-headless==4.10.0.84
httpx==0.27.2
python-multipart==0.0.12
cryptography==43.0.1

# services/sanitize/requirements.txt (above + )
presidio-analyzer==2.2.355
presidio-anonymizer==2.2.355
presidio-image-redactor==0.0.55
piexif==1.1.3
spacy==3.7.6
en-core-web-lg @ https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.7.1/en_core_web_lg-3.7.1-py3-none-any.whl
```

---

## 8. API Contract Summary

### Compliance Classifier

| Endpoint | Method | Description |
|---|---|---|
| `/classify` | POST | Submit document for compliance classification |
| `/classify/{doc_id}` | GET | Retrieve classification result |
| `/review` | GET | List documents in human review queue |
| `/review/{doc_id}` | PATCH | Submit human review decision |
| `/health` | GET | Service health + DB connectivity |

### Sanitization Layer

| Endpoint | Method | Description |
|---|---|---|
| `/sanitize` | POST | Sanitize document, returns tokenized text + redacted image |
| `/sanitize/{job_id}` | GET | Retrieve sanitization job result |
| `/reidentify` | POST | Controlled re-identification (audit logged) |
| `/health` | GET | Service health |

---

## 9. Document Flow State Machine

```
INTAKE
  │
  ├─► COMPLY SERVICE
  │     │
  │     ├─ CLEAN        ──────────────────────────────► SANITIZE → CLOUD LLM
  │     ├─ EAR_LOW      ──────────────────────────────► SANITIZE → CLOUD LLM (tokenized)
  │     ├─ EAR_HIGH     ──────────────────────────────► SANITIZE → LOCAL LLM only
  │     ├─ ITAR         ──────────► HUMAN REVIEW ──────► SANITIZE → LOCAL LLM only
  │     ├─ NEEDS_REVIEW ──────────► HUMAN REVIEW ──────► Route based on review outcome
  │     └─ REJECTED     ──────────► HOLD / Manual process — DO NOT PROCEED
  │
  └─► SANITIZE SERVICE (for CLEAN/EAR_LOW/EAR_HIGH/ITAR after review)
        │
        ├─ Strip metadata
        ├─ Detect + tokenize entities  
        ├─ Redact image regions
        ├─ Store token vault
        │
        └─► Downstream: TOKENIZATION LAYER → VECTOR STORAGE
```

---

## 10. Seed Data

```python
# scripts/seed_keyword_db.py
# Run: python scripts/seed_keyword_db.py

ITAR_KEYWORDS = [
    ("ITAR", "EXPORT CONTROLLED", 10.0, True),
    ("ITAR", "ITAR CONTROLLED", 10.0, True),
    ("ITAR", "DISTRIBUTION STATEMENT D", 10.0, True),
    ("ITAR", "DISTRIBUTION STATEMENT E", 10.0, True),
    ("ITAR", "DISTRIBUTION STATEMENT F", 10.0, True),
    ("ITAR", "NOT FOR EXPORT", 10.0, True),
    ("ITAR", "TECHNICAL DATA CONTROLLED", 10.0, True),
    ("ITAR", "USML", 8.0, True),
    ("ITAR", "MUNITIONS LIST", 8.0, True),
]

EAR_KEYWORDS = [
    ("EAR", "EAR CONTROLLED", 7.0, True),
    ("EAR", "SUBJECT TO EAR", 7.0, True),
    ("EAR", "NO LICENSE REQUIRED", 4.0, True),
    ("EAR", "EAR99", 3.0, True),
    ("EAR", "ECCN", 6.0, True),
]

DEFENSE_CAGE_CODES = [
    ("19971", "Lockheed Martin Aeronautics", True, "HIGH"),
    ("77445", "Northrop Grumman", True, "HIGH"),
    ("77272", "Raytheon Technologies", True, "HIGH"),
    ("81205", "Boeing Defense", True, "HIGH"),
    ("1WMP7", "L3Harris Technologies", True, "HIGH"),
    ("98459", "General Dynamics", True, "HIGH"),
    ("78286", "BAE Systems", True, "HIGH"),
    ("28899", "Textron Aviation Defense", True, "HIGH"),
]
```

---

## 11. CLAUDE.md for Project Root

```markdown
# ndtv1 — Pre-Ingestion Pipeline

## Architecture
Two FastAPI microservices:
1. **ndtv1-comply** (port 8010) — Compliance classifier
2. **ndtv1-sanitize** (port 8011) — Sanitization layer

## Key Design Constraints
- NEVER log or persist original sensitive values in plaintext
- Token vault stores only encrypted_value (AES-256-GCM) + value_hash
- Re-identification endpoint requires explicit role check + audit log
- ITAR/REJECTED documents MUST route to LOCAL_ONLY — never cloud API
- Metadata strip happens BEFORE OCR and entity detection

## Database
Existing PostgreSQL — run `alembic upgrade head` for schema
Connection string in DATABASE_URL env var

## Services Directory
- `services/comply/` — Compliance classifier
- `services/sanitize/` — Sanitization layer  
- `shared/` — Crypto, DB session, logging utilities

## Run Order
1. `docker compose up postgres presidio-analyzer presidio-image-redactor`
2. `alembic upgrade head`
3. `python scripts/seed_keyword_db.py && python scripts/seed_cage_codes.py`
4. `docker compose up comply sanitize`

## Testing
`bash scripts/test_pipeline.sh` — runs sample PDF through full pipeline
```

---

## 12. Build Execution Order for Claude Code

```
Phase 1 — Foundation
  1. Create directory structure exactly as specified in §1
  2. Create .env.example
  3. Create shared/db.py (async SQLAlchemy engine)
  4. Create shared/crypto.py (TokenVault + AES-256-GCM)
  5. Create shared/logging.py (structured JSON)
  6. Create shared/exceptions.py (domain exceptions)
  7. Create migrations/versions/001_initial_schema.py from §3
  8. Run alembic upgrade head

Phase 2 — Comply Service
  9. Create services/comply/models/schemas.py from §4.2
  10. Create services/comply/models/db_models.py (SQLAlchemy ORM)
  11. Create services/comply/extractors/ (pdf, image, metadata)
  12. Create services/comply/classifiers/title_block.py from §4.4
  13. Create services/comply/classifiers/keyword_scanner.py from §4.5
  14. Create services/comply/classifiers/cage_lookup.py
  15. Create services/comply/classifiers/spec_analyzer.py
  16. Create services/comply/classifiers/risk_scorer.py from §4.6
  17. Create services/comply/routes/classify.py from §4.3
  18. Create services/comply/routes/review.py
  19. Create services/comply/routes/health.py
  20. Create services/comply/main.py from §4.1

Phase 3 — Sanitize Service
  21. Create all recognizers in services/sanitize/sanitizers/recognizers/ from §5.1
  22. Create services/sanitize/sanitizers/text_sanitizer.py from §5.3
  23. Create services/sanitize/sanitizers/image_sanitizer.py from §5.4
  24. Create services/sanitize/sanitizers/metadata_sanitizer.py from §5.5
  25. Create services/sanitize/routes/sanitize.py from §5.6
  26. Create services/sanitize/routes/reidentify.py (stub + audit log)
  27. Create services/sanitize/routes/health.py
  28. Create services/sanitize/main.py

Phase 4 — Infrastructure
  29. Create Dockerfiles for both services
  30. Create docker-compose.yml from §6
  31. Create requirements.txt files from §7
  32. Create scripts/seed_keyword_db.py from §10
  33. Create scripts/seed_cage_codes.py from §10
  34. Create scripts/test_pipeline.sh
  35. Create CLAUDE.md from §11

Phase 5 — Validation
  36. docker compose up
  37. alembic upgrade head
  38. python scripts/seed_keyword_db.py
  39. bash scripts/test_pipeline.sh
  40. Fix any import errors, missing dependencies, or schema issues
```
