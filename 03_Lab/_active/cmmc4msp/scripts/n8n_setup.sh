#!/bin/bash
# n8n setup: create API key and credentials.
#
# Required env vars (exit 2 if any are missing):
#   N8N_ADMIN_EMAIL        n8n owner email
#   N8N_ADMIN_PASSWORD     n8n owner password
#   PG_APP_PASSWORD        cmmc_app Postgres password
#   FASTAPI_WEBHOOK_SECRET shared secret used for inbound webhook auth
set -eu

: "${N8N_ADMIN_EMAIL:?N8N_ADMIN_EMAIL not set}"
: "${N8N_ADMIN_PASSWORD:?N8N_ADMIN_PASSWORD not set}"
: "${PG_APP_PASSWORD:?PG_APP_PASSWORD not set}"
: "${FASTAPI_WEBHOOK_SECRET:?FASTAPI_WEBHOOK_SECRET not set}"

N8N="${N8N_INTERNAL_URL:-http://localhost:5678}"
COOKIE=$(mktemp /tmp/n8n_cookies.XXXXXX)
trap 'rm -f "$COOKIE"' EXIT

echo "=== Step 1: Login ==="
LOGIN_BODY=$(python3 -c 'import json,os; print(json.dumps({"emailOrLdapLoginId":os.environ["N8N_ADMIN_EMAIL"],"password":os.environ["N8N_ADMIN_PASSWORD"]}))')
curl -s -c "$COOKIE" -X POST "$N8N/rest/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Login OK:', d.get('data',{}).get('email','FAIL'))"

echo ""
echo "=== Step 2: Create API key ==="
API_KEY=$(curl -s -b "$COOKIE" -c "$COOKIE" -X POST "$N8N/rest/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"label":"cmmc-auto","scopes":["workflow:read","workflow:list","workflow:activate","workflow:deactivate","credential:create","credential:list","execution:read","execution:list"],"expiresAt":null}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',d).get('apiKey','ERROR'))")

echo "API Key: $API_KEY"

if [[ "$API_KEY" == "ERROR" ]] || [[ -z "$API_KEY" ]]; then
  echo "Failed to create API key"
  exit 1
fi

echo ""
echo "=== Step 3: Test API key ==="
curl -s "$N8N/api/v1/workflows" \
  -H "X-N8N-API-KEY: $API_KEY" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Workflows:', len(d.get('data',[])))"

echo ""
echo "=== Step 4: Create Postgres credential ==="
PG_BODY=$(python3 -c 'import json,os; print(json.dumps({"name":"CMMC4MSP Postgres","type":"postgres","data":{"host":"postgres","port":5432,"database":"cmmc_main","user":"cmmc_app","password":os.environ["PG_APP_PASSWORD"],"ssl":"disable"}}))')
curl -s -X POST "$N8N/api/v1/credentials" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PG_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Postgres cred ID:', d.get('id', d))"

echo ""
echo "=== Step 5: Create Webhook secret credential ==="
WH_BODY=$(python3 -c 'import json,os; print(json.dumps({"name":"CMMC Webhook Secret","type":"httpHeaderAuth","data":{"name":"X-Webhook-Secret","value":os.environ["FASTAPI_WEBHOOK_SECRET"]}}))')
curl -s -X POST "$N8N/api/v1/credentials" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d "$WH_BODY" | python3 -c "import sys,json; d=json.load(sys.stdin); print('Webhook cred ID:', d.get('id', d))"

echo ""
echo "=== Done. Save this API key: $API_KEY ==="
