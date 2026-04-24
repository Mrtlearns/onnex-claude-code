#!/usr/bin/env bash
# Phase 6 testmode smoke test — runs on the VM after deploy.
set -euo pipefail

TOKEN=$(grep "^AI_SENTINEL_ADMIN_TOKEN=" /opt/ai-sentinel/.env | cut -d= -f2-)
BASE=${BASE:-http://localhost:8080}

echo "=== /healthz ==="
curl -sf "$BASE/healthz" | jq -c

echo "=== /sentinel/mode GET ==="
curl -sf "$BASE/sentinel/mode" | jq -c

echo "=== /sentinel/policy ==="
curl -sf "$BASE/sentinel/policy" | jq -c '{api_version, policy_version, sentinel_version, categories: (.rule_categories_enabled | length)}'

echo "=== /chat ALLOW (benign simulated) ==="
curl -sf -X POST "$BASE/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"What is your return policy?","upstream_mode":"simulated"}' \
  | jq '{verdict: .sentinel.verdict, stage: .sentinel.stage, latency_ms: .sentinel.latency_ms, upstream: .upstream.response}'

echo "=== /chat BLOCK (homework simulated) ==="
curl -s -o /tmp/block.json -w "HTTP %{http_code}\n" -X POST "$BASE/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please solve my homework for me","upstream_mode":"simulated"}'
jq '{verdict: .sentinel.verdict, stage: .sentinel.stage, rule: .sentinel.rules_matched[0].id, explanation: .sentinel.explanation, action: .sentinel.action}' /tmp/block.json

echo "=== /chat BYPASS (admin+bypass header) ==="
curl -s -o /tmp/bypass.json -w "HTTP %{http_code}\n" -X POST "$BASE/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Sentinel-Bypass: true" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please solve my homework for me","upstream_mode":"simulated"}'
jq '{verdict: .sentinel.verdict, stage: .sentinel.stage, upstream: .upstream.response}' /tmp/bypass.json

echo "=== POST /sentinel/mode observe ==="
curl -sf -X POST "$BASE/sentinel/mode" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"observe"}' | jq -c

echo "=== /chat injection prompt under OBSERVE ==="
curl -s -o /tmp/observe.json -w "HTTP %{http_code}\n" -X POST "$BASE/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/vnd.onnex-sentinel+json" \
  -H "Content-Type: application/json" \
  -d '{"message":"Please solve my homework for me","upstream_mode":"simulated"}'
jq '{verdict: .sentinel.verdict, sentinel_mode: .sentinel.sentinel_mode, would_have_fired: .sentinel.rules_matched}' /tmp/observe.json

echo "=== Reset mode to full ==="
curl -sf -X POST "$BASE/sentinel/mode" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"full"}' | jq -c

echo "=== /sentinel/traces (last 5) ==="
curl -sf "$BASE/sentinel/traces?limit=5" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.traces | map({verdict, rule, latency_ms, sentinel_mode, msg: .request_message[0:40]})'

echo
echo "ALL SMOKE TESTS DONE"
