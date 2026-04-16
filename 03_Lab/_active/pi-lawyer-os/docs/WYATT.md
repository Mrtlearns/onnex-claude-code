# Wyatt — AI Operations Assistant

Wyatt is the firm's AI operations assistant, built on [OpenClaw](https://github.com/openclaw/openclaw) and routed through OpenRouter. It has direct read/write access to the firm's PostgREST database via MCP tools.

## Architecture

```
User browser → /ai-agent (React SPA) → Traefik → /openclaw/ (port 47823)
                                                         │
                                              OpenClaw gateway
                                                         │
                                              OpenRouter API (LLM)
                                                         │
                                       postgrest-mcp.js (PostgREST tool server)
                                                         │
                                              /api (PostgREST) → PostgreSQL
```

- **Gateway:** OpenClaw runs in `openclaw` container, exposed at `/openclaw/` via Traefik strip-prefix middleware
- **LLM routing:** All model calls go through OpenRouter (`openrouter/auto` by default)
- **MCP tool server:** `tools/postgrest-mcp.js` runs as a sidecar inside the openclaw container, registered in `openclaw.json`

## Persona Files

Located in `openclaw/workspace/` — bind-mounted so changes take effect without container restart:

| File | Purpose |
|------|---------|
| `SOUL.md` | Core personality and operating principles |
| `IDENTITY.md` | Role definition: "Wyatt — PI Firm Operations AI" |
| `USER.md` | Firm context, user preferences, objection library reference |

## Database Tools (MCP)

Wyatt can query and write to all PostgREST-exposed tables using natural language. Available tool operations:

- `query_records` — GET with filters (cases, leads, clients, partners, etc.)
- `create_record` — POST new records
- `update_record` — PATCH existing records
- `delete_record` — DELETE records (requires confirmation)
- `run_sql` — Execute raw SQL via the `/rpc` endpoint (read-only views)
- `search_documents` — Semantic search across document chunks (pgvector RAG)
- `generate_demand_letter` — Trigger AI demand letter generation for a case

## LLM Configuration

Configurable via **Settings → AI Assistant — LLM**:

| Setting | Default | Options |
|---------|---------|---------|
| Provider | OpenRouter | OpenRouter, Anthropic (direct) |
| Model | auto | auto, GPT-4o, Claude Sonnet 4.5/4.6, Gemini Pro 1.5 |

Changes write to `openclaw/config/openclaw.json` and take effect after container restart.

Config file location: `openclaw/config/openclaw.json`
```json
{
  "agent_id": "wyatt",
  "model": "openrouter/auto",
  "gateway_token": "${OPENCLAW_GATEWAY_TOKEN}"
}
```

## Usage

1. Navigate to **AI Agent** in the sidebar (or go to `/ai-agent`)
2. The OpenClaw chat interface loads in the right panel
3. Talk to Wyatt naturally: "Show me all cases in pre-litigation status" or "What's Patricia Williams' settlement offer history?"

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENCLAW_GATEWAY_TOKEN` | Auth token for OpenClaw gateway API |
| `OPENROUTER_API_KEY` | OpenRouter API key for LLM calls |

## Health Check

```bash
curl http://10.10.110.33/openclaw/healthz
# → {"ok": true}
```

## Phase 13 Deferred Items

- **Autonomous orchestration:** Wyatt → n8n trigger (Wyatt detects a pattern and fires an n8n workflow automatically) — deferred to v6.0
- **Wyatt email drafts:** Auto-draft outbound emails to adjusters/providers — pending SMTP activation
