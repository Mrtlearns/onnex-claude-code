#!/usr/bin/env bash
# Resets the ai_sentinel DB user's password to match AI_SENTINEL_DB_PASSWORD from .env.
# Uses psql variable binding so the password never hits the shell or process list.
set -euo pipefail

PW=$(grep "^AI_SENTINEL_DB_PASSWORD=" /opt/ai-sentinel/.env | cut -d= -f2-)
if [ -z "$PW" ]; then
  echo "AI_SENTINEL_DB_PASSWORD missing from .env" >&2
  exit 1
fi

docker exec -i ai-sentinel-postgres psql -U sentinel -d ai_sentinel -v pw="$PW" -v ON_ERROR_STOP=1 <<'SQL'
ALTER ROLE ai_sentinel WITH LOGIN PASSWORD :'pw';
SQL

echo "== verify =="
docker run --rm --network ai-sentinel_sentinel-net -e PGPASSWORD="$PW" \
  pgvector/pgvector:pg16 psql -h postgres -U ai_sentinel -d ai_sentinel \
  -c "SELECT current_user, current_database();"
