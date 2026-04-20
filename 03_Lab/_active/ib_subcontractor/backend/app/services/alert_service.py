from datetime import date

from app.services.ocr_service import parse_expiry_date


def extract_expiry_date(text: str) -> date | None:
    return parse_expiry_date(text)
