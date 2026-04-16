#!/bin/bash
# n8n setup: create API key and credentials
set -e

N8N="http://localhost:5678"
COOKIE=/tmp/n8n_cookies.txt

echo "=== Step 1: Login ==="
curl -s -c $COOKIE -X POST "$N8N/rest/login" \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"admin@cmmc4msp.on-nex.us","password":"mK21iOdUo2eXTGGoLz4ry4ex"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('Login OK:', d.get('data',{}).get('email','FAIL'))"

echo ""
echo "=== Step 2: Create API key ==="
API_KEY=$(curl -s -b $COOKIE -c $COOKIE -X POST "$N8N/rest/api-keys" \
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
curl -s -X POST "$N8N/api/v1/credentials" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CMMC4MSP Postgres",
    "type": "postgres",
    "data": {
      "host": "postgres",
      "port": 5432,
      "database": "cmmc_main",
      "user": "cmmc_app",
      "password": "iHItynfab9yUwZ9GgyJYtbxdBQOSYMtm",
      "ssl": "disable"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Postgres cred ID:', d.get('id', d))"

echo ""
echo "=== Step 5: Create Webhook secret credential ==="
curl -s -X POST "$N8N/api/v1/credentials" \
  -H "X-N8N-API-KEY: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CMMC Webhook Secret",
    "type": "httpHeaderAuth",
    "data": {
      "name": "X-Webhook-Secret",
      "value": "changeme"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Webhook cred ID:', d.get('id', d))"

echo ""
echo "=== Done. Save this API key: $API_KEY ==="
