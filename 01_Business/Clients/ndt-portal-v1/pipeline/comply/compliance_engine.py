"""Compliance risk scoring engine.

Aggregates keyword hits + title block data into a final Classification
and LLMRouting decision.

Thresholds:
  score >= 25 → ITAR       → LOCAL_ONLY
  score >= 15 → NEEDS_REVIEW → HOLD
  score >= 10 → EAR_HIGH   → LOCAL_ONLY
  score >= 5  → EAR_LOW    → CLOUD_OK
  score <  5  → CLEAN      → CLOUD_OK

Distribution statement letter overrides everything (see title_block.DIST_ROUTING).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from keyword_scanner import KeywordHit
from title_block import TitleBlockData, DIST_ROUTING

try:
    from shared.models import Classification, LLMRouting
except ImportError:
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "shared"))
    from models import Classification, LLMRouting  # type: ignore


@dataclass
class ComplianceResult:
    classification: Classification
    llm_routing:    LLMRouting
    risk_score:     int
    cage_codes:     list[str]
    usml_hits:      list[dict[str, Any]]
    drawing_number: str | None
    dist_statement: str | None


def score(
    hits: list[KeywordHit],
    title_block: TitleBlockData,
    db_cage_codes: set[str] | None = None,
) -> ComplianceResult:
    """Compute the compliance result from keyword hits + title block data.

    Args:
        hits:          List of keyword scanner hits.
        title_block:   Extracted title block data.
        db_cage_codes: Set of known defense-contractor CAGE codes from DB.

    Returns:
        ComplianceResult with final classification and routing.
    """
    risk_score = 0
    usml_hits: list[dict[str, Any]] = []

    # Aggregate keyword hit weights (cap each unique pattern at 1x to avoid
    # false inflation from multiple occurrences of the same keyword)
    seen_patterns: set[str] = set()
    for hit in hits:
        if hit.pattern not in seen_patterns:
            seen_patterns.add(hit.pattern)
            risk_score += hit.weight
            if hit.category in ("ITAR", "USML"):
                usml_hits.append({
                    "pattern":  hit.pattern,
                    "match":    hit.match,
                    "category": hit.category,
                    "weight":   hit.weight,
                })

    # Defense contractor CAGE code bonus
    cage_codes = title_block.cage_codes[:]
    if db_cage_codes and cage_codes:
        defense_cages = set(cage_codes) & db_cage_codes
        if defense_cages:
            risk_score += len(defense_cages) * 5  # +5 per defense contractor

    # ── Distribution statement override ───────────────────────────────────
    dist_letter  = title_block.dist_letter
    dist_routing = DIST_ROUTING.get(dist_letter or "", None) if dist_letter else None

    # REJECTED: Statement D/E/F/X + explicit distribution restriction
    if dist_letter in ("D", "E", "F", "X"):
        return ComplianceResult(
            classification=Classification.REJECTED,
            llm_routing=LLMRouting.HOLD,
            risk_score=risk_score,
            cage_codes=cage_codes,
            usml_hits=usml_hits,
            drawing_number=title_block.drawing_number,
            dist_statement=title_block.dist_statement,
        )

    # Dist C → at minimum LOCAL_ONLY
    if dist_letter == "C":
        risk_score = max(risk_score, 10)  # Ensure at least EAR_HIGH

    # ── Numeric threshold classification ──────────────────────────────────
    if risk_score >= 25:
        classification = Classification.ITAR
        routing        = LLMRouting.LOCAL_ONLY
    elif risk_score >= 15:
        classification = Classification.NEEDS_REVIEW
        routing        = LLMRouting.HOLD
    elif risk_score >= 10:
        classification = Classification.EAR_HIGH
        routing        = LLMRouting.LOCAL_ONLY
    elif risk_score >= 5:
        classification = Classification.EAR_LOW
        routing        = LLMRouting.CLOUD_OK
    else:
        classification = Classification.CLEAN
        routing        = LLMRouting.CLOUD_OK

    # Distribution statement C → always LOCAL_ONLY regardless of numeric score
    if dist_routing == "LOCAL_ONLY" and routing == LLMRouting.CLOUD_OK:
        routing = LLMRouting.LOCAL_ONLY

    return ComplianceResult(
        classification=classification,
        llm_routing=routing,
        risk_score=risk_score,
        cage_codes=cage_codes,
        usml_hits=usml_hits,
        drawing_number=title_block.drawing_number,
        dist_statement=title_block.dist_statement,
    )
