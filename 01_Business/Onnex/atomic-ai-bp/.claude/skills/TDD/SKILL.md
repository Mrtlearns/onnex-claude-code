# TDD Skill — Test-Driven Development

## The Iron Law

> **No production code without a failing test first. No exceptions.**

This is not a suggestion. Writing production code before a test produces code that happens
to work today rather than code that is proven to work. The difference matters.

---

## The Cycle: RED → GREEN → REFACTOR

### RED — Write a failing test
- Write one test that describes the desired behavior
- Run it — it **must fail**
- If it passes before you write production code, the test is wrong
- The failure message must be meaningful (not ImportError or SyntaxError)
- The test should describe behavior, not implementation

```python
# Good — describes behavior
def test_lead_is_rejected_when_phone_number_missing():
    result = create_lead(name="John", email="john@example.com", phone=None)
    assert result.status == "rejected"
    assert "phone" in result.error_message

# Bad — tests implementation details
def test_validate_phone_called():
    with mock.patch("app.services.validate_phone") as m:
        create_lead(name="John", email="john@example.com", phone=None)
        m.assert_called_once()
```

### GREEN — Write minimal production code
- Write the **simplest** code that makes the test pass
- No additional logic — only what's required by the test
- Ugly code is fine here — REFACTOR comes next
- Run the test — it **must pass**

### REFACTOR — Clean without breaking
- Improve naming, remove duplication, simplify structure
- No new behavior — only restructuring
- Run tests after **every** change
- Tests **must still pass** after each refactor step

---

## What to Test

### Test behavior, not implementation
A good test answers: "Does the system do what it should do?"
A bad test answers: "Does the system work the way I built it?"

| Test this | Not this |
|-----------|----------|
| Function returns the right value | Function calls the right internal methods |
| API returns 422 with missing field | Validator function is called |
| DB record is created with correct fields | Repository.save() is called |

### Test levels

**Unit tests** — single function, no external dependencies:
```python
def test_calculate_settlement_with_liability_reduction():
    result = calculate_settlement(base=100_000, liability_pct=0.25)
    assert result == 75_000
```

**Integration tests** — real DB, real dependencies (no mocks):
```python
def test_lead_creation_persists_to_database(test_db):
    lead = create_lead(db=test_db, name="John", phone="702-555-1234")
    stored = test_db.query(Lead).filter_by(id=lead.id).first()
    assert stored.name == "John"
```

**E2E tests** — full user journey:
```python
def test_intake_form_submits_and_creates_lead(page: Page):
    page.goto("/intake")
    page.fill("[name='phone']", "702-555-1234")
    page.click("button[type='submit']")
    expect(page.locator(".confirmation")).to_be_visible()
```

---

## Common Anti-Patterns to Avoid

**Testing after writing code** — You can't get RED feedback, so you don't know if your test
actually catches the bug.

**Writing all tests before any production code** — You lose the RED-GREEN feedback loop.
Test one behavior, implement it, then test the next.

**Mocking everything** — Mocks hide integration bugs. Use real dependencies in integration
tests. Mock only external systems you don't control (third-party APIs, email services).

**Overly broad assertions** — `assert result is not None` tells you nothing useful.
Assert the specific expected value.

**Tests that never fail** — Delete the production code you just wrote. If the test still
passes, it's not testing anything.

---

## Test File Conventions

```
tests/
  unit/
    test_<module>.py          # Fast, no I/O
  integration/
    test_<feature>.py         # Real DB, real services
  e2e/
    test_<user_journey>.py    # Playwright, full stack
```

Run fast tests frequently, slow tests before commit:
```bash
pytest tests/unit/ -v             # During development
pytest tests/ -v --tb=short       # Before committing
npx playwright test               # Before merging
```

---

## Project-Specific Notes

- Use `pytest` for Python, `jest` for Node
- Integration tests connect to a test schema (not production)
- Playwright tests run against the local Docker stack
- Test DB is seeded via fixtures — never share state between tests
