# ndtv1 — Complete Pipeline Build Specification
## Compliance Classifier + Sanitization Layer + LLM Gateway
**Version:** 2.0.0  
**Project:** ndtv1 (standalone — not AI-OS)  
**Prepared for:** Claude Code autonomous execution  
**Last Updated:** 2026-03-16

---

## CLAUDE CODE INSTRUCTIONS — READ FIRST

This document is the single source of truth for building the ndtv1 pipeline. You are building three FastAPI microservices that work sequentially. Read this entire document before writing a single line of code.

**Execution contract:**
- Build in the exact phase order defined in §13. Do not skip phases or reorder steps.
- Every file path in §1 must exist when the build is complete. No exceptions.
- Never store plaintext sensitive values in any log, database column, or file.
- The gateway service (ndtv1-gateway) MUST enforce LLM routing — ITAR/LOCAL_ONLY documents never reach cloud API endpoints regardless of any other logic.
- When a section says "implement fully," write production-quality code. When a section provides code, use it verbatim unless there is an import error or version conflict — if you must deviate, add a comment explaining why.
- After each phase, run the validation step for that phase before proceeding.
- If a dependency install fails, check the allowed domains list and find an equivalent pinned version. Do not silently skip dependencies.
- All async functions use `async/await`. All database operations use SQLAlchemy async sessions. No synchronous DB calls.

---

## 0. System Overview

### What This Builds

Three FastAPI microservices forming a complete document-to-LLM pipeline for an NDT (Non-Destructive Testing) aerospace facility. The pipeline ensures that sensitive entity data, ITAR-controlled content, and proprietary identifiers are classified, stripped, tokenized, and routed correctly before any content reaches an LLM — and that LLM responses are post-processed before returning to the caller.

### Why Three Services

Each service has a distinct security boundary and can fail independently:

- **ndtv1-comply** — Answers: "Is this document controlled? How controlled? Can it touch a cloud LLM?"
- **ndtv1-sanitize** — Answers: "What sensitive entities exist? Replace them with typed tokens. Store the vault. Strip all metadata."
- **ndtv1-gateway** — Answers: "Route this sanitized payload to the correct LLM. Catch anything sanitize missed. Post-process the response. Selectively re-identify for the caller."

### Complete Pipeline Flow

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DOCUMENT INTAKE                                  │
│           (PDF, TIFF, PNG, JPEG — engineering drawings + reports)         │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                    SERVICE 1: ndtv1-comply (port 8010)                    │
│                                                                           │
│  1. Extract PDF/image to page images + text blocks (PyMuPDF + PaddleOCR) │
│  2. Strip + report all embedded metadata (XMP, EXIF, PDF properties)     │
│  3. Extract title block fields (drawing number, CAGE, dist. statement)   │
│  4. Scan full text against ITAR/EAR keyword library                      │
│  5. Check CAGE code against known defense contractor registry            │
│  6. Detect MIL-SPEC references, USML categories, program names           │
│  7. Compute weighted risk score → classification + LLM routing decision  │
│                                                                           │
│  OUTPUT: classification (CLEAN/EAR_LOW/EAR_HIGH/ITAR/NEEDS_REVIEW/      │
│          REJECTED) + llm_routing (CLOUD_OK/LOCAL_ONLY/HOLD)              │
└────────────────────────────┬─────────────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │ REJECTED or HOLD?           │ CLEAN/EAR_LOW/EAR_HIGH/ITAR
              ▼                             ▼
       [Human Review Queue]    ┌────────────────────────────────────────────┐
       [Manual Processing]     │   SERVICE 2: ndtv1-sanitize (port 8011)   │
                               │                                            │
                               │  1. Strip metadata (again — belt+suspenders│
                               │  2. Run Presidio entity detection on text  │
                               │     (standard PII + NDT custom recognizers)│
                               │  3. Generate deterministic typed tokens    │
                               │     per entity per job namespace           │
                               │  4. Replace entities in text with tokens   │
                               │  5. OCR image → detect entity regions →    │
                               │     black-box redact bounding boxes        │
                               │  6. Store encrypted token vault in PG      │
                               │  7. Return sanitized text + redacted image │
                               │     + token manifest reference             │
                               │                                            │
                               │  OUTPUT: sanitized_text, redacted_image,  │
                               │  job_id (for vault lookup), token_count   │
                               └────────────────────┬───────────────────────┘
                                                    │
                                                    ▼
                               ┌────────────────────────────────────────────┐
                               │   SERVICE 3: ndtv1-gateway (port 8012)    │
                               │                                            │
                               │  1. Receive sanitized payload + job_id    │
                               │     + comply classification                │
                               │  2. ROUTE ENFORCEMENT:                    │
                               │     - CLOUD_OK → Anthropic/OpenAI API     │
                               │     - LOCAL_ONLY → Ollama (local RTX3090) │
                               │     - HOLD → Reject with 403              │
                               │  3. Second-pass sanitization scan on      │
                               │     assembled prompt (catch residuals)    │
                               │  4. Build final prompt payload with       │
                               │     system context + sanitized content    │
                               │  5. Call LLM endpoint with retry/backoff  │
                               │  6. Validate response (no token leakage)  │
                               │  7. Post-process: selective re-identify   │
                               │     based on caller's authorization role  │
                               │  8. Audit log: request + response hash    │
                               │                                            │
                               │  OUTPUT: analysis result (re-identified   │
                               │  or still tokenized per caller role)      │
                               └────────────────────┬───────────────────────┘
                                                    │
                                                    ▼
                               ┌────────────────────────────────────────────┐
                               │         VECTOR STORAGE / pgvector         │
                               │   (Downstream — separate build scope)     │
                               │   Receives: sanitized embeddings only     │
                               │   Raw company names never enter the store │
                               └────────────────────────────────────────────┘
```

---

## 1. Complete Repository Structure

```
ndtv1/
├── CLAUDE.md                                   # Root project context (§12)
├── docker-compose.yml                          # All services + dependencies
├── .env.example                                # All environment variables
├── alembic.ini                                 # Alembic migration config
│
├── services/
│   │
│   ├── comply/                                 # SERVICE 1: Compliance Classifier
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py
│   │   │   └── db_models.py
│   │   ├── classifiers/
│   │   │   ├── __init__.py
│   │   │   ├── title_block.py
│   │   │   ├── keyword_scanner.py
│   │   │   ├── cage_lookup.py
│   │   │   ├── spec_analyzer.py
│   │   │   └── risk_scorer.py
│   │   ├── extractors/
│   │   │   ├── __init__.py
│   │   │   ├── pdf_extractor.py
│   │   │   ├── image_extractor.py
│   │   │   └── metadata_extractor.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── classify.py
│   │   │   ├── review.py
│   │   │   └── health.py
│   │   └── tests/
│   │       ├── test_classifier.py
│   │       └── fixtures/
│   │           ├── sample_clean.pdf
│   │           ├── sample_itar.pdf
│   │           └── sample_ear.pdf
│   │
│   ├── sanitize/                               # SERVICE 2: Sanitization Layer
│   │   ├── Dockerfile
│   │   ├── requirements.txt
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   ├── schemas.py
│   │   │   └── db_models.py
│   │   ├── sanitizers/
│   │   │   ├── __init__.py
│   │   │   ├── text_sanitizer.py
│   │   │   ├── image_sanitizer.py
│   │   │   ├── metadata_sanitizer.py
│   │   │   └── recognizers/
│   │   │       ├── __init__.py
│   │   │       ├── drawing_number.py
│   │   │       ├── part_number.py
│   │   │       ├── project_code.py
│   │   │       ├── cert_id.py
│   │   │       ├── cage_code.py
│   │   │       └── contract_number.py
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── sanitize.py
│   │   │   ├── reidentify.py
│   │   │   └── health.py
│   │   └── tests/
│   │       ├── test_sanitizer.py
│   │       └── fixtures/
│   │
│   └── gateway/                                # SERVICE 3: LLM Gateway
│       ├── Dockerfile
│       ├── requirements.txt
│       ├── main.py
│       ├── config.py
│       ├── models/
│       │   ├── __init__.py
│       │   ├── schemas.py
│       │   └── db_models.py
│       ├── gateway/
│       │   ├── __init__.py
│       │   ├── router.py                       # LLM routing enforcement
│       │   ├── prompt_builder.py               # Assembles final prompt payload
│       │   ├── second_pass_scanner.py          # Residual entity detection
│       │   ├── response_validator.py           # Validates LLM response
│       │   ├── reidentifier.py                 # Selective re-identification
│       │   └── providers/
│       │       ├── __init__.py
│       │       ├── base.py                     # Abstract LLM provider
│       │       ├── anthropic_provider.py       # Anthropic Claude (cloud)
│       │       ├── openai_provider.py          # OpenAI (cloud)
│       │       └── ollama_provider.py          # Ollama (local — RTX 3090)
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── analyze.py                      # POST /analyze (main endpoint)
│       │   ├── audit.py                        # GET /audit (audit log query)
│       │   └── health.py
│       └── tests/
│           ├── test_gateway.py
│           └── fixtures/
│
├── shared/                                     # Shared across all services
│   ├── __init__.py
│   ├── db.py                                   # Async SQLAlchemy engine
│   ├── crypto.py                               # TokenVault + AES-256-GCM
│   ├── logging.py                              # Structured JSON logging
│   └── exceptions.py                          # Domain exceptions
│
├── migrations/
│   ├── env.py
│   └── versions/
│       └── 001_initial_schema.py              # All tables for all three services
│
└── scripts/
    ├── seed_keyword_db.py
    ├── seed_cage_codes.py
    ├── generate_secret_key.py                  # Helper: openssl rand -hex 32
    └── test_pipeline.sh                        # End-to-end smoke test
```

---

## 2. Environment Variables

```bash
# .env.example
# Copy to .env and populate all values before running

# ─── DATABASE ──────────────────────────────────────────────────
DATABASE_URL=postgresql+asyncpg://ndtv1:password@postgres:5432/ndtv1
DB_PASSWORD=changeme

# ─── SERVICE PORTS ─────────────────────────────────────────────
COMPLY_PORT=8010
SANITIZE_PORT=8011
GATEWAY_PORT=8012

# ─── CRYPTO ────────────────────────────────────────────────────
# Generate with: python scripts/generate_secret_key.py
# Must be 32-byte hex (64 hex chars)
TOKEN_SECRET_KEY=<generate>
TOKEN_NAMESPACE=ndtv1-prod

# ─── OCR ───────────────────────────────────────────────────────
PADDLEOCR_LANG=en
TESSERACT_PATH=/usr/bin/tesseract

# ─── PRESIDIO ──────────────────────────────────────────────────
PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000
PRESIDIO_IMAGE_REDACTOR_URL=http://presidio-image-redactor:3001

# ─── LLM PROVIDERS ─────────────────────────────────────────────
# Cloud providers (CLOUD_OK routing only)
ANTHROPIC_API_KEY=<your key>
ANTHROPIC_MODEL=claude-sonnet-4-20250514
OPENAI_API_KEY=<your key>
OPENAI_MODEL=gpt-4o

# Local inference (LOCAL_ONLY routing — Ollama on RTX 3090 homelab)
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.3:70b

# Default provider for CLOUD_OK: 'anthropic' or 'openai'
DEFAULT_CLOUD_PROVIDER=anthropic

# ─── GATEWAY BEHAVIOR ──────────────────────────────────────────
# Hard routing enforcement — these are not overridable by API callers
CLOUD_OK_CLASSIFICATIONS=CLEAN,EAR_LOW
LOCAL_ONLY_CLASSIFICATIONS=EAR_HIGH,ITAR
BLOCKED_CLASSIFICATIONS=NEEDS_REVIEW,REJECTED,HOLD

# Second-pass residual detection threshold (0.0-1.0)
# Entities detected above this score in assembled prompt trigger abort
RESIDUAL_DETECTION_THRESHOLD=0.6

# Maximum prompt token budget (enforced before sending to LLM)
MAX_PROMPT_TOKENS=8000

# ─── REVIEW QUEUE ──────────────────────────────────────────────
REQUIRE_HUMAN_REVIEW_FOR=ITAR,NEEDS_REVIEW
AUTO_PASS_CLASSIFICATIONS=CLEAN,EAR_LOW

# ─── LOGGING ───────────────────────────────────────────────────
LOG_LEVEL=INFO
LOG_FORMAT=json

# ─── REIDENTIFICATION ACCESS CONTROL ───────────────────────────
# Comma-separated roles allowed to call /reidentify
REIDENTIFY_ALLOWED_ROLES=admin,compliance_officer,lead_engineer
```

---

## 3. Database Schema

Create this as `migrations/versions/001_initial_schema.py`. Run via `alembic upgrade head`.

```sql
-- ══════════════════════════════════════════════════
-- SHARED TYPES
-- ══════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

CREATE TYPE classification_status AS ENUM (
    'CLEAN',
    'EAR_LOW',
    'EAR_HIGH',
    'ITAR',
    'NEEDS_REVIEW',
    'REJECTED'
);

CREATE TYPE llm_routing AS ENUM (
    'CLOUD_OK',
    'LOCAL_ONLY',
    'HOLD'
);

CREATE TYPE entity_type AS ENUM (
    'COMPANY', 'PERSON', 'DRAWING', 'PARTNUM', 'PROJECT',
    'CERTID', 'CAGECODE', 'CONTRACT', 'SERIAL', 'LOCATION',
    'EMAIL', 'PHONE', 'ADDRESS', 'CUSTOM'
);

-- ══════════════════════════════════════════════════
-- SERVICE 1: COMPLY TABLES
-- ══════════════════════════════════════════════════

CREATE TABLE comply_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    intake_id               VARCHAR(255) NOT NULL UNIQUE,
    filename                VARCHAR(500) NOT NULL,
    file_hash               VARCHAR(64) NOT NULL,
    file_size_bytes         BIGINT NOT NULL,
    mime_type               VARCHAR(100) NOT NULL,

    -- Classification
    classification          classification_status NOT NULL DEFAULT 'NEEDS_REVIEW',
    llm_routing             llm_routing NOT NULL DEFAULT 'HOLD',
    risk_score              DECIMAL(5,2),
    confidence              DECIMAL(5,2),

    -- Title block extracted fields
    drawing_number          VARCHAR(255),
    part_number             VARCHAR(255),
    cage_code               VARCHAR(10),
    revision                VARCHAR(20),
    program_name            VARCHAR(500),
    distribution_stmt       VARCHAR(10),

    -- Detected signals (JSONB arrays of DetectedSignal objects)
    itar_signals            JSONB DEFAULT '[]',
    ear_signals             JSONB DEFAULT '[]',
    milspec_refs            JSONB DEFAULT '[]',
    usml_categories         JSONB DEFAULT '[]',

    -- Boolean flag summary
    has_explicit_marking    BOOLEAN DEFAULT FALSE,
    has_distribution_stmt   BOOLEAN DEFAULT FALSE,
    has_military_program    BOOLEAN DEFAULT FALSE,
    has_defense_cage        BOOLEAN DEFAULT FALSE,
    has_milspec_refs        BOOLEAN DEFAULT FALSE,
    has_usml_category       BOOLEAN DEFAULT FALSE,

    -- Human review
    reviewed_by             VARCHAR(255),
    reviewed_at             TIMESTAMPTZ,
    review_notes            TEXT,
    review_override         classification_status,

    -- Audit
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processing_ms           INTEGER
);

