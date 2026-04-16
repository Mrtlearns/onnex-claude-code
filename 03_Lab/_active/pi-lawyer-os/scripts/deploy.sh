#!/usr/bin/env bash
# PI Lawyer OS — Deploy script
# Usage: ./scripts/deploy.sh [server] [deploy_dir]
# Example: ./scripts/deploy.sh root@10.10.110.33 /opt/pi-lawyer-os
# Requires: SSH key access to server, git repo already cloned on server

set -euo pipefail

SERVER="${1:-root@10.10.110.33}"
DEPLOY_DIR="${2:-/opt/pi-lawyer-os}"

echo "==> Deploying PI Lawyer OS to $SERVER:$DEPLOY_DIR"

ssh "$SERVER" bash -s <<EOF
  set -euo pipefail
  cd "$DEPLOY_DIR"

  echo "--- Pulling latest code ---"
  git pull origin main

  echo "--- Checking .env exists ---"
  if [ ! -f .env ]; then
    echo "ERROR: .env not found. Copy .env.example and fill in values first."
    exit 1
  fi

  echo "--- Pulling new images ---"
  docker compose pull

  echo "--- Building custom images ---"
  docker compose build --no-cache frontend auth

  echo "--- Starting services ---"
  docker compose up -d --remove-orphans

  echo "--- Waiting for services to be healthy ---"
  sleep 10
  docker compose ps

  echo "--- Checking Postgres ---"
  docker compose exec -T postgres pg_isready -U postgres -d pilaweros

  echo "--- Pruning old images ---"
  docker image prune -f

  echo "==> Deploy complete"
EOF
