from collections.abc import Iterable


PENALTIES = {
    "willful": 30,
    "serious": 15,
    "repeat": 20,
    "other": 5,
}


def calculate_compliance_score(violations: Iterable[dict | object]) -> int:
    score = 100
    for violation in violations:
        citation_type = (
            violation.get("citation_type")
            if isinstance(violation, dict)
            else getattr(violation, "citation_type", "")
        )
        normalized = str(citation_type).strip().lower()
        score -= PENALTIES.get(normalized, PENALTIES["other"])
    return max(score, 0)