CREATE TABLE comply_keyword_library (
    id              SERIAL PRIMARY KEY,
    category        VARCHAR(50) NOT NULL,
    keyword         VARCHAR(500) NOT NULL,
    weight          DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    exact_match     BOOLEAN DEFAULT FALSE,
    description     TEXT,
    active          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE comply_cage_code_registry (
    cage_code       VARCHAR(10) PRIMARY KEY,
    company_name    VARCHAR(500),
    is_defense      BOOLEAN DEFAULT FALSE,
    risk_level      VARCHAR(20),
    notes           TEXT,
    last_updated    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_comply_docs_status      ON comply_documents(classification);
CREATE INDEX idx_comply_docs_routing     ON comply_documents(llm_routing);
CREATE INDEX idx_comply_docs_intake      ON comply_documents(intake_id);
CREATE INDEX idx_comply_docs_cage        ON comply_documents(cage_code);
CREATE INDEX idx_comply_docs_hash        ON comply_documents(file_hash);


-- ══════════════════════════════════════════════════
-- SERVICE 2: SANITIZE TABLES
-- ══════════════════════════════════════════════════

CREATE TABLE sanitize_jobs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comply_doc_id           UUID REFERENCES comply_documents(id),
    intake_id               VARCHAR(255) NOT NULL,
    job_namespace           VARCHAR(64) NOT NULL,

    original_hash           VARCHAR(64) NOT NULL,
    sanitized_hash          VARCHAR(64),

    entities_detected       INTEGER DEFAULT 0,
    entities_replaced       INTEGER DEFAULT 0,

    -- Sanitized text safe for LLM consumption
    -- Original text is NEVER stored
    sanitized_text          TEXT,

    -- Image results
    sanitized_image_path    TEXT,
    redaction_regions       JSONB DEFAULT '[]',

    -- Metadata removal report (field names only, not values)
    metadata_removed        JSONB DEFAULT '[]',

    status                  VARCHAR(50) DEFAULT 'PENDING',
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    processing_ms           INTEGER
);

CREATE TABLE sanitize_token_vault (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID REFERENCES sanitize_jobs(id) ON DELETE CASCADE,
    job_namespace           VARCHAR(64) NOT NULL,

    -- Token: e.g. COMPANY__A94F7K2M
    token                   VARCHAR(50) NOT NULL,
    entity_type             entity_type NOT NULL,

    -- AES-256-GCM encrypted original value
    -- Format: nonce (12 bytes) || ciphertext
    -- NEVER stored as plaintext
    encrypted_value         BYTEA NOT NULL,

    -- SHA-256 of plaintext — for dedup lookups without decrypting
    value_hash              VARCHAR(64) NOT NULL,

    -- Re-identification access control
    reidentify_roles        TEXT[] DEFAULT ARRAY['admin', 'compliance_officer'],

    created_at              TIMESTAMPTZ DEFAULT NOW(),
    accessed_at             TIMESTAMPTZ,
    access_count            INTEGER DEFAULT 0,

    UNIQUE(job_namespace, token)
);

CREATE TABLE sanitize_reidentify_audit (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id                  UUID REFERENCES sanitize_jobs(id),
    token                   VARCHAR(50) NOT NULL,
    requested_by            VARCHAR(255) NOT NULL,
    request_reason          TEXT,
    granted                 BOOLEAN NOT NULL,
    deny_reason             TEXT,
    ip_address              VARCHAR(45),
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_vault_namespace   ON sanitize_token_vault(job_namespace);
CREATE INDEX idx_token_vault_token       ON sanitize_token_vault(token);
CREATE INDEX idx_token_vault_hash        ON sanitize_token_vault(value_hash);
CREATE INDEX idx_sanitize_jobs_comply    ON sanitize_jobs(comply_doc_id);
CREATE INDEX idx_sanitize_jobs_intake    ON sanitize_jobs(intake_id);


-- ══════════════════════════════════════════════════
-- SERVICE 3: GATEWAY TABLES
-- ══════════════════════════════════════════════════

CREATE TABLE gateway_requests (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sanitize_job_id         UUID REFERENCES sanitize_jobs(id),
    intake_id               VARCHAR(255) NOT NULL,

    -- Classification context (copied from comply for gateway enforcement)
    classification          classification_status NOT NULL,
    llm_routing             llm_routing NOT NULL,

    -- Provider used
    provider                VARCHAR(50) NOT NULL,    -- 'anthropic', 'openai', 'ollama'
    model                   VARCHAR(100) NOT NULL,
    endpoint_url            TEXT NOT NULL,

    -- Second-pass scan result
    residual_entities_found INTEGER DEFAULT 0,
    second_pass_clean       BOOLEAN DEFAULT FALSE,
    second_pass_aborted     BOOLEAN DEFAULT FALSE,

    -- Prompt stats (token counts, never content)
    prompt_token_estimate   INTEGER,
    response_token_estimate INTEGER,

    -- Response hashes (never store actual LLM response content here)
    prompt_hash             VARCHAR(64),    -- SHA-256 of final prompt sent
    response_hash           VARCHAR(64),    -- SHA-256 of raw LLM response

    -- Outcome
    status                  VARCHAR(50) DEFAULT 'PENDING',
    -- 'PENDING', 'SECOND_PASS_ABORTED', 'LLM_ERROR', 'COMPLETED', 'ROUTING_BLOCKED'
    error_message           TEXT,

    -- Caller context
    caller_id               VARCHAR(255),
    caller_role             VARCHAR(100),
    caller_ip               VARCHAR(45),

    -- Timing
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    processing_ms           INTEGER,
    llm_latency_ms          INTEGER
);

CREATE TABLE gateway_reidentify_log (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gateway_request_id      UUID REFERENCES gateway_requests(id),
    tokens_requested        TEXT[] NOT NULL,
    tokens_granted          TEXT[],
    tokens_denied           TEXT[],
    caller_id               VARCHAR(255) NOT NULL,
    caller_role             VARCHAR(100) NOT NULL,
    created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gateway_requests_intake   ON gateway_requests(intake_id);
CREATE INDEX idx_gateway_requests_routing  ON gateway_requests(llm_routing);
CREATE INDEX idx_gateway_requests_status   ON gateway_requests(status);
CREATE INDEX idx_gateway_requests_created  ON gateway_requests(created_at);
```

---

## 4. Shared Utilities

### 4.1 `shared/db.py`

```python
"""
Async SQLAlchemy engine shared across all three services.
Each service imports get_session from here.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
import os

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_async_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    echo=False
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def init_db():
    """Call at service startup to verify DB connectivity."""
    async with engine.begin() as conn:
        await conn.run_sync(lambda c: c.execute("SELECT 1"))

async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### 4.2 `shared/crypto.py`

```python
"""
Token generation and vault encryption.

Design:
- Tokens are DETERMINISTIC: same value + namespace = same token always.
  This allows cross-document entity tracking without re-decrypting the vault.
- Tokens are TYPED: COMPANY__A94F7K2M not [TOKEN_17]
  The LLM needs semantic role context even without knowing real values.
- Vault values are AES-256-GCM encrypted with a per-deployment secret key.
- value_hash (SHA-256 of plaintext) enables dedup lookups without decryption.
"""
import hmac
import hashlib
import base64
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


class TokenVault:
    def __init__(self, secret_key: bytes, namespace: str):
        if len(secret_key) != 32:
            raise ValueError("TOKEN_SECRET_KEY must be exactly 32 bytes (64 hex chars)")
        self.secret_key = secret_key
        self.namespace = namespace

    def generate_token(self, entity_type: str, value: str) -> str:
        """
        Deterministic HMAC-SHA256 token generation.
        Token format: ENTITYTYPE__XXXXXXXX (8 chars base64url uppercase)
        
        Same entity_type + value + namespace ALWAYS produces the same token.
        Different namespaces (different clients/jobs) produce different tokens
        for the same underlying value — cross-client correlation impossible.
        """
        scoped_input = f"{self.namespace}:{entity_type.upper()}:{value}"
        h = hmac.new(
            self.secret_key,
            scoped_input.encode("utf-8"),
            hashlib.sha256
        ).digest()
        # Take first 8 chars of base64url, uppercase for LLM prompt safety
        token_suffix = base64.urlsafe_b64encode(h)[:8].decode("utf-8").upper()
        return f"{entity_type.upper()}__{token_suffix}"

    def get_value_hash(self, value: str) -> str:
        """SHA-256 of plaintext for dedup lookups without decryption."""
        return hashlib.sha256(
            f"{self.namespace}:{value}".encode("utf-8")
        ).hexdigest()


def encrypt_value(plaintext: str, key: bytes) -> bytes:
    """
    AES-256-GCM encryption.
    Returns: nonce (12 bytes) || ciphertext
    Nonce is random per encryption — same plaintext produces different ciphertext.
    """
    nonce = os.urandom(12)
    aesgcm = AESGCM(key)
    ciphertext = aesgcm.encrypt(nonce, plaintext.encode("utf-8"), None)
    return nonce + ciphertext


def decrypt_value(encrypted: bytes, key: bytes) -> str:
    """AES-256-GCM decryption. Expects nonce prepended to ciphertext."""
    nonce = encrypted[:12]
    ciphertext = encrypted[12:]
    aesgcm = AESGCM(key)
    return aesgcm.decrypt(nonce, ciphertext, None).decode("utf-8")


def load_secret_key() -> bytes:
    """Load and validate TOKEN_SECRET_KEY from environment."""
    raw = os.environ.get("TOKEN_SECRET_KEY", "")
    if len(raw) != 64:
        raise RuntimeError(
            "TOKEN_SECRET_KEY must be 64 hex characters (32 bytes). "
            "Generate with: python scripts/generate_secret_key.py"
        )
    return bytes.fromhex(raw)
```

### 4.3 `shared/exceptions.py`

```python
class NDTBaseException(Exception):
    pass

class ClassificationError(NDTBaseException):
    pass

class SanitizationError(NDTBaseException):
    pass

class RoutingBlockedError(NDTBaseException):
    """Raised when gateway blocks a request due to routing rules."""
    def __init__(self, classification: str, routing: str):
        self.classification = classification
        self.routing = routing
        super().__init__(
            f"Request blocked: classification={classification}, routing={routing}"
        )

class ResidualEntityError(NDTBaseException):
    """Raised when second-pass scanner detects unsanitized entities."""
    def __init__(self, entity_count: int):
        self.entity_count = entity_count
        super().__init__(
            f"Second-pass scan detected {entity_count} residual entities. "
            f"Prompt aborted."
        )

class VaultAccessDenied(NDTBaseException):
    """Raised when caller lacks re-identification permission."""
    pass

class LLMProviderError(NDTBaseException):
    pass
```

### 4.4 `shared/logging.py`

```python
import logging
import json
import sys
import os
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "service": os.environ.get("SERVICE_NAME", "ndtv1"),
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
        }
        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)
        if hasattr(record, "extra"):
            log_entry.update(record.extra)
        return json.dumps(log_entry)


def setup_logging():
    level = getattr(logging, os.environ.get("LOG_LEVEL", "INFO").upper())
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(JSONFormatter())
    
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers.clear()
    root.addHandler(handler)
    
    # Suppress noisy libraries
    for noisy in ["paddleocr", "ppocr", "paddle", "uvicorn.access"]:
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
```

---

## 5. Service 1: ndtv1-comply

### 5.1 `services/comply/main.py`

```python
import os
os.environ["SERVICE_NAME"] = "ndtv1-comply"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from shared.db import init_db
from shared.logging import setup_logging
from .routes import classify, review, health

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield

app = FastAPI(
    title="ndtv1 Compliance Classifier",
    description="ITAR/EAR compliance triage for engineering documents",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"])

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(classify.router, prefix="/classify", tags=["classify"])
app.include_router(review.router, prefix="/review", tags=["review"])
```

### 5.2 `services/comply/models/schemas.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
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
    mime_type: str = Field(
        ...,
        pattern="^(application/pdf|image/(tiff|tif|png|jpeg|jpg))$"
    )
    customer_context: Optional[str] = Field(
        None, description="Known customer name if available — used to seed CAGE lookup"
    )
    job_namespace: Optional[str] = Field(
        None, description="Job/client namespace for cross-service token scoping"
    )


class DetectedSignal(BaseModel):
    signal_type: str
    value: str
    location: str   # 'TITLE_BLOCK', 'NOTES', 'DOCUMENT', 'METADATA'
    weight: float
    confidence: float


class TitleBlockFields(BaseModel):
    drawing_number: Optional[str] = None
    part_number: Optional[str] = None
    cage_code: Optional[str] = None
    revision: Optional[str] = None
    program_name: Optional[str] = None
    distribution_statement: Optional[str] = None
    title: Optional[str] = None
    export_marking: Optional[str] = None


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
    flags: Dict[str, bool]
    processing_ms: int
    requires_human_review: bool
    review_reason: Optional[str] = None


class ReviewUpdateRequest(BaseModel):
    reviewer_id: str = Field(..., min_length=3)
    override_classification: Optional[ClassificationStatus] = None
    notes: str = Field(..., min_length=10)
    approved: bool
```

### 5.3 `services/comply/classifiers/title_block.py`

```python
"""
Title block extraction for engineering drawings.

Engineering drawings universally place the title block in the lower-right
quadrant (approximately the bottom 20-30% of the sheet). We focus OCR effort
on that region for speed, then fall back to full-page OCR if key fields are
missing.

Fields targeted:
- Drawing number, part number, cage code, revision
- Distribution statement (critical for ITAR)
- Export control marking (explicit ITAR/EAR stamp)
- Program/project name
"""
import re
import logging
from typing import Optional
import numpy as np

logger = logging.getLogger(__name__)

# Title block field regex patterns
# Order matters within each list — most specific first
FIELD_PATTERNS = {
    "drawing_number": [
        r"(?:DWG|DRAWING|DRG|DOC(?:UMENT)?)[.\s#\-]*(?:NO|NUM|NUMBER|NBR)?[.\s:#\-]*([A-Z0-9][A-Z0-9\-\.]{2,29})",
        r"\b([A-Z]{1,4}[\-_]\d{4,8}[\-_][A-Z0-9]{1,6})\b",
    ],
    "part_number": [
        r"(?:P/?N|PART[.\s]?NO(?:\.)?|PART[.\s]?NUMBER)[.\s:#]*([A-Z0-9][A-Z0-9\-\/\.]{2,24})",
        r"\b(NSN\s*\d{4}[\-\s]\d{2}[\-\s]\d{3}[\-\s]\d{4})\b",  # NATO Stock Number
    ],
    "cage_code": [
        r"(?:CAGE(?:[.\s]CODE)?|VENDOR|SUPPLIER|MFR(?:\.)?|MFG(?:\.)?)[\s:#]*([A-Z0-9]{5})\b",
    ],
    "revision": [
        r"(?:REV(?:ISION)?|RV)[.\s:#]*([A-Z0-9]{1,5})\b",
    ],
    "distribution_statement": [
        r"DISTRIBUTION\s+STATEMENT\s*[:\-]?\s*([A-F])\b",
        r"DIST(?:RIBUTION)?\.?\s+STMT\.?\s*[:\-]?\s*([A-F])\b",
        r"DIST\s*[:\-]\s*([A-F])\b",
    ],
    "export_marking": [
        r"(EXPORT[\s\-]CONTROLLED)",
        r"(ITAR[\s\-]CONTROLLED)",
        r"(EAR[\s\-]CONTROLLED)",
        r"(SUBJECT\s+TO\s+(?:ITAR|EAR))",
        r"(NOT\s+FOR\s+EXPORT)",
        r"(TECHNICAL\s+DATA\s+CONTROLLED)",
        r"ECCN[.\s:#]*([A-Z0-9]{5,8})",
        r"(NO\s+LICENSE\s+REQUIRED)",
    ],
    "program_name": [
        r"(?:PROGRAM|PROJECT|ACFT|AIRCRAFT|SYSTEM|CONTRACT)\s*[:#\-]?\s*([A-Z][A-Z0-9\s\-]{2,49}?)(?:\n|$)",
    ],
}


async def extract_title_block(images: list, text_blocks: list) -> dict:
    """
    images: list of numpy arrays (one per page)
    text_blocks: list of OCR result dicts with 'text' and 'bbox' keys
    Returns dict matching TitleBlockFields schema
    """
    try:
        from paddleocr import PaddleOCR
        ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
    except ImportError:
        logger.warning("PaddleOCR not available, falling back to text_blocks only")
        ocr = None

    results = {}

    for image in images:
        if image is None:
            continue

        h, w = image.shape[:2]

        # Primary: focus on bottom 30% (title block region)
        title_region = image[int(h * 0.70):h, :]
        regions_to_try = [title_region, image]  # Fallback to full image

        for region in regions_to_try:
            if ocr:
                ocr_result = ocr.ocr(region, cls=True)
                if ocr_result and ocr_result[0]:
                    text = " ".join(
                        line[1][0] for line in ocr_result[0] if line[1][1] > 0.5
                    )
                else:
                    text = ""
            else:
                text = " ".join(b.get("text", "") for b in text_blocks)

            if not text.strip():
                continue

            text_upper = text.upper()

            for field, patterns in FIELD_PATTERNS.items():
                if field in results:
                    continue
                for pattern in patterns:
                    match = re.search(pattern, text_upper, re.IGNORECASE | re.MULTILINE)
                    if match:
                        results[field] = match.group(1).strip()
                        break

            # If we got key fields from title region, no need for full page
            key_fields = {"drawing_number", "cage_code", "distribution_statement"}
            if key_fields.issubset(results.keys()):
                break

    return results
```

### 5.4 `services/comply/classifiers/keyword_scanner.py`

```python
"""
Document keyword scanner for ITAR/EAR signals.

Priority levels:
  10.0 = CRITICAL — instant REJECTED/ITAR classification
   8.0 = HIGH — strong ITAR indicator
   6.0 = MEDIUM-HIGH — probable defense use
   3.0 = MEDIUM — MIL-SPEC reference (context-dependent)
   1.0 = LOW — soft indicator, contributes to score
"""
import re
import logging
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

logger = logging.getLogger(__name__)

CRITICAL_ITAR_KEYWORDS = [
    "ITAR CONTROLLED", "EXPORT CONTROLLED", "SUBJECT TO ITAR",
    "TECHNICAL DATA CONTROLLED", "NOT FOR EXPORT",
    "DISTRIBUTION STATEMENT D", "DISTRIBUTION STATEMENT E",
    "DISTRIBUTION STATEMENT F", "ITAR RESTRICTED",
]

USML_CATEGORIES = {
    "CAT IV": "Launch vehicles, guided missiles, rockets",
    "CAT VIII": "Aircraft, engines, associated equipment",
    "CAT X": "Personal protective armor",
    "CAT XI": "Military electronics",
    "CAT XII": "Fire control, range finder, optical",
    "CAT XIII": "Materials and miscellaneous articles",
    "CAT XV": "Spacecraft systems and related articles",
    "CAT XVI": "Nuclear weapons design equipment",
    "CATEGORY IV": "Launch vehicles, guided missiles, rockets",
    "CATEGORY VIII": "Aircraft, engines, associated equipment",
    "CATEGORY XI": "Military electronics",
    "CATEGORY XV": "Spacecraft systems",
}

# Military platform names — presence strongly suggests ITAR Cat VIII or IV
MILITARY_PROGRAMS = [
    "F-35", "F35", "JSF", "JOINT STRIKE FIGHTER",
    "F-22", "F22", "RAPTOR",
    "F-16", "F16", "FALCON",
    "F/A-18", "F-18", "F18", "HORNET", "SUPER HORNET",
    "B-2", "B2", "SPIRIT",
    "B-21", "B21", "RAIDER",
    "AH-64", "AH64", "APACHE",
    "UH-60", "UH60", "BLACK HAWK",
    "CH-47", "CH47", "CHINOOK",
    "V-22", "V22", "OSPREY",
    "A-10", "A10", "WARTHOG",
    "PATRIOT PAC", "HIMARS", "JAVELIN", "STINGER MISSILE",
    "TRIDENT II", "MINUTEMAN III",
    "ATLAS V", "EVOLVED EXPENDABLE LAUNCH",
    "CVNX", "DDG-1000", "LCS",
    "MQ-9", "MQ9", "REAPER",
    "RQ-4", "RQ4", "GLOBAL HAWK",
]

MILSPEC_PATTERNS = [
    r"\bMIL-DTL-\d{3,8}\b",
    r"\bMIL-PRF-\d{3,8}\b",
    r"\bMIL-STD-\d{3,8}\b",
    r"\bMIL-HDBK-\d{3,8}\b",
    r"\bMIL-[A-Z]+-\d{3,8}\b",
    r"\bDEF-STAN-\d{2}-\d{2,4}\b",
    r"\bNASM\d{4,8}\b",
    r"\bMS\d{4,8}\b",          # Military Standard parts
    r"\bNAS\d{3,8}\b",         # National Aerospace Standard
    r"\bAN-[A-Z0-9\-]{3,12}\b",  # Army-Navy standards
]


async def scan_keywords(text: str, title_block: dict, session: AsyncSession) -> list:
    signals = []
    text_upper = text.upper()

    # 1. Critical ITAR keywords — weight 10.0 → immediate REJECTED
    for keyword in CRITICAL_ITAR_KEYWORDS:
        if keyword in text_upper:
            signals.append({
                "signal_type": "ITAR_CRITICAL_KEYWORD",
                "value": keyword,
                "location": "DOCUMENT",
                "weight": 10.0,
                "confidence": 1.0,
            })

    # 2. Distribution statement from title block
    dist = title_block.get("distribution_statement", "")
    if dist:
        if dist.upper() in ["D", "E", "F"]:
            signals.append({
                "signal_type": "ITAR_DISTRIBUTION_STATEMENT",
                "value": f"Distribution Statement {dist.upper()}",
                "location": "TITLE_BLOCK",
                "weight": 10.0,
                "confidence": 1.0,
            })
        elif dist.upper() in ["B", "C"]:
            signals.append({
                "signal_type": "EAR_DISTRIBUTION_STATEMENT",
                "value": f"Distribution Statement {dist.upper()}",
                "location": "TITLE_BLOCK",
                "weight": 7.0,
                "confidence": 0.95,
            })

    # 3. Explicit export marking from title block
    export_marking = title_block.get("export_marking", "")
    if export_marking:
        signals.append({
            "signal_type": "ITAR_EXPLICIT_MARKING",
            "value": export_marking,
            "location": "TITLE_BLOCK",
            "weight": 10.0,
            "confidence": 1.0,
        })

    # 4. USML category references
    for category, description in USML_CATEGORIES.items():
        if category in text_upper:
            signals.append({
                "signal_type": "ITAR_USML_CATEGORY",
                "value": f"{category} — {description}",
                "location": "DOCUMENT",
                "weight": 9.0,
                "confidence": 0.95,
            })

    # 5. Military platform names
    for program in MILITARY_PROGRAMS:
        if program.upper() in text_upper:
            signals.append({
                "signal_type": "ITAR_MILITARY_PROGRAM",
                "value": program,
                "location": "DOCUMENT",
                "weight": 6.0,
                "confidence": 0.80,
            })

    # 6. MIL-SPEC references
    for pattern in MILSPEC_PATTERNS:
        matches = re.findall(pattern, text_upper)
        for match in set(matches):  # deduplicate
            signals.append({
                "signal_type": "MILSPEC_REFERENCE",
                "value": match,
                "location": "NOTES",
                "weight": 3.0,
                "confidence": 0.85,
            })

    # 7. DB keyword library
    try:
        from ..models.db_models import KeywordLibrary
        result = await session.execute(
            select(KeywordLibrary).where(KeywordLibrary.active == True)
        )
        for kw in result.scalars():
            if kw.exact_match:
                if kw.keyword.upper() in text_upper:
                    signals.append({
                        "signal_type": f"{kw.category}_DB_KEYWORD",
                        "value": kw.keyword,
                        "location": "DOCUMENT",
                        "weight": float(kw.weight),
                        "confidence": 0.85,
                    })
            else:
                matches = re.findall(kw.keyword, text_upper, re.IGNORECASE)
                for match in set(matches):
                    signals.append({
                        "signal_type": f"{kw.category}_DB_PATTERN",
                        "value": match,
                        "location": "DOCUMENT",
                        "weight": float(kw.weight),
                        "confidence": 0.75,
                    })
    except Exception as e:
        logger.warning(f"DB keyword scan error (non-fatal): {e}")

    return signals
```

### 5.5 `services/comply/classifiers/risk_scorer.py`

```python
"""
Composite risk scoring engine.

Score thresholds are conservative by design for aerospace NDT.
When in doubt, classify higher and require human review.

Routing map is HARD-CODED and cannot be overridden by API callers.
"""
from dataclasses import dataclass, field
from typing import List, Optional
import re


@dataclass
class ScoreResult:
    risk_score: float
    confidence: float
    classification: str
    llm_routing: str
    milspec_refs: List[str] = field(default_factory=list)
    usml_categories: List[str] = field(default_factory=list)
    flags: dict = field(default_factory=dict)
    review_reason: Optional[str] = None


# Any signal with weight >= 10.0 → immediate REJECTED (no score accumulation)
CRITICAL_WEIGHT = 10.0

THRESHOLDS = {
    "ITAR":         25.0,   # Score >= 25: ITAR
    "NEEDS_REVIEW": 15.0,   # Score >= 15: ambiguous, hold for human
    "EAR_HIGH":     10.0,   # Score >= 10: EAR elevated, local LLM
    "EAR_LOW":       5.0,   # Score >=  5: EAR low, cloud OK with tokenization
    # Below 5.0: CLEAN
}

# Hard routing table — classification → LLM routing. Non-negotiable.
ROUTING_MAP = {
    "REJECTED":     "HOLD",
    "ITAR":         "LOCAL_ONLY",
    "NEEDS_REVIEW": "HOLD",
    "EAR_HIGH":     "LOCAL_ONLY",
    "EAR_LOW":      "CLOUD_OK",
    "CLEAN":        "CLOUD_OK",
}


def compute_risk_score(signals: list, title_block: dict) -> ScoreResult:
    # Check for critical signals first — bypass score accumulation
    critical = [s for s in signals if s.get("weight", 0) >= CRITICAL_WEIGHT]
    if critical:
        trigger = critical[0]["value"]
        return ScoreResult(
            risk_score=100.0,
            confidence=1.0,
            classification="REJECTED",
            llm_routing="HOLD",
            milspec_refs=_extract_milspecs(signals),
            usml_categories=_extract_usml(signals),
            flags=_build_flags(signals, title_block),
            review_reason=f"Critical ITAR indicator detected: {trigger}"
        )

    # Accumulate weighted score (cap at 100)
    total_score = min(
        sum(s.get("weight", 0) for s in signals),
        100.0
    )

    # Confidence increases with signal count
    signal_count = len(signals)
    confidence = min(0.4 + (signal_count * 0.12), 1.0)

    # Determine classification from thresholds
    if total_score >= THRESHOLDS["ITAR"]:
        classification = "ITAR"
        review_reason = f"Risk score {total_score:.1f} — ITAR threshold exceeded"
    elif total_score >= THRESHOLDS["NEEDS_REVIEW"]:
        classification = "NEEDS_REVIEW"
        review_reason = f"Risk score {total_score:.1f} — ambiguous, requires human review"
    elif total_score >= THRESHOLDS["EAR_HIGH"]:
        classification = "EAR_HIGH"
        review_reason = None
    elif total_score >= THRESHOLDS["EAR_LOW"]:
        classification = "EAR_LOW"
        review_reason = None
    else:
        classification = "CLEAN"
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


def _extract_milspecs(signals: list) -> List[str]:
    return list({
        s["value"] for s in signals
        if "MILSPEC" in s.get("signal_type", "")
    })


def _extract_usml(signals: list) -> List[str]:
    return list({
        s["value"] for s in signals
        if "USML" in s.get("signal_type", "")
    })


def _build_flags(signals: list, title_block: dict) -> dict:
    types = [s.get("signal_type", "") for s in signals]
    return {
        "has_explicit_marking":  any("EXPLICIT_MARKING" in t or "CRITICAL_KEYWORD" in t for t in types),
        "has_distribution_stmt": any("DISTRIBUTION" in t for t in types),
        "has_military_program":  any("MILITARY_PROGRAM" in t for t in types),
        "has_defense_cage":      any("CAGE" in t for t in types),
        "has_milspec_refs":      any("MILSPEC" in t for t in types),
        "has_usml_category":     any("USML" in t for t in types),
    }
```

---

## 6. Service 2: ndtv1-sanitize

### 6.1 Custom Presidio Recognizers

Each file in `services/sanitize/sanitizers/recognizers/` follows the same pattern. Implement all of them.

**`drawing_number.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class DrawingNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("DWG_STANDARD",  r"\bDWG[\-\s]?[A-Z0-9]{2,}[\-\s]?[A-Z0-9\-]{2,20}\b", 0.85),
        Pattern("DWG_NUMERIC",   r"\b\d{7,10}[\-\s]?\d{3}\b", 0.75),
        Pattern("DWG_ALPHA",     r"\b[A-Z]{1,5}[\-_]\d{4,6}[\-_][A-Z0-9]{1,5}\b", 0.70),
        Pattern("DOC_NUMBER",    r"\bDOC[\-\s]?[A-Z0-9\-]{5,25}\b", 0.80),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="DRAWING_NUMBER",
            patterns=self.PATTERNS,
            context=["drawing", "drg", "dwg", "document", "number", "no.", "#"],
        )
```

**`part_number.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class PartNumberRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("PN_STANDARD",   r"\bP/?N[\-:\s]?[A-Z0-9\-\/]{3,25}\b", 0.90),
        Pattern("PN_DASH",       r"\b[A-Z]{1,4}-\d{4,8}[\-\/]?\d{0,4}\b", 0.70),
        Pattern("NSN",           r"\b\d{4}-\d{2}-\d{3}-\d{4}\b", 0.95),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="PART_NUMBER",
            patterns=self.PATTERNS,
            context=["part", "p/n", "pn", "item", "stock", "nsn"],
        )
```

**`cage_code.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class CAGECodeRecognizer(PatternRecognizer):
    PATTERNS = [
        Pattern("CAGE_PATTERN", r"\b[A-Z0-9]{5}\b", 0.55),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="CAGE_CODE",
            patterns=self.PATTERNS,
            context=["cage", "cage code", "supplier", "vendor", "manufacturer", "mfr", "mfg"],
        )
```

**`contract_number.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class ContractNumberRecognizer(PatternRecognizer):
    """
    DoD contract format examples:
    FA8620-21-C-0042  (USAF)
    W911NF-20-1-0001  (Army)
    N00019-18-C-0001  (Navy)
    """
    PATTERNS = [
        Pattern("DOD_CONTRACT", r"\b[A-Z]{1,2}\d{4,6}-\d{2}-[A-Z]-\d{4,5}\b", 0.90),
        Pattern("CONTRACT_GENERIC", r"\b(?:CONTRACT|CONT|CONTR)[\s.:#]*([A-Z0-9\-]{8,20})\b", 0.75),
        Pattern("DFARS_REF", r"\bDFARS[\s\-]?\d{3,4}\.\d{1,4}\b", 0.85),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="CONTRACT_NUMBER",
            patterns=self.PATTERNS,
            context=["contract", "award", "dfars", "far", "solicitation", "po", "purchase order"],
        )
```

**`cert_id.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class CertIDRecognizer(PatternRecognizer):
    """NADCAP cert numbers, AS9100 cert numbers, inspector cert IDs."""
    PATTERNS = [
        Pattern("NADCAP", r"\bNADCAP[\s\-]?[A-Z0-9\-]{4,20}\b", 0.90),
        Pattern("AS9100_CERT", r"\bAS9100[\s\-]?[A-Z0-9\-]{4,20}\b", 0.85),
        Pattern("INSPECTOR_CERT", r"\b(?:CERT|CERTIFICATION)[\s:#\-]*([A-Z0-9\-]{4,20})\b", 0.65),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="CERTID",
            patterns=self.PATTERNS,
            context=["nadcap", "certification", "cert", "inspector", "qualified"],
        )
```

**`project_code.py`**
```python
from presidio_analyzer import PatternRecognizer, Pattern

class ProjectCodeRecognizer(PatternRecognizer):
    """Work order IDs, job numbers, project codes."""
    PATTERNS = [
        Pattern("WORK_ORDER", r"\b(?:WO|W/O|WORK[\s\-]?ORDER)[\s:#\-]*([A-Z0-9\-]{4,20})\b", 0.85),
        Pattern("JOB_NUMBER", r"\b(?:JOB|JB)[\s:#\-]*([A-Z0-9\-]{3,15})\b", 0.80),
        Pattern("PROJECT_CODE", r"\b(?:PROJ|PROJECT|PRJ)[\s:#\-]*([A-Z0-9\-]{3,20})\b", 0.75),
    ]
    def __init__(self):
        super().__init__(
            supported_entity="PROJECT",
            patterns=self.PATTERNS,
            context=["work order", "job", "project", "wo", "job number"],
        )
```

### 6.2 `services/sanitize/sanitizers/text_sanitizer.py`

```python
"""
Presidio-backed text sanitization with NDT custom recognizers.

Design:
- Detects standard PII (person names, organizations, emails, phones, locations)
- Detects NDT domain entities (drawing numbers, part numbers, CAGE codes, etc.)
- Replaces each entity with a typed deterministic token
- Returns sanitized text + token manifest for vault storage

Token format: ENTITYTYPE__XXXXXXXX
Example: "Boeing" → "COMPANY__A94F7K2M"
         "DWG-LM-4471" → "DRAWING__K2D1N8QR"

Same entity in same namespace = same token every time (deterministic).
This allows the LLM to reason about entity relationships across a document.
"""
import logging
from typing import Tuple, Dict
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from presidio_anonymizer import AnonymizerEngine
from presidio_anonymizer.entities import OperatorConfig

from shared.crypto import TokenVault
from .recognizers.drawing_number import DrawingNumberRecognizer
from .recognizers.part_number import PartNumberRecognizer
from .recognizers.cage_code import CAGECodeRecognizer
from .recognizers.contract_number import ContractNumberRecognizer
from .recognizers.cert_id import CertIDRecognizer
from .recognizers.project_code import ProjectCodeRecognizer

logger = logging.getLogger(__name__)

# Standard Presidio entities to detect
STANDARD_ENTITIES = [
    "PERSON",
    "ORGANIZATION",
    "EMAIL_ADDRESS",
    "PHONE_NUMBER",
    "LOCATION",
    "URL",
    "IP_ADDRESS",
]

# NDT domain entities (custom recognizers)
NDT_ENTITIES = [
    "DRAWING_NUMBER",
    "PART_NUMBER",
    "CAGE_CODE",
    "CONTRACT_NUMBER",
    "CERTID",
    "PROJECT",
]

# Entity type → token prefix mapping
ENTITY_TOKEN_MAP = {
    "PERSON":           "PERSON",
    "ORGANIZATION":     "COMPANY",
    "EMAIL_ADDRESS":    "EMAIL",
    "PHONE_NUMBER":     "PHONE",
    "LOCATION":         "LOCATION",
    "URL":              "URL",
    "IP_ADDRESS":       "IP",
    "DRAWING_NUMBER":   "DRAWING",
    "PART_NUMBER":      "PARTNUM",
    "CAGE_CODE":        "CAGECODE",
    "CONTRACT_NUMBER":  "CONTRACT",
    "CERTID":           "CERTID",
    "PROJECT":          "PROJECT",
}

DETECTION_THRESHOLD = 0.6


class NDTTextSanitizer:
    def __init__(self, vault: TokenVault):
        self.vault = vault
        self.analyzer = self._build_analyzer()
        self.anonymizer = AnonymizerEngine()
        logger.info("NDTTextSanitizer initialized with %d recognizers", 
                   len(STANDARD_ENTITIES) + len(NDT_ENTITIES))

    def _build_analyzer(self) -> AnalyzerEngine:
        registry = RecognizerRegistry()
        registry.load_predefined_recognizers()

        for recognizer_cls in [
            DrawingNumberRecognizer,
            PartNumberRecognizer,
            CAGECodeRecognizer,
            ContractNumberRecognizer,
            CertIDRecognizer,
            ProjectCodeRecognizer,
        ]:
            registry.add_recognizer(recognizer_cls())

        return AnalyzerEngine(registry=registry)

    def sanitize(self, text: str) -> Tuple[str, Dict[str, str]]:
        """
        Detect and replace all sensitive entities.
        
        Returns:
          sanitized_text: text with all entities replaced by typed tokens
          token_manifest: {token: original_value} — store in vault, never log
        """
        if not text or not text.strip():
            return text, {}

        results = self.analyzer.analyze(
            text=text,
            language="en",
            entities=STANDARD_ENTITIES + NDT_ENTITIES,
            score_threshold=DETECTION_THRESHOLD,
        )

        if not results:
            return text, {}

        token_manifest: Dict[str, str] = {}

        # Build per-entity-type operator config
        # Each detected span gets its own token based on actual value
        operators = {}
        for result in results:
            original_value = text[result.start:result.end]
            token_prefix = ENTITY_TOKEN_MAP.get(result.entity_type, "ENTITY")
            token = self.vault.generate_token(token_prefix, original_value)
            token_manifest[token] = original_value

            # Presidio operator: replace this entity type with this token
            # Note: if same entity type appears multiple times with different values,
            # each gets its own token via the deterministic generator
            operators[result.entity_type] = OperatorConfig(
                "replace", {"new_value": token}
            )

        anonymized = self.anonymizer.anonymize(
            text=text,
            analyzer_results=results,
            operators=operators,
        )

        logger.debug(
            "Sanitized %d entities from text (length=%d)",
            len(results), len(text)
        )

        return anonymized.text, token_manifest

    def reidentify(self, sanitized_text: str, token_manifest: Dict[str, str]) -> str:
        """
        Replace tokens with original values.
        Only called by authorized consumers via /reidentify endpoint.
        """
        result = sanitized_text
        for token, original in token_manifest.items():
            result = result.replace(token, original)
        return result
```

### 6.3 `services/sanitize/sanitizers/image_sanitizer.py`

```python
"""
Image redaction for engineering drawings.

Pipeline:
1. OCR image with bounding boxes (PaddleOCR)
2. Run text through NDTTextSanitizer
3. For each detected entity, find its bounding box in OCR results
4. Black-rectangle redact those regions on the original image
5. Return redacted image + sanitized OCR text + bounding box manifest

This ensures that even if text extraction is used alongside the image,
both paths produce sanitized output.
"""
import logging
import numpy as np
import cv2
import fitz  # PyMuPDF
from typing import Dict, List

from shared.crypto import TokenVault
from .text_sanitizer import NDTTextSanitizer

logger = logging.getLogger(__name__)


class NDTImageSanitizer:
    def __init__(self, vault: TokenVault):
        self.vault = vault
        self.text_sanitizer = NDTTextSanitizer(vault=vault)
        self._init_ocr()

    def _init_ocr(self):
        try:
            from paddleocr import PaddleOCR
            self.ocr = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
            logger.info("PaddleOCR initialized")
        except ImportError:
            logger.warning("PaddleOCR not available — image redaction will be limited")
            self.ocr = None

    async def sanitize_image_bytes(self, image_bytes: bytes) -> dict:
        """Process a single image. Returns redacted image + sanitized text."""
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if image is None:
            raise ValueError("Failed to decode image bytes")

        return await self._process_image_array(image)

    async def sanitize_pdf(self, pdf_bytes: bytes) -> dict:
        """Process all pages of a PDF. Returns per-page results + combined output."""
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages = []
        combined_sanitized_text = []
        combined_token_manifest: Dict[str, str] = {}

        for page_num, page in enumerate(doc):
            # Render at 300 DPI for quality OCR
            mat = fitz.Matrix(300 / 72, 300 / 72)
            pix = page.get_pixmap(matrix=mat)
            page_bytes = pix.tobytes("png")

            nparr = np.frombuffer(page_bytes, np.uint8)
            image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            result = await self._process_image_array(image)
            result["page_number"] = page_num + 1
            pages.append(result)

            combined_sanitized_text.append(result.get("sanitized_text", ""))
            combined_token_manifest.update(result.get("token_manifest", {}))

        doc.close()

        return {
            "pages": pages,
            "combined_sanitized_text": "\n\n".join(combined_sanitized_text),
            "combined_token_manifest": combined_token_manifest,
            "total_redactions": sum(len(p.get("redaction_regions", [])) for p in pages),
        }

    async def _process_image_array(self, image: np.ndarray) -> dict:
        """Core processing: OCR → sanitize → redact."""
        if self.ocr is None:
            return {
                "redacted_image_bytes": self._encode_image(image),
                "ocr_text": "",
                "sanitized_text": "",
                "token_manifest": {},
                "redaction_regions": [],
            }

        # OCR with bounding boxes
        ocr_result = self.ocr.ocr(image, cls=True)
        if not ocr_result or not ocr_result[0]:
            return {
                "redacted_image_bytes": self._encode_image(image),
                "ocr_text": "",
                "sanitized_text": "",
                "token_manifest": {},
                "redaction_regions": [],
            }

        # Build word list with bboxes
        word_bboxes = []
        text_parts = []
        for line in ocr_result[0]:
            bbox, (text, confidence) = line[0], line[1]
            if confidence > 0.5:
                word_bboxes.append({"text": text, "bbox": bbox})
                text_parts.append(text)

        full_text = " ".join(text_parts)

        # Sanitize OCR text
        sanitized_text, token_manifest = self.text_sanitizer.sanitize(full_text)

        # Redact image regions where entities were found
        redacted = image.copy()
        redaction_regions = []

        for token, original_value in token_manifest.items():
            entity_type = token.split("__")[0]
            original_upper = original_value.upper().strip()

            for word_info in word_bboxes:
                word_upper = word_info["text"].upper().strip()
                if word_upper in original_upper or original_upper in word_upper:
                    bbox = word_info["bbox"]
                    xs = [p[0] for p in bbox]
                    ys = [p[1] for p in bbox]
                    x1 = max(0, int(min(xs)) - 4)
                    y1 = max(0, int(min(ys)) - 4)
                    x2 = min(image.shape[1], int(max(xs)) + 4)
                    y2 = min(image.shape[0], int(max(ys)) + 4)

                    cv2.rectangle(redacted, (x1, y1), (x2, y2), (0, 0, 0), -1)
                    redaction_regions.append({
                        "token": token,
                        "entity_type": entity_type,
                        "bbox": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
                        "word_detected": word_info["text"],
                    })

        return {
            "redacted_image_bytes": self._encode_image(redacted),
            "ocr_text": full_text,
            "sanitized_text": sanitized_text,
            "token_manifest": token_manifest,
            "redaction_regions": redaction_regions,
        }

    @staticmethod
    def _encode_image(image: np.ndarray) -> bytes:
        _, buffer = cv2.imencode(".png", image)
        return buffer.tobytes()
```

### 6.4 `services/sanitize/sanitizers/metadata_sanitizer.py`

```python
"""
Strip all embedded document metadata before LLM processing.

Metadata stripped:
- PDF: title, author, creator, producer, subject, keywords, company,
       last modified by, creation date, modification date, XMP metadata
- Images: all EXIF tags including GPS, camera model, software, timestamps
- File system: do not pass original filename or path to LLM

This runs BEFORE entity detection — metadata can contain company names,
author names, and other sensitive identifiers.
"""
import io
import logging
import fitz
from PIL import Image

logger = logging.getLogger(__name__)


async def strip_pdf_metadata(pdf_bytes: bytes) -> tuple:
    """Returns (clean_pdf_bytes, removed_fields_report)"""
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    removed = []

    existing = doc.metadata
    for field, value in existing.items():
        if value:
            removed.append({"field": field, "had_value": True})
            logger.debug("Stripping PDF metadata field: %s", field)

    # Clear all standard metadata
    doc.set_metadata({
        "author": "",
        "producer": "",
        "creator": "",
        "title": "",
        "subject": "",
        "keywords": "",
        "creationDate": "",
        "modDate": "",
    })

    # Strip XMP metadata
    try:
        doc.del_xml_metadata()
        removed.append({"field": "XMP_METADATA", "had_value": True})
    except Exception:
        pass

    clean_bytes = doc.tobytes(garbage=4, deflate=True)
    doc.close()

    logger.info("Stripped %d metadata fields from PDF", len(removed))
    return clean_bytes, removed


async def strip_image_metadata(image_bytes: bytes) -> tuple:
    """Returns (clean_image_bytes, removed_fields_report)"""
    removed = []

    try:
        img = Image.open(io.BytesIO(image_bytes))

        # Report EXIF fields
        exif_data = None
        if hasattr(img, "_getexif") and img._getexif():
            from PIL.ExifTags import TAGS
            exif_data = img._getexif()
            for tag_id, value in exif_data.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                removed.append({"field": str(tag_name), "had_value": bool(value)})

        # Create new image without EXIF by saving to buffer without metadata
        clean_buffer = io.BytesIO()
        # Convert to RGB to strip alpha and any format-specific metadata
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        # Save as PNG without EXIF — PIL does not copy EXIF to PNG
        img.save(clean_buffer, format="PNG", optimize=False)
        clean_buffer.seek(0)

        logger.info("Stripped %d EXIF fields from image", len(removed))
        return clean_buffer.read(), removed

    except Exception as e:
        logger.warning("Image metadata strip error: %s — returning original", e)
        return image_bytes, []
```

---

## 7. Service 3: ndtv1-gateway

### 7.1 `services/gateway/main.py`

```python
import os
os.environ["SERVICE_NAME"] = "ndtv1-gateway"

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from shared.db import init_db
from shared.logging import setup_logging
from .routes import analyze, audit, health

@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    await init_db()
    yield

app = FastAPI(
    title="ndtv1 LLM Gateway",
    description="Routing enforcement, prompt assembly, and response post-processing",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(CORSMiddleware, allow_origins=["*"],
    allow_methods=["*"], allow_headers=["*"])

app.include_router(health.router, prefix="/health", tags=["health"])
app.include_router(analyze.router, prefix="/analyze", tags=["analyze"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
```

### 7.2 `services/gateway/models/schemas.py`

```python
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from uuid import UUID
from enum import Enum


class AnalyzeRequest(BaseModel):
    """
    Input to the gateway.
    Caller provides the sanitize job_id — gateway fetches sanitized content
    directly from the sanitize service. Caller never passes raw content here.
    """
    sanitize_job_id: str = Field(..., description="UUID from ndtv1-sanitize job")
    intake_id: str
    
    # Analysis parameters
    analysis_type: str = Field(
        ...,
        description="Type of analysis: 'defect_summary', 'drawing_review', 'report_analysis', 'custom'"
    )
    custom_prompt: Optional[str] = Field(
        None,
        description="Custom prompt suffix for 'custom' analysis_type"
    )
    
    # Include redacted image alongside text?
    include_image: bool = Field(False)
    
    # Caller identity for re-identification access control
    caller_id: str = Field(..., min_length=3)
    caller_role: str = Field(..., description="Role used for re-identification authorization")
    
    # Override default cloud provider for CLOUD_OK routing
    preferred_provider: Optional[str] = Field(
        None, description="'anthropic' or 'openai'. Ignored for LOCAL_ONLY routing."
    )

    # Re-identification preference for response
    # 'full' = re-identify everything caller is authorized for
    # 'partial' = re-identify only specified token types
    # 'none' = return response with tokens intact
    reidentify_mode: str = Field("full", pattern="^(full|partial|none)$")
    reidentify_entity_types: Optional[List[str]] = Field(
        None, description="For 'partial' mode: which entity types to re-identify"
    )


class AnalyzeResponse(BaseModel):
    gateway_request_id: UUID
    intake_id: str
    
    # Provider used
    provider: str
    model: str
    llm_routing_enforced: str     # Actual routing used
    
    # Results
    analysis: str                  # LLM response (re-identified or tokenized per reidentify_mode)
    tokens_reidentified: int       # How many tokens were re-identified in response
    tokens_remaining: int          # Tokens left as-is (caller not authorized or mode=none)
    
    # Audit
    second_pass_clean: bool        # Did second-pass scan pass?
    processing_ms: int
    llm_latency_ms: int


class SecondPassResult(BaseModel):
    clean: bool
    entities_found: int
    aborted: bool
    details: List[dict]
```

### 7.3 `services/gateway/gateway/router.py`

```python
"""
LLM Routing Enforcement.

This is the single most critical security component in the gateway.
The routing decision made here is FINAL and cannot be overridden by:
  - API callers
  - request parameters
  - environment overrides at call time

The only way to change routing for a document is to re-classify it
through ndtv1-comply with a human reviewer override.

Routing table (from comply classification):
  CLEAN        → CLOUD_OK   → Default cloud provider (Anthropic/OpenAI)
  EAR_LOW      → CLOUD_OK   → Default cloud provider (with tokenization)
  EAR_HIGH     → LOCAL_ONLY → Ollama (RTX 3090)
  ITAR         → LOCAL_ONLY → Ollama (RTX 3090)
  NEEDS_REVIEW → HOLD       → 403 Forbidden
  REJECTED     → HOLD       → 403 Forbidden
"""
import os
import logging
from shared.exceptions import RoutingBlockedError

logger = logging.getLogger(__name__)

# Load from env — allows updating without code change
CLOUD_OK_CLASSIFICATIONS = set(
    os.environ.get("CLOUD_OK_CLASSIFICATIONS", "CLEAN,EAR_LOW").split(",")
)
LOCAL_ONLY_CLASSIFICATIONS = set(
    os.environ.get("LOCAL_ONLY_CLASSIFICATIONS", "EAR_HIGH,ITAR").split(",")
)
BLOCKED_CLASSIFICATIONS = set(
    os.environ.get("BLOCKED_CLASSIFICATIONS", "NEEDS_REVIEW,REJECTED,HOLD").split(",")
)


def enforce_routing(classification: str, llm_routing: str) -> str:
    """
    Validate and return the LLM routing to use.
    
    Returns: 'CLOUD_OK' or 'LOCAL_ONLY'
    Raises: RoutingBlockedError if document cannot be processed
    """
    # Normalize
    classification = classification.upper()
    llm_routing = llm_routing.upper()

    logger.info(
        "Routing enforcement: classification=%s llm_routing=%s",
        classification, llm_routing
    )

    # Check hard blocks first
    if classification in BLOCKED_CLASSIFICATIONS or llm_routing == "HOLD":
        logger.warning(
            "Request BLOCKED: classification=%s routing=%s",
            classification, llm_routing
        )
        raise RoutingBlockedError(classification, llm_routing)

    # Validate consistency between classification and routing
    if classification in LOCAL_ONLY_CLASSIFICATIONS:
        if llm_routing == "CLOUD_OK":
            # Classification says local-only but routing says cloud — safety wins
            logger.warning(
                "Classification=%s requires LOCAL_ONLY but routing=%s — "
                "overriding to LOCAL_ONLY",
                classification, llm_routing
            )
        return "LOCAL_ONLY"

    if classification in CLOUD_OK_CLASSIFICATIONS:
        return "CLOUD_OK"

    # Unknown classification — default to LOCAL_ONLY for safety
    logger.error(
        "Unknown classification=%s — defaulting to LOCAL_ONLY for safety",
        classification
    )
    return "LOCAL_ONLY"
```

### 7.4 `services/gateway/gateway/providers/base.py`

```python
"""Abstract LLM provider interface."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class LLMResponse:
    content: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    latency_ms: int


class BaseLLMProvider(ABC):
    @abstractmethod
    async def complete(
        self,
        system_prompt: str,
        user_content: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        pass

    @abstractmethod
    def get_model_name(self) -> str:
        pass
```

### 7.5 `services/gateway/gateway/providers/anthropic_provider.py`

```python
import os
import time
import logging
import httpx
import base64
from typing import Optional
from .base import BaseLLMProvider, LLMResponse
from shared.exceptions import LLMProviderError

logger = logging.getLogger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_VERSION = "2023-06-01"


class AnthropicProvider(BaseLLMProvider):
    def __init__(self):
        self.api_key = os.environ.get("ANTHROPIC_API_KEY", "")
        self.model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set")

    def get_provider_name(self) -> str:
        return "anthropic"

    def get_model_name(self) -> str:
        return self.model

    async def complete(
        self,
        system_prompt: str,
        user_content: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        start = time.time()

        content = []

        if image_bytes:
            content.append({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": "image/png",
                    "data": base64.b64encode(image_bytes).decode(),
                }
            })

        content.append({"type": "text", "text": user_content})

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": [{"role": "user", "content": content}],
        }

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": ANTHROPIC_API_VERSION,
            "content-type": "application/json",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            try:
                response = await client.post(
                    ANTHROPIC_API_URL, json=payload, headers=headers
                )
                response.raise_for_status()
                data = response.json()
            except httpx.HTTPStatusError as e:
                raise LLMProviderError(f"Anthropic API error {e.response.status_code}: {e.response.text}")
            except httpx.TimeoutException:
                raise LLMProviderError("Anthropic API timeout")

        latency = int((time.time() - start) * 1000)
        text_content = next(
            (b["text"] for b in data.get("content", []) if b.get("type") == "text"),
            ""
        )

        return LLMResponse(
            content=text_content,
            model=self.model,
            provider="anthropic",
            input_tokens=data.get("usage", {}).get("input_tokens", 0),
            output_tokens=data.get("usage", {}).get("output_tokens", 0),
            latency_ms=latency,
        )
```

### 7.6 `services/gateway/gateway/providers/ollama_provider.py`

```python
"""
Ollama provider for local LLM inference (RTX 3090).
Used exclusively for LOCAL_ONLY routing (ITAR/EAR_HIGH documents).
No data ever leaves the facility when this provider is active.
"""
import os
import time
import logging
import base64
import httpx
from typing import Optional
from .base import BaseLLMProvider, LLMResponse
from shared.exceptions import LLMProviderError

logger = logging.getLogger(__name__)


class OllamaProvider(BaseLLMProvider):
    def __init__(self):
        self.base_url = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
        self.model = os.environ.get("OLLAMA_MODEL", "llama3.3:70b")

    def get_provider_name(self) -> str:
        return "ollama"

    def get_model_name(self) -> str:
        return self.model

    async def complete(
        self,
        system_prompt: str,
        user_content: str,
        image_bytes: Optional[bytes] = None,
        max_tokens: int = 4096,
    ) -> LLMResponse:
        start = time.time()

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_content},
        ]

        # Add image if provided (Ollama multimodal support)
        if image_bytes:
            messages[-1]["images"] = [base64.b64encode(image_bytes).decode()]

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }

        async with httpx.AsyncClient(timeout=300.0) as client:
            try:
                response = await client.post(
                    f"{self.base_url}/api/chat",
                    json=payload
                )
                response.raise_for_status()
                data = response.json()
            except httpx.HTTPStatusError as e:
                raise LLMProviderError(f"Ollama error {e.response.status_code}: {e.response.text}")
            except httpx.ConnectError:
                raise LLMProviderError(
                    f"Cannot connect to Ollama at {self.base_url}. "
                    "Is the local inference server running?"
                )
            except httpx.TimeoutException:
                raise LLMProviderError("Ollama timeout — model may still be loading")

        latency = int((time.time() - start) * 1000)
        content = data.get("message", {}).get("content", "")

        return LLMResponse(
            content=content,
            model=self.model,
            provider="ollama",
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
            latency_ms=latency,
        )
