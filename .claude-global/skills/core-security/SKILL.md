# Onnex Security Skill

Mr. T is a Cybersecurity Expert. Apply these standards on all Onnex client deliverables, infrastructure work, and code reviews.

---

## Baseline Security Posture

Onnex delivers to SME clients who typically lack dedicated security teams. Every deliverable should be secure by default — clients won't harden what Onnex doesn't harden at delivery.

**Non-negotiables on every project:**
- No hardcoded secrets, credentials, or API keys in code or config files
- All secrets via environment variables or a secrets manager
- No `SELECT *` on sensitive tables without field-level justification
- Authentication on every exposed endpoint — no unauthenticated routes in production
- HTTPS only — no HTTP in production environments
- Principle of least privilege on all service accounts and API keys

---

## Credential & Secrets Management

```
# Always
SECRET=env_var_or_vault

# Never
API_KEY = "sk-abc123..."  # hardcoded
password = "Poll0000"     # in code
```

- **Docker**: Use Docker secrets or `.env` files excluded from git (`.gitignore`)
- **n8n**: Credentials stored in n8n credential store only — never in workflow JSON
- **PostgreSQL**: Dedicated service account per application, no shared `postgres` superuser
- **Traefik**: Basic Auth or Authentik forward auth on all non-public services
- **GitLab**: Rotate tokens quarterly, use project-scoped tokens not personal tokens

---

## Vertical-Specific Compliance

### NDT / Aerospace (ITAR)
- ITAR-controlled technical data cannot leave US jurisdiction
- All AI processing of ITAR documents: Ollama on-prem only — no Anthropic/OpenAI API calls
- Presidio PII + custom NDT entity recognizers for document sanitization before any external routing
- ndtv1 pipeline: comply → sanitize → gateway (on-prem Ollama for controlled, API fallback for uncontrolled only)
- No ITAR data in cloud storage without ITAR-compliant provider

### Medical (HIPAA)
- PHI must stay within client's own infrastructure — no shared/multi-tenant processing
- Business Associate Agreement (BAA) required before any PHI handling
- Minimum necessary principle: only process PHI fields required for the specific function
- Audit logging mandatory: who accessed what PHI, when
- n8n: client's own isolated instance for any PHI workflows

### PI Law Firms
- Client PII (SSN, DOB, injury details) — treat as sensitive, apply same care as PHI
- Attorney-client privilege: case notes and communications must not be logged to external systems
- Nevada bar compliance: data residency considerations for Las Vegas clients expanding to CA

### MSPs
- MSP has access to client infrastructure — Onnex system must not create new attack surface
- Credential isolation: MSP credentials to client systems must not be accessible cross-client
- MFA mandatory on MSP admin access to Onnex-delivered systems

---

## Infrastructure Security (Homelab / Client Deployments)

### Proxmox
- Management interface not exposed to internet — Tailscale only
- VM isolation: separate VLANs for management, client workloads, untrusted
- Backup encryption enabled — Proxmox Backup Server with encryption key

### Docker
- No privileged containers unless absolutely required — document why
- Read-only filesystem where possible
- User namespacing: don't run as root inside container
- Network isolation: containers on dedicated bridge networks, not default bridge
- Image scanning: check for CVEs before deploying to production

### Traefik
- TLS termination at Traefik — internal services can be HTTP
- Wildcard SSL via Cloudflare DNS challenge (`dns-cloudflare` resolver)
- Rate limiting on public-facing endpoints
- Access logs enabled — forward to centralized logging

### Authentik
- SSO for all internal services — no per-service username/password where avoidable
- MFA enforced for admin-level access
- Session timeout: 8h for standard users, 2h for admin roles
- Audit logs retained minimum 90 days

---

## Code Security Patterns

### SQL / Database
```python
# Always parameterized queries
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# Never string concatenation
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")  # SQL injection
```

### API Endpoints
- Validate and sanitize all input — never trust client data
- Return generic error messages to clients, log detailed errors server-side
- Rate limit all public endpoints
- JWT: short expiry (15min access, 7d refresh), validate signature and expiry

### File Handling
- Validate file type by content (magic bytes), not extension
- Scan uploaded files before processing
- Store outside web root
- Generate random filename on server — never use client-provided filename

---

## Threat Modeling Priorities by Vertical

| Vertical | Top Threats | Key Controls |
|----------|------------|--------------|
| NDT/Aerospace | Data exfiltration, ITAR violation | On-prem LLM, Presidio, air-gap option |
| Medical | PHI breach, HIPAA violation | Isolated infra, BAA, audit logs |
| PI Law | Client data leak, privilege breach | Isolated storage, no external logging |
| MSP | Cross-client data bleed, admin abuse | Credential isolation, RBAC, audit trail |

---

## Security Review Checklist (Pre-Delivery)

- [ ] No secrets in codebase (`git grep` for common patterns)
- [ ] All endpoints authenticated
- [ ] Input validation on all user-controlled data
- [ ] SQL parameterized queries only
- [ ] Error messages don't leak internals
- [ ] HTTPS enforced
- [ ] Dependencies checked for known CVEs
- [ ] Least privilege on all service accounts
- [ ] Logging enabled and not logging sensitive data
- [ ] `.env` and secrets files in `.gitignore`
