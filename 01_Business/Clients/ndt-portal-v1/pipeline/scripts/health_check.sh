#!/usr/bin/env bash
# Health check all three pipeline microservices
# Usage: ./health_check.sh [base_url]
# Default base_url: http://localhost:8888

BASE="${1:-http://localhost:8888}"

check() {
  local name="$1"
  local url="$2"
  local result
  result=$(curl -sf "$url" 2>&1)
  if echo "$result" | grep -q '"ok"'; then
    echo "✓ $name — OK"
  else
    echo "✗ $name — FAILED: $result"
  fi
}

check "comply"   "$BASE/api/pipeline/comply/health"
check "sanitize" "$BASE/api/pipeline/sanitize/health"
check "gateway"  "$BASE/api/pipeline/gateway/health"