```

### 7.7 `services/gateway/gateway/second_pass_scanner.py`

```python
"""
Second-pass residual entity detection.

Runs on the ASSEMBLED prompt (after sanitization) immediately before
sending to the LLM. This catches:
  - Entities missed by Presidio in first pass (low-confidence detections)
  - Entities introduced by system prompt templates
  - Context fragments that slipped through due to sentence boundary issues
  - Manual additions by callers who might inject content into custom_prompt

If residual entities are found above the threshold, the request is ABORTED.
The document must be re-processed through ndtv1-sanitize before retrying.

This is the last safety gate before data reaches the LLM provider.
"""
import os
import logging
from typing import Tuple, List
from presidio_analyzer import AnalyzerEngine, RecognizerRegistry
from shared.exceptions import ResidualEntityError

logger = logging.getLogger(__name__)

THRESHOLD = float(os.environ.get("RESIDUAL_DETECTION_THRESHOLD", "0.6"))

# Entity types to scan for in second pass
# Deliberately broader than first pass — we want false positives here
SCAN_ENTITIES = [
    "PERSON", "ORGANIZATION", "EMAIL_ADDRESS", "PHONE_NUMBER",
    "LOCATION", "URL",
]

# Token patterns we EXPECT to see — exclude these from residual detection
# These are correctly sanitized tokens, not residual entities
VALID_TOKEN_PATTERN = r"^[A-Z]+__[A-Z0-9]{8}$"

