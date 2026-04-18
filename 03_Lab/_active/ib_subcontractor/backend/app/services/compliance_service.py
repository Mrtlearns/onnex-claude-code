def get_risk_level(score: int, expiring_soon: bool, has_expired: bool) -> str:
    if score >= 80 and not expiring_soon and not has_expired:
        return "green"
    if has_expired or score < 60:
        return "red"
    return "yellow"
