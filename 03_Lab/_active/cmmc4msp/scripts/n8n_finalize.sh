#!/bin/bash
# n8n finalize: test JWT API key, check workflows, delete test org, store key.
#
# Required env vars:
#   N8N_API_KEY            n8n JWT API key (public-api token)
#   N8N_ADMIN_EMAIL        n8n owner email (used as login fallback)
#   N8N_ADMIN_PASSWORD     n8n owner password (used as login fallback)
set -eu

: "${N8N_API_KEY:?N8N_API_KEY not set}"
: "${N8N_ADMIN_EMAIL:?N8N_ADMIN_EMAIL not set}"
: "${N8N_ADMIN_PASSWORD:?N8N_ADMIN_PASSWORD not set}"

N8N="${N8N_INTERNAL_URL:-http://localhost:5678}"
COOKIE=$(mktemp /tmp/n8n_cookies_final.XXXXXX)
trap 'rm -f "$COOKIE"' EXIT

echo "=== Step 1: Test JWT API key ==="
RESULT=$(curl -s "$N8N/api/v1/workflows" -H "X-N8N-API-KEY: $N8N_API_KEY")
WF_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))")
echo "Workflows via JWT API: $WF_COUNT"

if [ "$WF_COUNT" = "0" ]; then
  echo "Still 0 — JWT key may not be working, trying to get fresh key via login"
  LOGIN_BODY=$(python3 -c 'import json,os; print(json.dumps({"emailOrLdapLoginId":os.environ["N8N_ADMIN_EMAIL"],"password":os.environ["N8N_ADMIN_PASSWORD"]}))')
  curl -s -c "$COOKIE" -X POST "$N8N/rest/login" \
    -H "Content-Type: application/json" \
    -d "$LOGIN_BODY" > /dev/null

  RESULT=$(curl -s -b "$COOKIE" "$N8N/rest/workflows")
  WF_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "parse error")
  echo "Workflows via session: $WF_COUNT"
fi

echo ""
echo "=== Step 2: Delete Canopy Aerospace test org ==="
docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c "DELETE FROM orgs WHERE slug='canopy-aerospace'" 2>&1

echo ""
echo "=== Step 3: Save n8n API key to .env ==="
ENV_FILE="${CMMC_ENV_FILE:-/opt/stacks/cmmc4msp/.env}"
if grep -q "N8N_API_KEY" "$ENV_FILE"; then
  sed -i "s|^N8N_API_KEY=.*|N8N_API_KEY=$N8N_API_KEY|" "$ENV_FILE"
else
  echo "" >> "$ENV_FILE"
  echo "# n8n JWT API key for programmatic access" >> "$ENV_FILE"
  echo "N8N_API_KEY=$N8N_API_KEY" >> "$ENV_FILE"
fi
echo "Saved."

echo ""
echo "=== Step 4: Final service health check ==="
echo -n "FastAPI health: " && curl -s http://localhost:8000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'], '| db:', d.get('db', d.get('components',{}).get('postgres','?')))"
echo -n "Hasura: " && curl -s http://localhost:8080/healthz
echo -n "Next.js: " && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
echo -n "n8n: " && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5678/healthz

echo ""
echo "=== Step 5: Check DB — control_definitions count ==="
docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c "SELECT COUNT(*) as total_controls, SUM(CASE WHEN is_objective THEN 1 ELSE 0 END) as objectives, SUM(CASE WHEN NOT is_objective THEN 1 ELSE 0 END) as parents FROM control_definitions" 2>&1

echo ""
echo "=== Done ==="