_analyzer = None


def get_analyzer() -> AnalyzerEngine:
    global _analyzer
    if _analyzer is None:
        registry = RecognizerRegistry()
        registry.load_predefined_recognizers()
        _analyzer = AnalyzerEngine(registry=registry)
    return _analyzer


def scan_for_residuals(prompt_text: str) -> Tuple[bool, List[dict]]:
    """
    Scan assembled prompt for residual unsanitized entities.
    
    Returns:
      (clean: bool, findings: list of entity details)
    
    clean=True means no residual entities found above threshold.
    clean=False means request should be aborted.
    """
    import re
    token_pattern = re.compile(VALID_TOKEN_PATTERN)

    analyzer = get_analyzer()
    results = analyzer.analyze(
        text=prompt_text,
        language="en",
        entities=SCAN_ENTITIES,
        score_threshold=THRESHOLD,
    )

    findings = []
    for result in results:
        detected_text = prompt_text[result.start:result.end]

        # Skip if this looks like a valid token (already sanitized)
        if token_pattern.match(detected_text.strip()):
            continue

        findings.append({
            "entity_type": result.entity_type,
            "score": result.score,
            "start": result.start,
            "end": result.end,
            "preview": detected_text[:30] + "..." if len(detected_text) > 30 else detected_text,
        })

    clean = len(findings) == 0

    if not clean:
        logger.warning(
            "Second-pass detected %d residual entities in prompt. Aborting.",
            len(findings)
        )

    return clean, findings
