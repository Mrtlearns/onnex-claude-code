#!/bin/bash
# n8n finalize: test JWT API key, check workflows, delete test org, store key
N8N="http://localhost:5678"
COOKIE=/tmp/n8n_cookies_final.txt

# The JWT key from the previous run
JWT_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwZjMwMDE0NS1jOTUzLTQ1ZWUtOGE3ZC0yZGU5N2NmMjA1YzciLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNzhkNzlmZjMtYmViNS00ZWQ0LWIwOWQtZDJiMTNhMDFhZDJkIiwiaWF0IjoxNzc2MzAxNjM2fQ.WvWO-V6NwWmkE1gaO8R6W79w8Fi_60gobg6169Ps_bI"

echo "=== Step 1: Test JWT API key ==="
RESULT=$(curl -s "$N8N/api/v1/workflows" -H "X-N8N-API-KEY: $JWT_KEY")
WF_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))")
echo "Workflows via JWT API: $WF_COUNT"

if [ "$WF_COUNT" = "0" ]; then
  echo "Still 0 — JWT key may not be working, trying to get fresh key via login"
  curl -s -c $COOKIE -X POST "$N8N/rest/login" \
    -H "Content-Type: application/json" \
    -d '{"emailOrLdapLoginId":"admin@cmmc4msp.on-nex.us","password":"mK21iOdUo2eXTGGoLz4ry4ex"}' > /dev/null

  # Get workflows via session
  RESULT=$(curl -s -b $COOKIE "$N8N/rest/workflows")
  WF_COUNT=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data',[])))" 2>/dev/null || echo "parse error")
  echo "Workflows via session: $WF_COUNT"
fi

echo ""
echo "=== Step 2: Delete Canopy Aerospace test org ==="
docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c "DELETE FROM orgs WHERE slug='canopy-aerospace'" 2>&1

echo ""
echo "=== Step 3: Save n8n API key to .env ==="
if grep -q "N8N_API_KEY" /opt/stacks/cmmc4msp/.env; then
  sed -i "s|^N8N_API_KEY=.*|N8N_API_KEY=$JWT_KEY|" /opt/stacks/cmmc4msp/.env
else
  echo "" >> /opt/stacks/cmmc4msp/.env
  echo "# n8n JWT API key for programmatic access" >> /opt/stacks/cmmc4msp/.env
  echo "N8N_API_KEY=$JWT_KEY" >> /opt/stacks/cmmc4msp/.env
fi
echo "Saved."

echo ""
echo "=== Step 4: Final service health check ==="
echo -n "FastAPI health: " && curl -s http://localhost:8000/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'], '| db:', d['db'])"
echo -n "Hasura: " && curl -s http://localhost:8080/healthz
echo -n "Next.js: " && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000
echo -n "n8n: " && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5678/healthz

echo ""
echo "=== Step 5: Check DB — control_definitions count ==="
docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main -c "SELECT COUNT(*) as total_controls, SUM(CASE WHEN is_objective THEN 1 ELSE 0 END) as objectives, SUM(CASE WHEN NOT is_objective THEN 1 ELSE 0 END) as parents FROM control_definitions" 2>&1

echo ""
echo "=== Done ==="
