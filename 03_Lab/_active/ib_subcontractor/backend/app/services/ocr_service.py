import re
from datetime import date


KEYWORDS = ("expires", "expiration", "valid through", "valid thru")
NUMERIC_PATTERNS = (
    r"(?P<month>\d{1,2})/(?P<day>\d{1,2})/(?P<year>\d{4})",
    r"(?P<month>\d{1,2})-(?P<day>\d{1,2})-(?P<year>\d{4})",
)
WRITTEN_PATTERN = (
    r"(?P<month_name>January|February|March|April|May|June|July|August|September|"
    r"October|November|December)\s+(?P<day>\d{1,2})(?:,)?\s+(?P<year>\d{4})"
)
MONTHS = {
    "january": 1,
    "february": 2,
    "march": 3,
    "april": 4,
    "may": 5,
    "june": 6,
    "july": 7,
    "august": 8,
    "september": 9,
    "october": 10,
    "november": 11,
    "december": 12,
}


def _build_date_from_match(match: re.Match[str]) -> date | None:
    groups = match.groupdict()
    try:
        if "month_name" in groups and groups["month_name"]:
            month = MONTHS[groups["month_name"].lower()]
        else:
            month = int(groups["month"])
        return date(int(groups["year"]), month, int(groups["day"]))
    except (KeyError, ValueError):
        return None


def parse_expiry_date(text: str) -> date | None:
    haystack = text or ""
    lowered = haystack.lower()
    if not any(keyword in lowered for keyword in KEYWORDS):
        return None

    for pattern in (*NUMERIC_PATTERNS, WRITTEN_PATTERN):
        match = re.search(pattern, haystack, flags=re.IGNORECASE)
        if match:
            parsed = _build_date_from_match(match)
            if parsed:
                return parsed
    return None