```

### 7.8 `services/gateway/gateway/prompt_builder.py`

```python
"""
Assembles the final prompt payload for the LLM.

System prompts are analysis-type specific and designed to:
1. Reinforce that all identifiers are tokenized (prevents hallucination)
2. Instruct the LLM to preserve tokens in its response (required for re-identification)
3. Frame the NDT analysis context appropriately
4. Never ask the LLM to infer real company/part names from tokens
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Analysis-type system prompts
SYSTEM_PROMPTS = {
    "defect_summary": """You are an expert non-destructive testing (NDT) analysis assistant for an aerospace facility.

You will analyze NDT inspection data and provide technical summaries.

IMPORTANT — TOKEN AWARENESS:
All sensitive identifiers in this document have been replaced with typed tokens using the format ENTITYTYPE__XXXXXXXX.
Examples: COMPANY__A94F7K2M, DRAWING__K2D1N8QR, PARTNUM__N39PR7KL

Rules for your response:
1. Use these exact token strings whenever referring to companies, drawings, parts, or people
2. DO NOT attempt to guess, infer, or reconstruct real names from tokens
3. DO NOT replace tokens with generic terms like "the company" or "the part"
4. Your analysis should read naturally with tokens in place — they are the correct identifiers for this session

Provide: defect classification, location description, severity assessment, recommended follow-up actions.""",

    "drawing_review": """You are an expert aerospace engineering drawing review assistant.

