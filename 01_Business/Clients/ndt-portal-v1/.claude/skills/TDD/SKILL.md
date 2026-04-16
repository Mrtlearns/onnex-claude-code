# TDD Skill — Test-Driven Development

## The Iron Law

> **No production code without a failing test first. No exceptions.**

Writing production code before a test produces code that happens to work today
rather than code that is proven to work. The difference matters.

---

## The Cycle: RED → GREEN → REFACTOR

### RED — Write a failing test
- Write one test that describes the desired behavior
- Run it — it **must fail**
- If it passes before you write production code, the test is wrong
- The test should describe behavior, not implementation

```python
# Good — describes behavior
def test_itar_controlled_document_routes_to_ollama():
    doc = Document(content="USML Category XV spacecraft data", is_controlled=True)
    result = pipeline.process(doc)
    assert result.llm_provider == "ollama"
    assert result.cloud_api_called is False

# Bad — tests implementation details
def test_ollama_client_called():
    with mock.patch("app.services.ollama_client") as m:
        pipeline.process(controlled_doc)
        m.generate.assert_called_once()
```

### GREEN — Write minimal production code
- Write the **simplest** code that makes the test pass
- No additional logic — only what's required by the test
- Run the test — it **must pass**

### REFACTOR — Clean without breaking
- Improve naming, remove duplication, simplify structure
- No new behavior — only restructuring
- Run tests after **every** change
- Tests **must still pass**

---

## What to Test

### Test levels for NDT Portal v1

**Unit tests** — single function, no external dependencies:
```python
def test_usml_category_detection_matches_multiline():
    text = "This part falls under\nUSML Category XV"
    assert classifier.contains_usml_reference(text) is True
```

**Integration tests** — real DB, real services (no mocks):
```python
def test_document_classification_persists_to_database(test_db):
    doc = create_document(db=test_db, content="Export-controlled data")
    result = comply_service.classify(doc)
    stored = test_db.query(Classification).filter_by(doc_id=doc.id).first()
    assert stored.is_controlled == True
```

**Pipeline tests** — end-to-end through service chain:
```python
def test_controlled_document_never_reaches_cloud_api(mock_anthropic, mock_ollama):
    doc = Document(content=USML_SAMPLE_CONTENT)
    pipeline.process(doc)
    mock_anthropic.messages.create.assert_not_called()
    mock_ollama.generate.assert_called_once()
```

---

## Common Anti-Patterns to Avoid

**Testing after writing code** — No RED feedback, can't know if test catches the bug.

**Mocking everything** — Mocks hide the integration bugs that matter most in a pipeline architecture.

**Over-broad assertions** — `assert result is not None` tells you nothing.
Assert `assert result.llm_provider == "ollama"` — the specific expected outcome.

**Tests that never fail** — Delete the production code. If test still passes, it's not testing anything.

---

## Test File Conventions

```
tests/
  unit/
    test_comply.py          # Classifier, sanitizer logic
    test_gateway.py         # Routing logic
  integration/
    test_pipeline.py        # Full service chain
    test_itar_routing.py    # ITAR compliance routing
  e2e/
    test_quote_workflow.py  # n8n → pipeline → response
```

```bash
pytest tests/unit/ -v              # During development (fast)
pytest tests/ -v --tb=short        # Before committing
pytest tests/integration/ -v       # Before deploying
```

---

## Project-Specific Notes

- Use `pytest` for Python services, `jest` for Next.js
- Integration tests connect to test schema, never production
- ITAR routing tests are mandatory — they must pass before any deployment
- Never mock ndtv1-comply in ITAR routing tests — test the real classification logic
