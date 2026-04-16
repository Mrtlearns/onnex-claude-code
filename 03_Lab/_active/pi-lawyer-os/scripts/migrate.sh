#!/usr/bin/env bash
# PI Lawyer OS — Migration runner
# Usage: ./scripts/migrate.sh [migration_number]
# Example: ./scripts/migrate.sh 002
# Runs all migrations if no argument given.

set -euo pipefail

COMPOSE_FILE="$(dirname "$0")/../docker-compose.yml"
MIGRATIONS_DIR="$(dirname "$0")/../postgres/migrations"

run_migration() {
  local file="$1"
  local name
  name=$(basename "$file")
  echo "→ Running $name ..."
  docker compose -f "$COMPOSE_FILE" cp "$file" postgres:/tmp/migration.sql
  docker compose -f "$COMPOSE_FILE" exec -T postgres \
    psql -U postgres -d pilaweros -f /tmp/migration.sql
  echo "✓ $name complete"
}

if [[ $# -eq 1 ]]; then
  # Run specific migration by number prefix
  pattern="${MIGRATIONS_DIR}/${1}*.sql"
  files=( $pattern )
  if [[ ${#files[@]} -eq 0 ]]; then
    echo "No migration matching: $pattern" >&2
    exit 1
  fi
  for f in "${files[@]}"; do run_migration "$f"; done
else
  # Run all migrations in order
  for f in "$MIGRATIONS_DIR"/*.sql; do
    run_migration "$f"
  done
fi