You will analyze engineering drawing content and technical data.

IMPORTANT — TOKEN AWARENESS:
All proprietary identifiers (company names, drawing numbers, part numbers, project codes, personnel) 
have been replaced with typed tokens in format ENTITYTYPE__XXXXXXXX.

Rules for your response:
1. Reference tokens exactly as they appear — do not substitute or guess real values
2. Focus on technical content: dimensions, tolerances, material specs, process requirements
3. Flag any technical concerns, non-conformances, or missing information
4. Preserve all token strings in your output exactly as provided""",

    "report_analysis": """You are an expert NDT report analysis assistant for aerospace quality assurance.

You will analyze inspection reports and quality documentation.

IMPORTANT — TOKEN AWARENESS:
Sensitive identifiers have been replaced with typed tokens (format: ENTITYTYPE__XXXXXXXX).

Rules for your response:
1. Preserve all tokens exactly as they appear in your response
2. Provide: executive summary, key findings, risk assessment, compliance status
3. Reference specific tokens when citing findings (e.g., "DRAWING__K2D1 shows...")
4. Do not attempt to reverse-engineer real identities from tokens""",

    "custom": """You are an expert NDT and aerospace analysis assistant.

IMPORTANT — TOKEN AWARENESS:
All sensitive identifiers use format ENTITYTYPE__XXXXXXXX.
Preserve all tokens exactly in your response. Do not guess real values.""",
}


def build_prompt(
    analysis_type: str,
    sanitized_text: str,
    custom_prompt: Optional[str] = None,
    max_tokens: int = 8000,
) -> tuple:
    """
    Build (system_prompt, user_content) for the LLM.
    
    Returns:
      system_prompt: str
      user_content: str (truncated to max_tokens estimate if needed)
    """
    system_prompt = SYSTEM_PROMPTS.get(
        analysis_type,
        SYSTEM_PROMPTS["custom"]
    )

    if analysis_type == "custom" and custom_prompt:
        system_prompt = SYSTEM_PROMPTS["custom"] + f"\n\nSpecific analysis requested:\n{custom_prompt}"

    # Rough token estimate (1 token ≈ 4 chars)
    max_content_chars = max_tokens * 4
    content = sanitized_text

    if len(content) > max_content_chars:
        content = content[:max_content_chars]
        content += "\n\n[Content truncated at token limit]"
        logger.warning(
            "Prompt truncated from %d to %d chars (token limit)",
            len(sanitized_text), max_content_chars
        )

    user_content = f"Please analyze the following NDT document content:\n\n{content}"

    return system_prompt, user_content
```

### 7.9 `services/gateway/gateway/reidentifier.py`

```python
"""
Selective re-identification of LLM response.

After the LLM responds with tokenized content, this module:
1. Identifies which tokens appear in the response
2. Checks caller's role against each token's reidentify_roles
3. Replaces authorized tokens with original values from the vault
4. Leaves unauthorized tokens as-is
5. Logs all re-identification decisions to gateway_reidentify_log

This is the only place in the system where decryption occurs on the
response path. The decryption key is loaded from env, never logged.
"""
import logging
import re
from typing import Dict, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from shared.crypto import decrypt_value, load_secret_key

logger = logging.getLogger(__name__)

# Token pattern: ENTITYTYPE__8CHARS
TOKEN_REGEX = re.compile(r'\b([A-Z]+__[A-Z0-9]{8})\b')


async def selective_reidentify(
    response_text: str,
    job_namespace: str,
    caller_role: str,
    reidentify_mode: str,
    authorized_entity_types: List[str],
    session: AsyncSession,
) -> Tuple[str, int, int]:
    """
    Re-identify tokens in response based on caller authorization.
    
    Returns:
      (reidentified_text, tokens_reidentified_count, tokens_remaining_count)
    """
    if reidentify_mode == "none":
        tokens = set(TOKEN_REGEX.findall(response_text))
        return response_text, 0, len(tokens)

    # Find all tokens in response
    tokens_in_response = set(TOKEN_REGEX.findall(response_text))
    if not tokens_in_response:
        return response_text, 0, 0

    # Fetch vault entries for these tokens
    from services.sanitize.models.db_models import TokenVault as TVModel
    result = await session.execute(
        select(TVModel).where(
            TVModel.job_namespace == job_namespace,
            TVModel.token.in_(list(tokens_in_response))
        )
    )
    vault_entries = {row.token: row for row in result.scalars()}

    secret_key = load_secret_key()
    reidentified_text = response_text
    tokens_reidentified = 0
    tokens_remaining = 0

    for token in tokens_in_response:
        vault_entry = vault_entries.get(token)

        if not vault_entry:
            tokens_remaining += 1
            continue

        entity_type = token.split("__")[0]

        # Check authorization
        authorized = _check_authorization(
            caller_role=caller_role,
            reidentify_mode=reidentify_mode,
            entity_type=entity_type,
            authorized_types=authorized_entity_types,
            vault_entry=vault_entry,
        )

        if authorized:
            try:
                original_value = decrypt_value(vault_entry.encrypted_value, secret_key)
                reidentified_text = reidentified_text.replace(token, original_value)
                tokens_reidentified += 1
                logger.debug("Re-identified token %s for role %s", token, caller_role)
            except Exception as e:
                logger.error("Decryption failed for token %s: %s", token, e)
                tokens_remaining += 1
        else:
            tokens_remaining += 1
            logger.debug(
                "Token %s NOT re-identified: caller_role=%s not in reidentify_roles=%s",
                token, caller_role, vault_entry.reidentify_roles
            )

    return reidentified_text, tokens_reidentified, tokens_remaining


def _check_authorization(
    caller_role: str,
    reidentify_mode: str,
    entity_type: str,
    authorized_types: List[str],
    vault_entry,
) -> bool:
    """Check if caller is authorized to re-identify this specific token."""
    # Check vault entry's role list
    allowed_roles = vault_entry.reidentify_roles or []
    if caller_role not in allowed_roles:
        return False

    # For partial mode, check entity type is in authorized list
    if reidentify_mode == "partial":
        if authorized_types and entity_type not in [t.upper() for t in authorized_types]:
            return False

    return True
```

### 7.10 `services/gateway/routes/analyze.py`

```python
"""
Main gateway analysis endpoint.

