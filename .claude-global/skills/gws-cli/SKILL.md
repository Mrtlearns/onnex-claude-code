# Skill: Google Workspace CLI (GWS)

Command-line interface for managing Google Workspace resources.
Repo: https://github.com/googleworkspace/cli

---

## What It Does

GWS CLI lets Claude manage Google Workspace programmatically:
- Drive: list, read, create, move files and folders
- Gmail: read, search, send emails
- Calendar: list, create, update events
- Docs/Sheets/Slides: create and edit
- Admin: manage users, groups, org units (requires admin account)

---

## When to Apply

- TRIGGER: User asks to manage files in Google Drive
- TRIGGER: User asks to read or send Gmail
- TRIGGER: User asks to create or check calendar events
- TRIGGER: Client uses Google Workspace and needs automation
- TRIGGER: "Drive", "Gmail", "Google Docs", "Google Calendar", "GWS", "Workspace"

---

## Installation

```bash
# Windows (run in terminal)
npm install -g @googleworkspace/cli

# Verify
gws --version
```

Or use the Go binary:
```bash
# Download from: https://github.com/googleworkspace/cli/releases
# Add to PATH
```

---

## Authentication Setup

```bash
# Authenticate (opens browser OAuth flow)
gws auth login

# For service account (headless/server):
gws auth service-account --key-file path/to/service-account.json

# Verify auth
gws auth status
```

Requires Google Cloud project with Workspace APIs enabled and OAuth2 credentials.

---

## Core Operations

```bash
# Drive
gws drive ls "My Drive/Clients/"
gws drive get "file-id" --output ./local-path/
gws drive upload ./report.pdf "Clients/ClientName/"

# Gmail
gws gmail search "subject:Invoice from:client@example.com"
gws gmail send --to "client@example.com" --subject "Report" --body "See attached" --attach report.pdf

# Calendar
gws calendar list --start 2026-04-09 --end 2026-04-16
gws calendar create --title "Client Meeting" --start "2026-04-10T10:00" --end "2026-04-10T11:00"

# Sheets
gws sheets read "spreadsheet-id" --range "Sheet1!A1:Z100"
```

---

## Onnex Usage Patterns

- Client document delivery → upload deliverables to client's Drive folder
- Invoice management → search Gmail for invoices, extract data
- Meeting prep → pull calendar events, summarize agenda
- Reporting → write to Google Sheets for client dashboards

---

## Status
NEEDS CONFIGURATION — Google OAuth2 or service account credentials required. See configuration prompt.
