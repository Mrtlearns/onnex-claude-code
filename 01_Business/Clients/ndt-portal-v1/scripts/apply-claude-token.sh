#!/usr/bin/env bash
# Apply Claude OAuth token from portal token store to the current shell environment.
# Run once after saving a token via the portal Settings → Claude Auth tab.
# Idempotent — safe to run multiple times.

STORE="$(cd "$(dirname "$0")/.." && pwd)/claude-token-store/token.json"

if [ ! -f "$STORE" ]; then
  echo "Token store not found at $STORE"
  echo "Save a token first via the portal: Settings → Claude Auth → Save token"
  exit 1
fi

TOKEN=$(python3 -c "import json; d=json.load(open('$STORE')); print(d.get('claude_oauth_token',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "No token stored. Save one via portal Settings → Claude Auth tab."
  exit 1
fi

# Remove old entry and append fresh one
sed -i '/export CLAUDE_CODE_OAUTH_TOKEN=/d' ~/.bashrc
echo "export CLAUDE_CODE_OAUTH_TOKEN=\"$TOKEN\"" >> ~/.bashrc

# Apply to current session immediately
export CLAUDE_CODE_OAUTH_TOKEN="$TOKEN"

echo "Token applied: ${TOKEN:0:20}..."
echo "Run 'source ~/.bashrc' or start a new shell for persistent effect."