Flow:
1. Receive AnalyzeRequest with sanitize_job_id
2. Fetch sanitized content from DB
3. Enforce routing (HARD block if HOLD/REJECTED)
4. Build prompt
5. Second-pass scan on assembled prompt
6. Call LLM provider
7. Validate response (no raw entity leakage)
8. Selective re-identification
9. Audit log
10. Return AnalyzeResponse
"""
import hashlib
import logging
import time
from uuid import uuid4
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from shared.db import get_session
from shared.exceptions import RoutingBlockedError, ResidualEntityError, LLMProviderError
from ..models.schemas import AnalyzeRequest, AnalyzeResponse
from ..gateway.router import enforce_routing
from ..gateway.prompt_builder import build_prompt
from ..gateway.second_pass_scanner import scan_for_residuals
from ..gateway.reidentifier import selective_reidentify
from ..gateway.providers.anthropic_provider import AnthropicProvider
from ..gateway.providers.openai_provider import OpenAIProvider
from ..gateway.providers.ollama_provider import OllamaProvider

router = APIRouter()
logger = logging.getLogger(__name__)


def get_provider(routing: str, preferred: str = None):
    """Select LLM provider based on enforced routing."""
    if routing == "LOCAL_ONLY":
        return OllamaProvider()

    # CLOUD_OK — use preferred or default
    import os
    provider_name = preferred or os.environ.get("DEFAULT_CLOUD_PROVIDER", "anthropic")
    if provider_name == "openai":
        return OpenAIProvider()
    return AnthropicProvider()


@router.post("", response_model=AnalyzeResponse)
async def analyze_document(
    request_body: AnalyzeRequest,
    http_request: Request,
    session: AsyncSession = Depends(get_session),
):
    start_ms = time.time()
    gateway_id = uuid4()
    caller_ip = http_request.client.host if http_request.client else "unknown"

    # ── Step 1: Fetch sanitized job from DB ──────────────────────────────────
    sanitize_job = await _get_sanitize_job(session, request_body.sanitize_job_id)
    if not sanitize_job:
        raise HTTPException(status_code=404, detail="Sanitize job not found")

    comply_doc = await _get_comply_doc(session, sanitize_job.comply_doc_id)
    if not comply_doc:
        raise HTTPException(status_code=404, detail="Compliance record not found")

    classification = comply_doc.classification.value
    llm_routing_raw = comply_doc.llm_routing.value

    # ── Step 2: Enforce routing (HARD GATE) ──────────────────────────────────
    try:
        enforced_routing = enforce_routing(classification, llm_routing_raw)
    except RoutingBlockedError as e:
        await _log_blocked_request(
            session, gateway_id, sanitize_job, comply_doc,
            request_body, caller_ip, str(e)
        )
        raise HTTPException(
            status_code=403,
            detail=f"Request blocked: document classification={e.classification} "
                   f"routing={e.routing}. Requires human review before processing."
        )

    # ── Step 3: Select provider ───────────────────────────────────────────────
    provider = get_provider(enforced_routing, request_body.preferred_provider)

    # ── Step 4: Build prompt ──────────────────────────────────────────────────
    sanitized_text = sanitize_job.sanitized_text or ""
    system_prompt, user_content = build_prompt(
        analysis_type=request_body.analysis_type,
        sanitized_text=sanitized_text,
        custom_prompt=request_body.custom_prompt,
    )

    full_prompt = f"{system_prompt}\n\n{user_content}"

    # ── Step 5: Second-pass scan ──────────────────────────────────────────────
    second_pass_clean, second_pass_findings = scan_for_residuals(full_prompt)

    if not second_pass_clean:
        await _log_aborted_request(
            session, gateway_id, sanitize_job, comply_doc,
            request_body, provider, enforced_routing, caller_ip,
            second_pass_findings
        )
        raise HTTPException(
            status_code=422,
            detail=f"Second-pass scan detected {len(second_pass_findings)} residual "
                   f"unsanitized entities in prompt. Document requires re-sanitization."
        )

    # ── Step 6: Call LLM ──────────────────────────────────────────────────────
    image_bytes = None
    if request_body.include_image and sanitize_job.sanitized_image_path:
        image_bytes = await _load_image(sanitize_job.sanitized_image_path)

    try:
        llm_response = await provider.complete(
            system_prompt=system_prompt,
            user_content=user_content,
            image_bytes=image_bytes,
        )
    except LLMProviderError as e:
        logger.error("LLM provider error: %s", e)
        raise HTTPException(status_code=502, detail=f"LLM provider error: {str(e)}")

    llm_elapsed = llm_response.latency_ms

    # ── Step 7: Selective re-identification ───────────────────────────────────
    final_response, tokens_reidentified, tokens_remaining = await selective_reidentify(
        response_text=llm_response.content,
        job_namespace=sanitize_job.job_namespace,
        caller_role=request_body.caller_role,
        reidentify_mode=request_body.reidentify_mode,
        authorized_entity_types=request_body.reidentify_entity_types or [],
        session=session,
    )

    # ── Step 8: Audit log ─────────────────────────────────────────────────────
    total_elapsed = int((time.time() - start_ms) * 1000)

    await _log_completed_request(
        session, gateway_id, sanitize_job, comply_doc,
        request_body, provider, enforced_routing, caller_ip,
        full_prompt, llm_response.content,
        second_pass_clean, tokens_reidentified, tokens_remaining,
        total_elapsed, llm_elapsed
    )

    return AnalyzeResponse(
        gateway_request_id=gateway_id,
        intake_id=request_body.intake_id,
        provider=provider.get_provider_name(),
        model=provider.get_model_name(),
        llm_routing_enforced=enforced_routing,
        analysis=final_response,
        tokens_reidentified=tokens_reidentified,
        tokens_remaining=tokens_remaining,
        second_pass_clean=second_pass_clean,
        processing_ms=total_elapsed,
        llm_latency_ms=llm_elapsed,
    )


async def _log_completed_request(
    session, gateway_id, sanitize_job, comply_doc,
    request_body, provider, enforced_routing, caller_ip,
    prompt_text, response_text,
    second_pass_clean, tokens_reidentified, tokens_remaining,
    total_elapsed, llm_elapsed
):
    """Persist audit record. Store hashes only — never raw prompt/response content."""
    from ..models.db_models import GatewayRequest
    import hashlib

    record = GatewayRequest(
        id=gateway_id,
        sanitize_job_id=sanitize_job.id,
        intake_id=request_body.intake_id,
        classification=comply_doc.classification,
        llm_routing=comply_doc.llm_routing,
        provider=provider.get_provider_name(),
        model=provider.get_model_name(),
        endpoint_url=str(provider.__class__),
        residual_entities_found=0,
        second_pass_clean=second_pass_clean,
        second_pass_aborted=False,
        prompt_hash=hashlib.sha256(prompt_text.encode()).hexdigest(),
        response_hash=hashlib.sha256(response_text.encode()).hexdigest(),
        status="COMPLETED",
        caller_id=request_body.caller_id,
        caller_role=request_body.caller_role,
        caller_ip=caller_ip,
        processing_ms=total_elapsed,
        llm_latency_ms=llm_elapsed,
    )
    session.add(record)


async def _get_sanitize_job(session, job_id: str):
    from services.sanitize.models.db_models import SanitizeJob
    from sqlalchemy import select
    result = await session.execute(
        select(SanitizeJob).where(SanitizeJob.id == job_id)
    )
    return result.scalar_one_or_none()


async def _get_comply_doc(session, doc_id):
    from services.comply.models.db_models import ComplyDocument
    from sqlalchemy import select
    result = await session.execute(
        select(ComplyDocument).where(ComplyDocument.id == doc_id)
    )
    return result.scalar_one_or_none()


async def _load_image(image_path: str) -> bytes:
    import aiofiles
    try:
        async with aiofiles.open(image_path, "rb") as f:
            return await f.read()
    except Exception:
        return None


async def _log_blocked_request(session, gateway_id, sanitize_job, comply_doc,
                                 request_body, caller_ip, error):
    from ..models.db_models import GatewayRequest
    record = GatewayRequest(
        id=gateway_id,
        sanitize_job_id=sanitize_job.id,
        intake_id=request_body.intake_id,
        classification=comply_doc.classification,
        llm_routing=comply_doc.llm_routing,
        provider="BLOCKED",
        model="BLOCKED",
        endpoint_url="BLOCKED",
        second_pass_clean=False,
        second_pass_aborted=False,
        status="ROUTING_BLOCKED",
        error_message=error,
        caller_id=request_body.caller_id,
        caller_role=request_body.caller_role,
        caller_ip=caller_ip,
    )
    session.add(record)


async def _log_aborted_request(session, gateway_id, sanitize_job, comply_doc,
                                 request_body, provider, enforced_routing, caller_ip,
                                 findings):
    from ..models.db_models import GatewayRequest
    record = GatewayRequest(
        id=gateway_id,
        sanitize_job_id=sanitize_job.id,
        intake_id=request_body.intake_id,
        classification=comply_doc.classification,
        llm_routing=comply_doc.llm_routing,
        provider=provider.get_provider_name(),
        model=provider.get_model_name(),
        endpoint_url="ABORTED",
        residual_entities_found=len(findings),
        second_pass_clean=False,
        second_pass_aborted=True,
        status="SECOND_PASS_ABORTED",
        error_message=f"{len(findings)} residual entities detected",
        caller_id=request_body.caller_id,
        caller_role=request_body.caller_role,
        caller_ip=caller_ip,
    )
    session.add(record)
```

---

## 8. Docker Compose

```yaml
version: "3.8"

services:

  comply:
    build:
      context: .
      dockerfile: services/comply/Dockerfile
    container_name: ndtv1-comply
    ports:
      - "${COMPLY_PORT:-8010}:8010"
    env_file: .env
    environment:
      - SERVICE_NAME=ndtv1-comply
    depends_on:
      postgres:
        condition: service_healthy
      presidio-analyzer:
        condition: service_started
    volumes:
      - ./shared:/app/shared:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8010/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

  sanitize:
    build:
      context: .
      dockerfile: services/sanitize/Dockerfile
    container_name: ndtv1-sanitize
    ports:
      - "${SANITIZE_PORT:-8011}:8011"
    env_file: .env
    environment:
      - SERVICE_NAME=ndtv1-sanitize
    depends_on:
      postgres:
        condition: service_healthy
      presidio-analyzer:
        condition: service_started
      presidio-image-redactor:
        condition: service_started
    volumes:
      - ./shared:/app/shared:ro
      - sanitize_images:/app/images
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8011/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 90s

  gateway:
    build:
      context: .
      dockerfile: services/gateway/Dockerfile
    container_name: ndtv1-gateway
    ports:
      - "${GATEWAY_PORT:-8012}:8012"
    env_file: .env
    environment:
      - SERVICE_NAME=ndtv1-gateway
    depends_on:
      postgres:
        condition: service_healthy
      comply:
        condition: service_healthy
      sanitize:
        condition: service_healthy
    volumes:
      - ./shared:/app/shared:ro
      - sanitize_images:/app/images:ro
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-sf", "http://localhost:8012/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

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
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ndtv1 -d ndtv1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

volumes:
  pgdata:
  sanitize_images:
```

---

## 9. Python Dependencies

```txt
# shared/requirements.txt — install in all service images
sqlalchemy[asyncio]==2.0.35
asyncpg==0.29.0
alembic==1.13.3
cryptography==43.0.1
pydantic==2.9.0
pydantic-settings==2.5.2

# services/comply/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
pymupdf==1.24.11
paddleocr==2.8.1
paddlepaddle==2.6.2
pillow==10.4.0
numpy==1.26.4
opencv-python-headless==4.10.0.84
httpx==0.27.2
python-multipart==0.0.12
aiofiles==24.1.0
-r ../../shared/requirements.txt

# services/sanitize/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
presidio-analyzer==2.2.355
presidio-anonymizer==2.2.355
presidio-image-redactor==0.0.55
pymupdf==1.24.11
paddleocr==2.8.1
paddlepaddle==2.6.2
pillow==10.4.0
piexif==1.1.3
numpy==1.26.4
opencv-python-headless==4.10.0.84
httpx==0.27.2
python-multipart==0.0.12
aiofiles==24.1.0
spacy==3.7.6
en-core-web-lg @ https://github.com/explosion/spacy-models/releases/download/en_core_web_lg-3.7.1/en_core_web_lg-3.7.1-py3-none-any.whl
-r ../../shared/requirements.txt

# services/gateway/requirements.txt
fastapi==0.115.0
uvicorn[standard]==0.30.0
presidio-analyzer==2.2.355
httpx==0.27.2
python-multipart==0.0.12
aiofiles==24.1.0
-r ../../shared/requirements.txt
```

---

## 10. Dockerfiles

All three services follow the same Dockerfile pattern. Create one for each.

```dockerfile
# services/comply/Dockerfile (repeat pattern for sanitize and gateway)
FROM python:3.11-slim

WORKDIR /app

# System deps for PaddleOCR, OpenCV, PyMuPDF
RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 libsm6 libxext6 libxrender-dev \
    libgomp1 libgl1-mesa-glx curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY services/comply/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared utilities
COPY shared/ /app/shared/

# Copy service code
COPY services/comply/ /app/services/comply/

EXPOSE 8010

CMD ["uvicorn", "services.comply.main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "2"]
```

---

## 11. Seed Data Scripts

### `scripts/seed_keyword_db.py`

```python
#!/usr/bin/env python3
"""
Seed the comply_keyword_library and comply_cage_code_registry tables.
Run once after alembic upgrade head:
  python scripts/seed_keyword_db.py
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

DATABASE_URL = os.environ["DATABASE_URL"]
engine = create_async_engine(DATABASE_URL)
AsyncSession_ = async_sessionmaker(engine, class_=AsyncSession)

KEYWORDS = [
    # (category, keyword, weight, exact_match, description)
    # ── ITAR Critical ──────────────────────────────────────────
    ("ITAR", "EXPORT CONTROLLED",          10.0, True,  "Explicit ITAR marking"),
    ("ITAR", "ITAR CONTROLLED",             10.0, True,  "Explicit ITAR marking"),
    ("ITAR", "SUBJECT TO ITAR",             10.0, True,  "Explicit ITAR marking"),
    ("ITAR", "TECHNICAL DATA CONTROLLED",   10.0, True,  "Explicit ITAR marking"),
    ("ITAR", "NOT FOR EXPORT",              10.0, True,  "Explicit restriction"),
    ("ITAR", "DISTRIBUTION STATEMENT D",    10.0, True,  "DoD restricted distribution"),
    ("ITAR", "DISTRIBUTION STATEMENT E",    10.0, True,  "DoD restricted distribution"),
    ("ITAR", "DISTRIBUTION STATEMENT F",    10.0, True,  "Most restrictive distribution"),
    ("ITAR", "USML CATEGORY",               9.0,  True,  "USML category reference"),
    ("ITAR", "MUNITIONS LIST",              9.0,  True,  "Munitions list reference"),
    # ── EAR ────────────────────────────────────────────────────
    ("EAR",  "EAR CONTROLLED",              7.0,  True,  "Explicit EAR marking"),
    ("EAR",  "SUBJECT TO EAR",              7.0,  True,  "Explicit EAR marking"),
    ("EAR",  "NO LICENSE REQUIRED",         4.0,  True,  "EAR NLR marker"),
    ("EAR",  "EAR99",                        3.0,  True,  "EAR99 classification"),
    ("EAR",  r"ECCN\s+[A-Z0-9]{5}",         6.0,  False, "ECCN number pattern"),
    # ── Distribution ───────────────────────────────────────────
    ("ITAR", r"DIST(?:RIBUTION)?\s+STMT?\s*[:\-]?\s*[DEF]\b", 10.0, False, "Distribution stmt regex"),
    ("EAR",  r"DIST(?:RIBUTION)?\s+STMT?\s*[:\-]?\s*[BC]\b",   7.0, False, "Distribution stmt regex"),
]

CAGE_CODES = [
    # (cage_code, company_name, is_defense, risk_level)
    ("19971", "Lockheed Martin Aeronautics Company",        True, "HIGH"),
    ("77445", "Northrop Grumman Systems Corporation",       True, "HIGH"),
    ("77272", "Raytheon Technologies Corporation",          True, "HIGH"),
    ("81205", "The Boeing Company — Defense",               True, "HIGH"),
    ("1WMP7", "L3Harris Technologies Inc.",                 True, "HIGH"),
    ("98459", "General Dynamics Corporation",               True, "HIGH"),
    ("78286", "BAE Systems Inc.",                           True, "HIGH"),
    ("28899", "Textron Aviation Defense LLC",               True, "HIGH"),
    ("55951", "United Technologies Corporation",           True, "HIGH"),
    ("77049", "Honeywell International — Defense",          True, "HIGH"),
    ("04627", "General Electric Aviation",                  True, "MEDIUM"),
    ("61753", "Pratt & Whitney — Military Engines",         True, "HIGH"),
    ("12259", "Rolls-Royce North America — Defense",        True, "HIGH"),
    ("12200", "DRS Technologies Inc.",                      True, "HIGH"),
    ("27561", "SAIC — Science Applications International",  True, "HIGH"),
    ("97480", "FLIR Systems Inc.",                          True, "MEDIUM"),
]


async def main():
    async with AsyncSession_() as session:
        # Keywords
        for category, keyword, weight, exact_match, description in KEYWORDS:
            await session.execute(text("""
                INSERT INTO comply_keyword_library (category, keyword, weight, exact_match, description)
                VALUES (:category, :keyword, :weight, :exact_match, :description)
                ON CONFLICT DO NOTHING
            """), {
                "category": category, "keyword": keyword,
                "weight": weight, "exact_match": exact_match,
                "description": description
            })

        # CAGE codes
        for cage_code, company_name, is_defense, risk_level in CAGE_CODES:
            await session.execute(text("""
                INSERT INTO comply_cage_code_registry (cage_code, company_name, is_defense, risk_level)
                VALUES (:cage_code, :company_name, :is_defense, :risk_level)
                ON CONFLICT (cage_code) DO UPDATE
                SET company_name = EXCLUDED.company_name,
                    is_defense = EXCLUDED.is_defense,
                    risk_level = EXCLUDED.risk_level,
                    last_updated = NOW()
            """), {
                "cage_code": cage_code, "company_name": company_name,
                "is_defense": is_defense, "risk_level": risk_level
            })

        await session.commit()
        print(f"Seeded {len(KEYWORDS)} keywords and {len(CAGE_CODES)} CAGE codes")


if __name__ == "__main__":
    asyncio.run(main())
```

### `scripts/generate_secret_key.py`

```python
#!/usr/bin/env python3
"""Generate a new TOKEN_SECRET_KEY."""
import os
print(os.urandom(32).hex())
```

### `scripts/test_pipeline.sh`

```bash
#!/bin/bash
# End-to-end smoke test
set -e

BASE_COMPLY="http://localhost:8010"
BASE_SANITIZE="http://localhost:8011"
BASE_GATEWAY="http://localhost:8012"

echo "=== ndtv1 Pipeline Smoke Test ==="

# Health checks
echo "[1] Health checks..."
curl -sf "$BASE_COMPLY/health" | python3 -m json.tool
curl -sf "$BASE_SANITIZE/health" | python3 -m json.tool
curl -sf "$BASE_GATEWAY/health" | python3 -m json.tool

# Encode test PDF
TEST_PDF=$(base64 -w0 services/comply/tests/fixtures/sample_clean.pdf 2>/dev/null || \
           base64 services/comply/tests/fixtures/sample_clean.pdf)

# Step 1: Classify
echo "[2] Classifying test document..."
CLASSIFY_RESP=$(curl -sf -X POST "$BASE_COMPLY/classify" \
  -H "Content-Type: application/json" \
  -d "{
    \"intake_id\": \"TEST-001\",
    \"filename\": \"test_drawing.pdf\",
    \"file_content\": \"$TEST_PDF\",
    \"mime_type\": \"application/pdf\",
    \"job_namespace\": \"test-namespace\"
  }")

echo "$CLASSIFY_RESP" | python3 -m json.tool
CLASSIFICATION=$(echo "$CLASSIFY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['classification'])")
DOC_ID=$(echo "$CLASSIFY_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['doc_id'])")
echo "Classification: $CLASSIFICATION"

