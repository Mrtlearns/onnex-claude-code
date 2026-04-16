# Security Audit Skill

## Scope

This skill covers security auditing for the NDT Portal v1 stack:
- Python FastAPI services (ndtv1-comply, ndtv1-sanitize, ndtv1-gateway)
- Next.js 14 frontend
- n8n workflows
- PostgreSQL/pgvector + Hasura
- Docker Compose
- ITAR/EAR compliance controls

Use the `security-officer` agent to execute a full audit.

---

## ITAR Compliance Checks (Project-Critical)

This is the highest-priority security concern for NDT Portal v1.

### Data Routing Verification
```python
# MUST: Every LLM call must be preceded by classification
classification = await comply_service.classify(document_id)

if classification.itar_controlled or classification.ear_controlled:
    # MUST use on-prem Ollama
    response = await ollama_client.generate(
        model="llama3",
        content=sanitized_content
    )
else:
    # Safe to use cloud LLM
    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        content=content
    )
```

### Audit Trail Requirements
- Every document processed must have a tamper-evident log entry
- SHA-256 hash of original document must be stored before any processing
- Classification result must be logged with timestamp and operator ID
- All Ollama calls for controlled content must be logged on-prem

### Sanitization Verification
```python
# Verify ndtv1-sanitize removes controlled data before cloud routing
sanitized = await sanitize_service.sanitize(document)
assert sanitized.controlled_fields_removed
assert sanitized.pii_removed
```

---

## OWASP Top 10 — Quick Reference

### A01: Broken Access Control
```python
# Bad — no auth check
@app.get("/documents/{doc_id}")
async def get_document(doc_id: int, db: Session = Depends(get_db)):
    return db.query(Document).filter_by(id=doc_id).first()

# Good — auth required + ownership check
@app.get("/documents/{doc_id}")
async def get_document(doc_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    doc = db.query(Document).filter_by(id=doc_id, org_id=current_user.org_id).first()
    if not doc:
        raise HTTPException(403)
    return doc
```

### A03: Injection
```python
# Bad
query = f"SELECT * FROM documents WHERE part_number = '{user_input}'"

# Good
db.execute(text("SELECT * FROM documents WHERE part_number = :pn"), {"pn": user_input})
```

### A05: Security Misconfiguration
```yaml
# Bad — root user, external port exposure
services:
  api:
    image: ndtv1-gateway
    ports:
      - "0.0.0.0:8000:8000"

# Good — non-root, internal only
services:
  api:
    image: ndtv1-gateway
    user: "1000:1000"
    expose:
      - "8000"
```

---

## Stack-Specific Checks

### Hasura
- Admin secret not exposed to frontend
- Row-level permissions configured per table
- Introspection disabled in production

### PostgreSQL
```sql
-- Verify RLS on sensitive tables
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'ndtv1';
```

### Docker Compose
```bash
# Check for privileged containers
grep -r "privileged: true" docker-compose*.yml

# Check what ports are externally exposed
docker ps --format "{{.Names}}: {{.Ports}}"
```

### Python FastAPI
```bash
# Check for hardcoded secrets
grep -r "api_key\s*=\s*['\"]" --include="*.py" .
grep -r "password\s*=\s*['\"]" --include="*.py" .
```

---

## Risk Rating

| Level | Criteria | Response Time |
|-------|----------|---------------|
| CRITICAL | ITAR violation, RCE, auth bypass, mass data exfiltration | Fix before next deploy |
| HIGH | User data exposure, privilege escalation | Fix in current sprint |
| MEDIUM | Requires specific conditions to exploit | Fix in next sprint |
| LOW | Defense-in-depth | Fix when convenient |
| INFO | Observation | Track/consider |
