# n8n Workflow Skill

Reference guide for building n8n workflows in this workspace.

## Connection Details

- **Instance URL:** https://n8n.botonomy.xyz
- **Auth:** API key in `N8N_API_KEY` environment variable
- **Version:** n8n self-hosted (check your instance for current version)

## Workflow JSON Structure

```json
{
  "name": "Workflow Name",
  "nodes": [...],
  "connections": {...},
  "settings": {
    "executionOrder": "v1"
  },
  "staticData": null,
  "tags": []
}
```

## Common Node Types

| Purpose | Node Type |
|---------|-----------|
| Webhook trigger | `n8n-nodes-base.webhook` |
| HTTP request | `n8n-nodes-base.httpRequest` |
| Schedule trigger | `n8n-nodes-base.scheduleTrigger` |
| Code/logic | `n8n-nodes-base.code` |
| Gmail | `n8n-nodes-base.gmail` |
| Google Drive | `n8n-nodes-base.googleDrive` |
| Airtable | `n8n-nodes-base.airtable` |
| PostgreSQL | `n8n-nodes-base.postgres` |
| IF condition | `n8n-nodes-base.if` |
| Switch | `n8n-nodes-base.switch` |
| Set (transform) | `n8n-nodes-base.set` |
| Merge | `n8n-nodes-base.merge` |
| Loop | `n8n-nodes-base.splitInBatches` |
| AI Agent | `@n8n/n8n-nodes-langchain.agent` |
| OpenAI | `@n8n/n8n-nodes-langchain.openAi` |
| Claude | `@n8n/n8n-nodes-langchain.lmChatAnthropic` |

## Known Gotchas

- **Expression syntax:** Use `{{ $json.field }}` not `{{ json.field }}`
- **Binary data:** Must use `Move Binary Data` node before processing attachments
- **Webhook response:** Add a `Respond to Webhook` node if you need a response body
- **Credentials:** Never hardcode API keys — always use n8n credential store
- **Error handling:** Add an `Error Trigger` node to catch workflow failures
- **Loops:** Use `SplitInBatches` not `Loop Over Items` for large datasets
- **PostgreSQL:** Use parameterized queries `$1, $2` not string interpolation
- **AI nodes:** Langchain nodes require memory node for conversation history

## Credential Types Used in This Workspace

| Service | Credential Type |
|---------|----------------|
| Gmail | gmailOAuth2 |
| Google Drive | googleDriveOAuth2Api |
| PostgreSQL | postgres |
| Airtable | airtableTokenApi |
| OpenAI | openAiApi |
| Anthropic | anthropicApi |
| HTTP (generic) | httpHeaderAuth |

## Output Convention

All workflows built by the n8n agent are saved to:
- `outputs/n8n-[name]-[date].json` — importable workflow
- `outputs/n8n-[name]-[date]-docs.md` — setup and test guide
