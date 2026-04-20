from app.services.compliance_service import get_risk_level


def test_green_risk_level():
    assert get_risk_level(90, False, False) == "green"


def test_yellow_risk_level_for_score():
    assert get_risk_level(70, False, False) == "yellow"


def test_yellow_risk_level_for_expiring():
    assert get_risk_level(90, True, False) == "yellow"


def test_red_risk_level_for_low_score():
    assert get_risk_level(50, False, False) == "red"


def test_red_risk_level_for_expired():
    assert get_risk_level(90, False, True) == "red"
