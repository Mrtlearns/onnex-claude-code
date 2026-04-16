# Onnex n8n Skill

Onnex delivers n8n-based automation as a core component of every AI-OS deployment. Always apply these standards when building or reviewing n8n workflows for Onnex clients.

---

## Stack Context

- n8n is self-hosted at `https://n8n.botonomy.xyz` (Onnex internal) and deployed per-client in Docker
- PostgreSQL is the n8n database backend (not SQLite)
- Credentials are stored in n8n credential store — never hardcoded in workflow JSON
- All client workflows live in their own n8n instance or project namespace
- n8n version: track latest stable — avoid deprecated node types

---

## Workflow Architecture Patterns

### Trigger Conventions
- **Webhooks**: Use `POST` by default. Always validate payload with an `IF` node before processing.
- **Schedules**: Use Cron trigger. Document the schedule in the workflow Notes field.
- **Manual**: Add a Manual Trigger for all workflows to enable test runs without waiting for events.
- **Event-driven**: Prefer webhook + queue pattern over polling for real-time requirements.

### Node Naming Standards
- Use descriptive names: `Validate Lead Data` not `IF1`
- Prefix by function: `HTTP: Fetch Case`, `DB: Insert Contact`, `Email: Send Welcome`
- Error handler nodes: prefix with `ERR: `

### Sub-workflow Pattern
Use sub-workflows (Execute Workflow node) when:
- Logic is reused across 2+ workflows
- A workflow exceeds ~20 nodes
- A distinct business function can be isolated (e.g., "Qualify Lead", "Send Notification")

Keep sub-workflows single-purpose. Pass data via `workflowInputData`, return via last node output.

### Error Handling
- Every production workflow must have an error workflow set in Settings
- Error workflows should: log to PostgreSQL, send alert to Slack/email, include workflow name + execution ID
- Use `Try/Catch` nodes (Error Trigger pattern) for granular error handling within a workflow
- Never let a workflow fail silently

### Data Passing
- Prefer passing minimal data between nodes — don't carry entire payloads through the chain
- Use `Set` node to explicitly shape data before passing to downstream nodes
- For large payloads, store in PostgreSQL/MinIO and pass the reference ID

---

## Onnex Vertical Patterns

### PI Law Firms
- Speed-to-lead: webhook → validate → CRM lookup → route → Twilio SMS/call within 60s
- Intake: form submission → Presidio PII check → case creation → retainer trigger
- Missed call: Twilio webhook → check business hours → SMS callback sequence

### NDT
- Document ingestion: file upload → ITAR classification → Presidio sanitize → LLM analysis → report generation
- Compliance: scheduled audit → pull records → generate compliance report → email distribution list

### MSPs
- Ticket triage: PSA webhook → classify priority → assign → notify → SLA timer start
- Client onboarding: form → provision accounts → send credentials → schedule onboarding call

### Medical
- Appointment: booking webhook → eligibility check → confirmation → reminder sequence
- HIPAA note: all PHI must stay within client's own n8n instance, never route through shared infrastructure

---

## Credential Standards

| Service | Credential Type | Naming Convention |
|---------|----------------|-------------------|
| PostgreSQL | PostgreSQL | `postgres-[client]-[env]` |
| Twilio | Twilio | `twilio-[client]` |
| OpenAI/Anthropic | HTTP Header Auth | `anthropic-api` / `openai-api` |
| SMTP | SMTP | `smtp-[client]` |
| Slack | Slack OAuth | `slack-[client]` |
| Generic HTTP | HTTP Header Auth | `http-[service]-[client]` |

---

## Performance & Reliability

- Set execution timeout per workflow based on expected runtime — don't use default
- For long-running workflows (>30s), use async pattern: webhook responds immediately, processing continues
- Enable `Save successful executions` only for debug — disable in production to manage DB size
- For high-volume webhooks (>100/min), add queue middleware or use n8n queue mode

---

## What to Avoid

- Do not use the Function node for business logic that belongs in a service — keep n8n as orchestrator
- Do not store secrets in workflow JSON, environment variables in nodes, or Notes fields
- Do not build monolithic workflows — split at logical boundaries
- Do not use Community nodes in client deployments without vetting
