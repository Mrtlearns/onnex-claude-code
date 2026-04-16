#!/bin/bash
# n8n setup: create API key and credentials (v2 - with full key capture)
N8N="http://localhost:5678"
COOKIE=/tmp/n8n_cookies2.txt

echo "=== Login ==="
curl -s -c $COOKIE -X POST "$N8N/rest/login" \
  -H "Content-Type: application/json" \
  -d '{"emailOrLdapLoginId":"admin@cmmc4msp.on-nex.us","password":"mK21iOdUo2eXTGGoLz4ry4ex"}' \
  | python3 -c "import sys,json; print('OK:', json.load(sys.stdin).get('data',{}).get('email','FAIL'))"

echo ""
echo "=== Create API key (raw response) ==="
RESPONSE=$(curl -s -b $COOKIE -c $COOKIE -X POST "$N8N/rest/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"label":"cmmc-full","scopes":["workflow:read","workflow:list","workflow:activate","workflow:deactivate","credential:create","credential:update","credential:delete","credential:list","execution:read","execution:list"],"expiresAt":null}')

echo "Raw response: $RESPONSE"
API_KEY=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('apiKey','ERROR'))")
echo "Extracted key: $API_KEY"

echo ""
echo "=== Try credentials via session cookie (not API key) ==="
curl -s -b $COOKIE -c $COOKIE -X POST "$N8N/rest/credentials" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "CMMC4MSP Postgres",
    "type": "postgres",
    "nodesAccess": [],
    "data": {
      "host": "postgres",
      "port": 5432,
      "database": "cmmc_main",
      "user": "cmmc_app",
      "password": "iHItynfab9yUwZ9GgyJYtbxdBQOSYMtm",
      "ssl": "disable"
    }
  }' | python3 -c "import sys,json; d=json.load(sys.stdin); print('Postgres cred:', d.get('id', d.get('message', d)))"

echo ""
echo "=== Create Anthropic (placeholder) credential ==="
curl -s -b $COOKIE -c $COOKIE -X POST "$N8N/rest/credentials" \
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
curl -s -b $COOKIE -c $COOKIE -X POST "$N8N/rest/credentials" \
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
