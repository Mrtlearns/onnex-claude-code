"""AI-Sentinel SDK - Python client for the AI-Sentinel security sidecar."""

from .client import SentinelClient, AsyncSentinelClient
from .models import (
    CheckRequest, CheckResponse, CheckStatus,
    Direction, CallerContext, CallerType,
    RejectDetail, Severity,
)
from .session import SessionContext
from .policy import PolicyBuilder

__version__ = "1.0.0"
__all__ = [
    "SentinelClient",
    "AsyncSentinelClient",
    "CheckRequest",
    "CheckResponse",
    "CheckStatus",
    "Direction",
    "CallerContext",
    "CallerType",
    "RejectDetail",
    "Severity",
    "SessionContext",
    "PolicyBuilder",
]
