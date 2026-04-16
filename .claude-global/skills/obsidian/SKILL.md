# Skill: Obsidian

Obsidian is the primary knowledge base for notes, research, and documentation in the Onnex workspace.
Repo: https://github.com/obsidianmd/obsidian-releases

---

## Integration Mode

Obsidian connects to Claude Code via **obsidian-mcp** — an MCP server that exposes vault read/write.

**MCP config** (add to `.mcp.json` once configured):
```json
{
  "obsidian": {
    "command": "npx",
    "args": ["-y", "obsidian-mcp"],
    "env": {
      "OBSIDIAN_API_KEY": "${OBSIDIAN_API_KEY}",
      "OBSIDIAN_HOST": "http://127.0.0.1:27123"
    }
  }
}
```

Requires **Local REST API** community plugin enabled in Obsidian with an API key generated.

---

## When to Apply

- TRIGGER: User asks to search, read, or write to Obsidian vault
- TRIGGER: User asks to save research findings as permanent notes
- TRIGGER: User references "the vault" or a specific note by name

---

## Operations

### Search vault
Use MCP tool `obsidian_search` with a query string.

### Read a note
Use MCP tool `obsidian_get_file_contents` with the file path within vault.

### Create or update a note
Use MCP tool `obsidian_update_file` or `obsidian_create_file`.

### List vault structure
Use MCP tool `obsidian_list_files_in_vault`.

---

## Onnex Vault Conventions

- Research notes → `Research/<topic>.md`
- Client notes → `Clients/<client-name>/<topic>.md`
- Project context → `Projects/<project-name>/<topic>.md`
- Daily notes → `Daily/<YYYY-MM-DD>.md`

---

## Status
NEEDS CONFIGURATION — see configuration prompt.