# Step 2: Sanitize
echo "[3] Sanitizing test document..."
SANITIZE_RESP=$(curl -sf -X POST "$BASE_SANITIZE/sanitize" \
  -H "Content-Type: application/json" \
  -d "{
    \"intake_id\": \"TEST-001\",
    \"comply_doc_id\": \"$DOC_ID\",
    \"filename\": \"test_drawing.pdf\",
    \"file_content\": \"$TEST_PDF\",
    \"mime_type\": \"application/pdf\",
    \"job_namespace\": \"test-namespace\",
    \"return_image\": false
  }")

echo "$SANITIZE_RESP" | python3 -m json.tool
JOB_ID=$(echo "$SANITIZE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
echo "Sanitize Job ID: $JOB_ID"

# Step 3: Analyze (only if CLEAN or EAR_LOW)
if [[ "$CLASSIFICATION" == "CLEAN" || "$CLASSIFICATION" == "EAR_LOW" ]]; then
  echo "[4] Analyzing via gateway..."
  ANALYZE_RESP=$(curl -sf -X POST "$BASE_GATEWAY/analyze" \
    -H "Content-Type: application/json" \
    -d "{
      \"sanitize_job_id\": \"$JOB_ID\",
      \"intake_id\": \"TEST-001\",
      \"analysis_type\": \"defect_summary\",
      \"caller_id\": \"test-user\",
      \"caller_role\": \"admin\",
      \"reidentify_mode\": \"none\"
    }")
  echo "$ANALYZE_RESP" | python3 -m json.tool
else
  echo "[4] Skipping gateway test — classification=$CLASSIFICATION requires local/human review"
fi

echo ""
echo "=== Smoke test complete ==="
```

---

## 12. CLAUDE.md (Project Root)

```markdown
# ndtv1 — Complete LLM Pipeline

## Project Overview
Three FastAPI microservices providing compliance classification, document
sanitization, and LLM gateway routing for an aerospace NDT facility.

This is a standalone project (NOT part of AI-OS). It has its own PostgreSQL
database, Docker Compose stack, and service boundaries.

## Services
| Service        | Port | Purpose                                    |
|----------------|------|--------------------------------------------|
| ndtv1-comply   | 8010 | ITAR/EAR compliance triage                 |
| ndtv1-sanitize | 8011 | Entity detection, tokenization, redaction  |
| ndtv1-gateway  | 8012 | LLM routing, prompt assembly, re-identify  |

## Absolute Design Constraints (Never Violate These)
1. NEVER store plaintext sensitive values in any database column, log, or file
2. NEVER route ITAR or REJECTED documents to cloud LLM providers
3. NEVER skip the second-pass scan before sending prompt to LLM
4. NEVER allow re-identification without role check + audit log entry
5. Metadata strip happens BEFORE OCR in both comply and sanitize services
6. Token vault stores only: token, entity_type, encrypted_value, value_hash

## Crypto
- TOKEN_SECRET_KEY: 32-byte hex (64 chars), generated with generate_secret_key.py
- Token generation: HMAC-SHA256(namespace:type:value) → 8 char base64url
- Vault encryption: AES-256-GCM, nonce prepended to ciphertext
- Dedup lookups: SHA-256(namespace:value) stored as value_hash

## Token Format
ENTITYTYPE__XXXXXXXX
Examples: COMPANY__A94F7K2M, DRAWING__K2D1N8QR, PARTNUM__N39PR7KL
Deterministic: same namespace + entity type + value = same token always

## LLM Routing Enforcement (gateway/gateway/router.py)
CLEAN → CLOUD_OK → Anthropic/OpenAI
EAR_LOW → CLOUD_OK → Anthropic/OpenAI (with tokenization)
EAR_HIGH → LOCAL_ONLY → Ollama (RTX 3090)
ITAR → LOCAL_ONLY → Ollama (RTX 3090)
NEEDS_REVIEW → HOLD → 403 blocked
REJECTED → HOLD → 403 blocked

## Run Order
1. cp .env.example .env && edit .env
2. python scripts/generate_secret_key.py → paste into TOKEN_SECRET_KEY
3. docker compose up postgres presidio-analyzer presidio-image-redactor -d
4. alembic upgrade head
5. python scripts/seed_keyword_db.py
6. docker compose up comply sanitize gateway -d
7. bash scripts/test_pipeline.sh

## Key File Locations
- Shared crypto utilities: shared/crypto.py
- Routing enforcement: services/gateway/gateway/router.py
- Token generation: shared/crypto.py → TokenVault.generate_token()
- Second-pass scan: services/gateway/gateway/second_pass_scanner.py
- Custom recognizers: services/sanitize/sanitizers/recognizers/
```

---

## 13. Build Execution Order for Claude Code

Execute in strict phase order. Complete each phase validation before proceeding.

```
═══════════════════════════════════════════════════════════
PHASE 1 — FOUNDATION (no service code yet)
═══════════════════════════════════════════════════════════
 1.  Create full directory structure from §1 (mkdir -p all paths)
 2.  Create .env.example with all variables from §2
 3.  Create shared/__init__.py (empty)
 4.  Create shared/db.py from §4.1
 5.  Create shared/crypto.py from §4.2
 6.  Create shared/exceptions.py from §4.3
 7.  Create shared/logging.py from §4.4
 8.  Create alembic.ini (standard alembic config)
 9.  Create migrations/env.py (standard alembic async env)
10.  Create migrations/versions/001_initial_schema.py from §3
11.  Create scripts/generate_secret_key.py from §11
12.  Create scripts/seed_keyword_db.py from §11
13.  Create scripts/test_pipeline.sh from §11
     VALIDATE: python -c "from shared.crypto import TokenVault" ✓

═══════════════════════════════════════════════════════════
PHASE 2 — COMPLY SERVICE
═══════════════════════════════════════════════════════════
14.  Create services/comply/__init__.py (empty)
15.  Create services/comply/models/__init__.py (empty)
16.  Create services/comply/models/schemas.py from §5.2
17.  Create services/comply/models/db_models.py
     (SQLAlchemy ORM models for comply_documents, keyword_library, cage_code_registry)
18.  Create services/comply/extractors/__init__.py
19.  Create services/comply/extractors/pdf_extractor.py
     (PyMuPDF: PDF → list of page numpy arrays + text blocks)
20.  Create services/comply/extractors/image_extractor.py
     (PIL/OpenCV: image → numpy array + OCR text blocks)
21.  Create services/comply/extractors/metadata_extractor.py
     (Extract and report metadata fields — do not store values)
22.  Create services/comply/classifiers/__init__.py
23.  Create services/comply/classifiers/title_block.py from §5.3
24.  Create services/comply/classifiers/keyword_scanner.py from §5.4
25.  Create services/comply/classifiers/cage_lookup.py
     (Query comply_cage_code_registry, return cage signals if is_defense=True)
26.  Create services/comply/classifiers/spec_analyzer.py
     (MIL-SPEC pattern scan, ECCN detection, DFARS reference detection)
27.  Create services/comply/classifiers/risk_scorer.py from §5.5
28.  Create services/comply/routes/__init__.py
29.  Create services/comply/routes/health.py
     (GET /health: return service name, DB ping status, timestamp)
30.  Create services/comply/routes/classify.py from §5.2 route spec
31.  Create services/comply/routes/review.py
     (GET /review: list NEEDS_REVIEW/ITAR docs; PATCH /review/{id}: apply override)
32.  Create services/comply/main.py from §5.1
33.  Create services/comply/requirements.txt from §9
34.  Create services/comply/Dockerfile from §10
     VALIDATE: python -c "from services.comply.main import app" ✓

═══════════════════════════════════════════════════════════
PHASE 3 — SANITIZE SERVICE
═══════════════════════════════════════════════════════════
35.  Create services/sanitize/__init__.py (empty)
36.  Create services/sanitize/models/__init__.py
37.  Create services/sanitize/models/schemas.py
     (SanitizeRequest, SanitizeResponse, ReidentifyRequest, ReidentifyResponse)
38.  Create services/sanitize/models/db_models.py
     (ORM for sanitize_jobs, sanitize_token_vault, sanitize_reidentify_audit)
39.  Create services/sanitize/sanitizers/__init__.py
40.  Create services/sanitize/sanitizers/recognizers/__init__.py
41.  Create all 6 recognizer files from §6.1:
     drawing_number.py, part_number.py, cage_code.py,
     contract_number.py, cert_id.py, project_code.py
42.  Create services/sanitize/sanitizers/text_sanitizer.py from §6.2
43.  Create services/sanitize/sanitizers/image_sanitizer.py from §6.3
44.  Create services/sanitize/sanitizers/metadata_sanitizer.py from §6.4
45.  Create services/sanitize/routes/__init__.py
46.  Create services/sanitize/routes/health.py
47.  Create services/sanitize/routes/sanitize.py
     (POST /sanitize: full pipeline; GET /sanitize/{job_id}: retrieve result)
48.  Create services/sanitize/routes/reidentify.py
     (POST /reidentify: role-checked vault lookup + audit log)
49.  Create services/sanitize/main.py
50.  Create services/sanitize/requirements.txt from §9
51.  Create services/sanitize/Dockerfile from §10 (port 8011)
     VALIDATE: python -c "from services.sanitize.main import app" ✓

═══════════════════════════════════════════════════════════
PHASE 4 — GATEWAY SERVICE
═══════════════════════════════════════════════════════════
52.  Create services/gateway/__init__.py (empty)
53.  Create services/gateway/models/__init__.py
54.  Create services/gateway/models/schemas.py from §7.2
55.  Create services/gateway/models/db_models.py
     (ORM for gateway_requests, gateway_reidentify_log)
56.  Create services/gateway/gateway/__init__.py
57.  Create services/gateway/gateway/router.py from §7.3
58.  Create services/gateway/gateway/providers/__init__.py
59.  Create services/gateway/gateway/providers/base.py from §7.4
60.  Create services/gateway/gateway/providers/anthropic_provider.py from §7.5
61.  Create services/gateway/gateway/providers/openai_provider.py
     (Mirror anthropic_provider.py pattern for OpenAI /v1/chat/completions)
62.  Create services/gateway/gateway/providers/ollama_provider.py from §7.6
63.  Create services/gateway/gateway/second_pass_scanner.py from §7.7
64.  Create services/gateway/gateway/prompt_builder.py from §7.8
65.  Create services/gateway/gateway/reidentifier.py from §7.9
66.  Create services/gateway/routes/__init__.py
67.  Create services/gateway/routes/health.py
68.  Create services/gateway/routes/analyze.py from §7.10
69.  Create services/gateway/routes/audit.py
     (GET /audit: query gateway_requests with filters; GET /audit/{id}: detail)
70.  Create services/gateway/main.py from §7.1
71.  Create services/gateway/requirements.txt from §9
72.  Create services/gateway/Dockerfile from §10 (port 8012)
     VALIDATE: python -c "from services.gateway.main import app" ✓

═══════════════════════════════════════════════════════════
PHASE 5 — INFRASTRUCTURE
═══════════════════════════════════════════════════════════
73.  Create docker-compose.yml from §8
74.  Create CLAUDE.md from §12
75.  Copy .env.example → .env
76.  Run: python scripts/generate_secret_key.py
     → Paste output into .env TOKEN_SECRET_KEY value
     VALIDATE: TOKEN_SECRET_KEY is exactly 64 hex chars ✓

═══════════════════════════════════════════════════════════
PHASE 6 — DATABASE + SEED
═══════════════════════════════════════════════════════════
77.  docker compose up postgres -d
78.  Wait for healthcheck: docker compose ps postgres (Status: healthy)
79.  alembic upgrade head
     VALIDATE: All 8 tables created, all 3 enum types created ✓
80.  python scripts/seed_keyword_db.py
     VALIDATE: "Seeded X keywords and Y CAGE codes" printed ✓

═══════════════════════════════════════════════════════════
PHASE 7 — SERVICES UP
═══════════════════════════════════════════════════════════
81.  docker compose up presidio-analyzer presidio-image-redactor -d
82.  docker compose up comply -d
83.  Wait for healthy: docker compose ps comply
84.  docker compose up sanitize -d
85.  Wait for healthy: docker compose ps sanitize
86.  docker compose up gateway -d
87.  Wait for healthy: docker compose ps gateway

═══════════════════════════════════════════════════════════
PHASE 8 — VALIDATION
═══════════════════════════════════════════════════════════
88.  curl http://localhost:8010/health → {"status": "ok"} ✓
89.  curl http://localhost:8011/health → {"status": "ok"} ✓
90.  curl http://localhost:8012/health → {"status": "ok"} ✓
91.  bash scripts/test_pipeline.sh
92.  Review output — all three steps should complete without errors
93.  Fix any import errors, missing __init__.py files, schema mismatches
94.  docker compose logs comply | grep ERROR (should be empty)
95.  docker compose logs sanitize | grep ERROR (should be empty)
96.  docker compose logs gateway | grep ERROR (should be empty)

═══════════════════════════════════════════════════════════
BUILD COMPLETE
═══════════════════════════════════════════════════════════
If all health checks pass and test_pipeline.sh completes cleanly,
the pipeline is ready for integration with the vector storage layer.

Next integration point: POST /sanitize response (sanitized_text + job_id)
feeds directly into the vector embedding pipeline as the clean document input.
Raw company names never enter the vector store.
```

---

## 14. API Quick Reference

### Full Pipeline Call Sequence

```
# 1. Classify
POST http://localhost:8010/classify
{
  "intake_id": "JOB-2024-001",
  "filename": "part_drawing.pdf",
  "file_content": "<base64>",
  "mime_type": "application/pdf",
  "job_namespace": "client-acme-2024"
}
→ { "doc_id": "...", "classification": "EAR_LOW", "llm_routing": "CLOUD_OK" }

# 2. Sanitize
POST http://localhost:8011/sanitize
{
  "intake_id": "JOB-2024-001",
  "comply_doc_id": "<doc_id from step 1>",
  "filename": "part_drawing.pdf",
  "file_content": "<base64>",
  "mime_type": "application/pdf",
  "job_namespace": "client-acme-2024"
}
→ { "job_id": "...", "sanitized_text": "COMPANY__A94F examined DRAWING__K2D1...", "token_count": 7 }

# 3. Analyze
POST http://localhost:8012/analyze
{
  "sanitize_job_id": "<job_id from step 2>",
  "intake_id": "JOB-2024-001",
  "analysis_type": "defect_summary",
  "caller_id": "engineer-001",
  "caller_role": "lead_engineer",
  "reidentify_mode": "full"
}
→ { "analysis": "Acme Corporation drawing DWG-LM-4471 shows...", "tokens_reidentified": 7 }
```
