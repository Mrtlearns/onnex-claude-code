#!/usr/bin/env bash
# Phase 5 smoke test — run on the VM after deployment.
set -euo pipefail

ENV_FILE=/opt/ai-sentinel/.env
[ -f "$ENV_FILE" ] || ENV_FILE=/opt/ai-sentinel/infra/env

TOKEN=$(grep "^AI_SENTINEL_ADMIN_TOKEN=" "$ENV_FILE" | cut -d= -f2-)
if [ -z "$TOKEN" ]; then
  echo "ADMIN_TOKEN missing" >&2
  exit 1
fi

BASE=http://localhost:8080

echo "=== /health ==="
curl -sf "$BASE/health" && echo

echo
echo "=== /admin/modules ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$BASE/admin/modules" | jq -r '
  .modules
  | length as $n
  | "\($n) modules",
    (.[] | "  \(.id | tostring | ("  " + .)[-2:])  \(.name)\t tier=\(.license_tier)\t enabled=\(.enabled)")'

echo
echo "=== /admin/audit/verify ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$BASE/admin/audit/verify" | jq .

echo
echo "=== rules dry-run: K-12 homework prompt ==="
curl -sf -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -X POST "$BASE/admin/rules/dry-run" \
  -d @- <<'BODY' | jq .
{
  "yaml": "module: test\nversion: 1\nrules:\n  - name: block-hw\n    trigger: prompt_ingress\n    conditions: { regex: \"(?i)solve my homework\" }\n    actions: [ { type: reject, user_message: \"nope\" } ]\n",
  "trigger": "prompt_ingress",
  "content": "please solve my homework for me"
}
BODY

echo
echo "=== toggle K-12 disable ==="
curl -sf -H "Authorization: Bearer $TOKEN" -X POST "$BASE/admin/modules/1/disable" | jq '.module | {id, name, enabled}'

echo
echo "=== toggle K-12 enable ==="
curl -sf -H "Authorization: Bearer $TOKEN" -X POST "$BASE/admin/modules/1/enable" | jq '.module | {id, name, enabled}'

echo
echo "=== /admin/modules/1/audit (last 3) ==="
curl -sf -H "Authorization: Bearer $TOKEN" "$BASE/admin/modules/1/audit" | jq '.audit[:3] | .[] | {id, action, actor, timestamp}'

echo
echo "=== /dashboard head ==="
curl -sI "$BASE/dashboard" | head -3

echo
echo "ALL SMOKE TESTS DONE"
