"""Hard LLM routing table — non-overridable.

CLOUD_OK   → Anthropic (claude-3-5-haiku-20241022)
LOCAL_ONLY → Ollama on host RTX 3090 (llama3.3:70b)
HOLD       → Raises an error — never reaches LLM

This rule is enforced at the gateway level regardless of what upstream
services or callers request. The routing decision was made by comply service
based on ITAR/EAR classification.
"""
from __future__ import annotations

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from models import LLMRouting, Classification  # noqa: E402

# Provider → model mapping
ROUTING_TABLE: dict[LLMRouting, tuple[str, str]] = {
    LLMRouting.CLOUD_OK:   ("anthropic", "claude-haiku-4-5-20251001"),
    LLMRouting.LOCAL_ONLY: ("ollama",    "llama3.3:70b"),
}

# Classification-level override: ITAR/EAR_HIGH must always go local
_FORCE_LOCAL: set[Classification] = {
    Classification.ITAR,
    Classification.EAR_HIGH,
}


def resolve_routing(
    llm_routing: LLMRouting,
    classification: Classification,
) -> tuple[str, str]:
    """Return (provider, model) for a given routing decision.

    Raises ValueError if routing is HOLD (document requires human review).

    Safety:  If classification is ITAR/EAR_HIGH but routing was somehow
             passed as CLOUD_OK (e.g. bug in caller), this function
             OVERRIDES to LOCAL_ONLY. Belt-and-suspenders.
    """
    if llm_routing == LLMRouting.HOLD:
        raise ValueError(
            f"Document classification={classification} requires human review — "
            "no LLM call permitted"
        )

    # Belt-and-suspenders: force local for high-risk classifications
    effective_routing = llm_routing
    if classification in _FORCE_LOCAL and llm_routing == LLMRouting.CLOUD_OK:
        effective_routing = LLMRouting.LOCAL_ONLY

    provider, model = ROUTING_TABLE[effective_routing]
    return provider, model
