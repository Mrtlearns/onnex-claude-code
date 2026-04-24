#!/usr/bin/env bash
# One-shot: create ai_sentinel DB role, set password from .env, grant privileges.
# Idempotent — safe to re-run.
set -euo pipefail

PW=$(grep "^AI_SENTINEL_DB_PASSWORD=" /opt/ai-sentinel/.env | cut -d= -f2-)
if [ -z "$PW" ]; then
  echo "AI_SENTINEL_DB_PASSWORD missing from .env" >&2
  exit 1
fi

docker exec -i ai-sentinel-postgres psql -U sentinel -d ai_sentinel -v pw="$PW" -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ai_sentinel') THEN
    CREATE ROLE ai_sentinel LOGIN;
  END IF;
END
$$;
ALTER ROLE ai_sentinel WITH LOGIN PASSWORD :'pw';
GRANT ALL PRIVILEGES ON DATABASE ai_sentinel TO ai_sentinel;
GRANT ALL ON SCHEMA public TO ai_sentinel;
ALTER SCHEMA public OWNER TO ai_sentinel;
SQL

echo "== verify =="
docker run --rm --network ai-sentinel_sentinel-net -e PGPASSWORD="$PW" \
  pgvector/pgvector:pg16 psql -h postgres -U ai_sentinel -d ai_sentinel \
  -c "SELECT current_user, current_database();"
