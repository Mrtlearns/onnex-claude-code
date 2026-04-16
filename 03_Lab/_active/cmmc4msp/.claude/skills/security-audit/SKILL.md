# Security Audit Skill

## Scope

This skill covers security auditing for Mr. T's stack:
- Python APIs (FastAPI/Flask)
- Next.js frontends
- n8n workflows
- Supabase (Postgres + pgvector, RLS, storage)
- Docker / Docker Compose
- Proxmox homelab infrastructure

Use the `security-officer` agent to execute a full audit.

---

## OWASP Top 10 — Quick Reference

### A01: Broken Access Control
**Check:**
- Every API endpoint has auth middleware applied
- Row Level Security (RLS) enabled on all Supabase tables
- Supabase service role key is never sent to the client
- User can only access their own data (no IDOR: `GET /leads/123` returns 403 for wrong user)

```python
# Bad — no auth check
@app.get("/leads/{lead_id}")
async def get_lead(lead_id: int, db: Session = Depends(get_db)):
    return db.query(Lead).filter_by(id=lead_id).first()

# Good — auth required
@app.get("/leads/{lead_id}")
async def get_lead(lead_id: int, current_user = Depends(get_current_user), db: Session = Depends(get_db)):
    lead = db.query(Lead).filter_by(id=lead_id, user_id=current_user.id).first()
    if not lead:
        raise HTTPException(403)
    return lead
```

### A02: Cryptographic Failures
**Check:**
- Passwords hashed with bcrypt or argon2 (not MD5/SHA1)
- Sensitive data encrypted at rest (Supabase encrypts by default)
- HTTPS enforced (Traefik with wildcard cert handles this)
- JWT secrets are strong (not "secret" or "password")
- No sensitive data in JWT payload that shouldn't be there

### A03: Injection
**Check — SQL:**
```python
# Bad — SQL injection
query = f"SELECT * FROM leads WHERE phone = '{user_input}'"

# Good — parameterized
db.execute(text("SELECT * FROM leads WHERE phone = :phone"), {"phone": user_input})
# or ORM
db.query(Lead).filter_by(phone=user_input).first()
```

**Check — Command injection:**
```python
# Bad
subprocess.run(f"convert {user_file} output.pdf", shell=True)

# Good
subprocess.run(["convert", user_file, "output.pdf"])
```

### A04: Insecure Design
- Is there a threat model for new features?
- Are rate limits in place on public endpoints?
- Are there brute-force protections on auth endpoints?

### A05: Security Misconfiguration
**Check:**
- No default credentials (Supabase, n8n, Docker containers)
- Debug mode / verbose error output disabled in production
- CORS configured to specific origins (not `*`)
- Docker containers not running as root unless required
- Ports not exposed externally unless required

```yaml
# Bad — running as root, exposing all ports
services:
  api:
    image: myapi
    ports:
      - "0.0.0.0:8000:8000"

# Good — non-root, internal only
services:
  api:
    image: myapi
    user: "1000:1000"
    expose:
      - "8000"
```

### A07: Authentication Failures
**Check:**
- JWT signature verified (not just decoded)
- JWT expiry checked
- Refresh token rotation implemented (invalidate old token on use)
- Session tokens invalidated on logout

```python
# Bad — only decodes, doesn't verify
payload = jwt.decode(token, options={"verify_signature": False})

# Good — full verification
payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
```

### A09: Security Logging Failures
**Check:**
- Failed auth attempts are logged
- Admin actions are logged
- Sensitive data (passwords, tokens, PII) is NOT in logs

```python
# Bad — logs password
logger.info(f"Login attempt: user={email}, password={password}")

# Good
logger.info(f"Login attempt: user={email}, success={success}")
```

---

## Stack-Specific Checks

### Supabase
```sql
-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'poc_myapp';

-- All tables should have rowsecurity = true
```

- `SUPABASE_SERVICE_ROLE_KEY` must never reach client-side code
- `SUPABASE_ANON_KEY` is safe for client — it's restricted by RLS
- Storage bucket policies: are buckets public when they shouldn't be?

### n8n Workflows
- Webhook nodes: are triggers authenticated? (Header Auth or Basic Auth node)
- Credentials: all API keys stored in n8n Credentials store, not in node parameters
- Workflow triggers: are "Test webhook" URLs disabled in production?

### Docker Compose
```bash
# Check for privileged containers
grep -r "privileged: true" .

# Check for root user
docker inspect <container> | grep '"User"'
# Empty = running as root

# Check what ports are externally exposed
docker ps --format "{{.Names}}: {{.Ports}}"
```

### Python Environment
```bash
# Check for known vulnerable packages
pip install safety
safety check -r requirements.txt

# Grep for common secrets patterns
grep -r "password\s*=\s*['\"]" --include="*.py" .
grep -r "api_key\s*=\s*['\"]" --include="*.py" .
grep -rn "SECRET\|PASSWORD\|TOKEN\|KEY" --include="*.env" .
```

---

## Risk Rating

| Level | Criteria | Response Time |
|-------|----------|---------------|
| CRITICAL | RCE, auth bypass, mass data exfiltration | Fix before next deploy |
| HIGH | User data exposure, privilege escalation | Fix in current sprint |
| MEDIUM | Requires specific conditions to exploit | Fix in next sprint |
| LOW | Defense-in-depth, low direct impact | Fix when convenient |
| INFO | Observation, not a vulnerability | Track/consider |
