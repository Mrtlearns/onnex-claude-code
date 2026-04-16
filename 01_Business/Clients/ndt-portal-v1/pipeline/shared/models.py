"""Shared Pydantic models for comply, sanitize, and gateway services."""
from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel


class Classification(str, Enum):
    CLEAN        = "CLEAN"
    EAR_LOW      = "EAR_LOW"
    EAR_HIGH     = "EAR_HIGH"
    ITAR         = "ITAR"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    REJECTED     = "REJECTED"


class LLMRouting(str, Enum):
    CLOUD_OK   = "CLOUD_OK"
    LOCAL_ONLY = "LOCAL_ONLY"
    HOLD       = "HOLD"


# ── Comply ─────────────────────────────────────────────────────────────────

class ClassifyRequest(BaseModel):
    intake_id:   str
    filename:    str
    content_b64: str   # base64-encoded PDF or image bytes


class ClassifyResponse(BaseModel):
    doc_id:              str
    intake_id:           str
    filename:            str
    classification:      Classification
    llm_routing:         LLMRouting
    risk_score:          int
    cage_codes:          list[str]
    usml_hits:           list[dict[str, Any]]
    drawing_number:      str | None
    dist_statement:      str | None
    extracted_text:      str | None = None   # OCR or PDF text for LLM context
    rendered_image_b64:  str | None = None   # PII-scrubbed image for LLM vision
    rendered_media_type: str | None = None   # e.g. "image/png"


# ── Sanitize ───────────────────────────────────────────────────────────────

class SanitizeRequest(BaseModel):
    comply_doc_id: str | None = None
    intake_id:     str
    text:          str
    routing:       LLMRouting = LLMRouting.CLOUD_OK


class SanitizeResponse(BaseModel):
    job_id:         str
    sanitized_text: str
    entity_count:   int
    routing:        LLMRouting


class ReidentifyRequest(BaseModel):
    job_id:          str
    text:            str
    caller_role:     str
    caller_identity: str | None = None


class ReidentifyResponse(BaseModel):
    reidentified_text: str
    tokens_revealed:   list[str]


# ── Gateway ────────────────────────────────────────────────────────────────

class ImagePayload(BaseModel):
    media_type: str   # e.g. "image/png", "image/jpeg", "application/pdf"
    data_b64:   str   # base64-encoded image bytes (already redacted)


class AnalyzeRequest(BaseModel):
    intake_id:       str
    sanitize_job_id: str
    classification:  Classification
    llm_routing:     LLMRouting
    prompt:          str
    system_prompt:   str | None = None
    provider:        str | None = None   # step-level override (e.g. 'openai', 'gemini')
    model:           str | None = None   # step-level override (e.g. 'gpt-4o')
    images:          list[ImagePayload] | None = None   # optional: engineering drawing(s)


class AnalyzeResponse(BaseModel):
    request_id:    str
    provider_used: str
    model_used:    str
    response_json: dict[str, Any]
    prompt_tokens: int | None
    latency_ms:    int


class GatewayReidentifyRequest(BaseModel):
    gateway_req_id:  str
    sanitize_job_id: str
    text:            str
    caller_role:     str


class GatewayReidentifyResponse(BaseModel):
    reidentified_text: str
    tokens_revealed:   list[str]
