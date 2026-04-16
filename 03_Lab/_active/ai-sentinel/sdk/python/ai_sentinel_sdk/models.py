"""Pydantic models matching the AI-Sentinel API schema."""

from __future__ import annotations
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


class Direction(str, Enum):
    Ingress = "ingress"
    Egress = "egress"


class CallerType(str, Enum):
    n8n = "n8n"
    temporal = "temporal"
    sdk = "sdk"
    unknown = "unknown"


class Severity(str, Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class CheckStatus(str, Enum):
    Pass = "pass"
    Reject = "reject"


class CallerContext(BaseModel):
    caller_id: str
    caller_type: CallerType = CallerType.sdk
    cost_usd: Optional[float] = None
    model: Optional[str] = None
    tenant_id: Optional[str] = None


class CheckRequest(BaseModel):
    direction: Direction
    payload: Any
    session_id: Optional[str] = None
    caller_context: CallerContext
    tool_manifest: Optional[dict] = None
    config_override: Optional[dict] = None


class RejectDetail(BaseModel):
    layer: str
    code: str
    reason: str
    severity: Severity


class CheckResponse(BaseModel):
    status: CheckStatus
    reject: Optional[RejectDetail] = None
    payload: Optional[Any] = None
    layers_ran: list[str] = Field(default_factory=list)
    latency_ms: int = 0
    request_id: Optional[str] = None
