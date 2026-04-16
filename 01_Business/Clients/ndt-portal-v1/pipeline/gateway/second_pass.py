"""Second-pass PII scanner — runs on the assembled prompt before any LLM call.

Purpose: Catch any residual PII/CUI that was not tokenized by sanitize service
(e.g. entities appearing in the system prompt, quoted context, or field names).

If residual high-risk patterns are found in a cloud-bound request, the call
is blocked and an error is returned — the caller must route to LOCAL_ONLY.
"""
from __future__ import annotations

import re
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
from models import LLMRouting  # noqa: E402

# ── Residual ITAR/EAR patterns (highest priority) ─────────────────────────
# These should never appear in a cloud-bound prompt after sanitization
_ITAR_RESIDUAL: list[re.Pattern] = [
    re.compile(r"DISTRIBUTION\s+STATEMENT\s*[D-FX]",   re.IGNORECASE),
    re.compile(r"NOFORN",                               re.IGNORECASE),
    re.compile(r"ITAR\s+CONTROLLED",                    re.IGNORECASE),
    re.compile(r"22\s+CFR\s+12[01]",                    re.IGNORECASE),
    re.compile(r"\bCLASSIFIED\b"),  # ALL-CAPS only — "classified part/analysis" in domain text is lowercase
    re.compile(r"TOP\s+SECRET",                         re.IGNORECASE),
    re.compile(r"\bSECRET\b",                           re.IGNORECASE),
    re.compile(r"CONTROLLED\s+UNCLASSIFIED",             re.IGNORECASE),
]

# ── PII patterns (should have been tokenized) ─────────────────────────────
_PII_RESIDUAL: list[re.Pattern] = [
    re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE),  # email
    re.compile(r"\b(\+1[\s\-]?)?\(?\d{3}\)?[\s\-]\d{3}[\s\-]\d{4}\b"),         # phone
    re.compile(r"\b\d{3}-\d{2}-\d{4}\b"),                                        # SSN
]


class ResidualPIIError(Exception):
    """Raised when residual PII/CUI is detected in a cloud-bound prompt."""
    def __init__(self, matches: list[str]):
        self.matches = matches
        super().__init__(f"Residual PII/CUI detected: {matches}")


def scan_prompt(prompt: str, routing: LLMRouting) -> None:
    """Scan the assembled prompt for residual PII/CUI.

    For LOCAL_ONLY routing: only log warnings (Ollama stays on-prem anyway).
    For CLOUD_OK routing: raise ResidualPIIError if anything suspicious found.

    Args:
        prompt:  Full assembled prompt string (system + user content).
        routing: Effective LLM routing decision.

    Raises:
        ResidualPIIError: If cloud-bound prompt contains ITAR/CUI patterns.
    """
    if routing == LLMRouting.HOLD:
        return  # Already blocked upstream

    itar_hits: list[str] = []
    for pat in _ITAR_RESIDUAL:
        for m in pat.finditer(prompt):
            itar_hits.append(m.group(0))

    pii_hits: list[str] = []
    for pat in _PII_RESIDUAL:
        for m in pat.finditer(prompt):
            pii_hits.append(m.group(0)[:20] + "…")  # truncate for safety

    all_hits = itar_hits + pii_hits

    if all_hits:
        import logging
        log = logging.getLogger("gateway.second_pass")
        if routing == LLMRouting.CLOUD_OK:
            log.error("BLOCKED cloud call — residual ITAR/PII: %s", all_hits)
            raise ResidualPIIError(all_hits)
        else:
            # LOCAL_ONLY: warn but do not block (data stays on-prem)
            log.warning("Residual ITAR/PII in local-routed prompt: %s", all_hits)
