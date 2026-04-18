#!/bin/bash
# n8n setup v2: API key + credentials via session cookie.
#
# Required env vars:
#   N8N_ADMIN_EMAIL, N8N_ADMIN_PASSWORD, PG_APP_PASSWORD
set -eu

: "${N8N_ADMIN_EMAIL:?N8N_ADMIN_EMAIL not set}"
: "${N8N_ADMIN_PASSWORD:?N8N_ADMIN_PASSWORD not set}"
: "${PG_APP_PASSWORD:?PG_APP_PASSWORD not set}"

N8N="${N8N_INTERNAL_URL:-http://localhost:5678}"
COOKIE=$(mktemp /tmp/n8n_cookies2.XXXXXX)
trap 'rm -f "$COOKIE"' EXIT

echo "=== Login ==="
LOGIN_BODY=$(python3 -c 'import json,os; print(json.dumps({"emailOrLdapLoginId":os.environ["N8N_ADMIN_EMAIL"],"password":os.environ["N8N_ADMIN_PASSWORD"]}))')
curl -s -c "$COOKIE" -X POST "$N8N/rest/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  | python3 -c "import sys,json; print('OK:', json.load(sys.stdin).get('data',{}).get('email','FAIL'))"

echo ""
echo "=== Create API key (raw response) ==="
RESPONSE=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$N8N/rest/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"label":"cmmc-full","scopes":["workflow:read","workflow:list","workflow:activate","workflow:deactivate","credential:create","credential:update","credential:delete","credential:list","execution:read","execution:list"],"expiresAt":null}')

echo "Raw response: $RESPONSE"
API_KEY=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('apiKey','ERROR'))")
echo "Extracted key: $API_KEY"

echo ""
echo "=== Try credentials via session cookie (not API key) ==="
PG_BODY=$(python3 -c 'import json,os; print(json.dumps({"name":"CMMC4MSP Postgres","type":"postgres","nodesAccess":[],"data":{"host":"postgres","port":5432,"database":"cmmc_main","user":"cmmc_app","password":os.environ["PG_APP_PASSWORD"],"ssl":"disable"}}))')
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$N8N/rest/credentials" \
  -H "Content-Type: application/json" \
  -d "$PG_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Postgres cred:', d.get('id', d.get('message', d)))"

echo ""
echo "=== Create Anthropic (placeholder) credential ==="
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$N8N/rest/credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anthropic API Key",
    "type": "anthropicApi",
    "nodesAccess": [],
    "data": {
      "apiKey": "PLACEHOLDER_SET_ME"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Anthropic cred:', d.get('id', d.get('message', d)))"

echo ""
echo "=== Create SMTP credential ==="
curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$N8N/rest/credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CMMC SMTP",
    "type": "smtp",
    "nodesAccess": [],
    "data": {
      "host": "placeholder",
      "port": 587,
      "user": "placeholder",
      "password": "placeholder",
      "secure": false
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('SMTP cred:', d.get('id', d.get('message', d)))"

echo "=== Done ==="
