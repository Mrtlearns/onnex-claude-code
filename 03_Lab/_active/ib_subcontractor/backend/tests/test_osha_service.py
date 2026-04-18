from app.services.osha_service import calculate_compliance_score


def test_perfect_score_is_100():
    assert calculate_compliance_score([]) == 100


def test_willful_violation_is_70():
    assert calculate_compliance_score([{"citation_type": "willful"}]) == 70


def test_serious_violation_is_85():
    assert calculate_compliance_score([{"citation_type": "serious"}]) == 85


def test_multiple_violations_reduce_to_35():
    violations = [
        {"citation_type": "willful"},
        {"citation_type": "serious"},
        {"citation_type": "repeat"},
    ]
    assert calculate_compliance_score(violations) == 35


def test_score_floor_is_zero():
    violations = [{"citation_type": "willful"} for _ in range(5)]
    assert calculate_compliance_score(violations) == 0
