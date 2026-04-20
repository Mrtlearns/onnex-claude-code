from datetime import date

from app.services.alert_service import extract_expiry_date


def test_parse_expiry_date_slash_format():
    assert extract_expiry_date("Certificate expires 12/31/2025.") == date(2025, 12, 31)


def test_parse_expiry_date_dash_format():
    assert extract_expiry_date("Expiration: 06-15-2026 for this policy.") == date(2026, 6, 15)


def test_parse_expiry_date_written_month():
    assert extract_expiry_date("Valid through December 31 2025 for enrolled vendor.") == date(2025, 12, 31)


def test_parse_expiry_date_missing_returns_none():
    assert extract_expiry_date("No active expiration marker is shown here.") is None
