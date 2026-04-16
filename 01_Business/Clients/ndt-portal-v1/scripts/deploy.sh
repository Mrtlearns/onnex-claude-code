#!/usr/bin/env bash
# ── NDT Portal deploy script ──────────────────────────────────────────────────
# Runs on the ndtv1 server (or by the GitLab runner).
# Builds frontend + API from a checked-out repo, then copies to /opt/ndt-portal/
# and restarts Docker Compose services.
#
# Usage (manual):
#   cd /home/gitlab-runner/builds/<token>/0/claude-workspace-pro
#   bash projects/ndt-portal-v1/scripts/deploy.sh
#
# Usage (first-time server setup):
#   sudo mkdir -p /opt/ndt-portal/{dist,api/dist,api/node_modules,db}
#   bash projects/ndt-portal-v1/scripts/deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PORTAL="$REPO_ROOT/projects/ndt-portal-v1"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/ndt-portal}"

echo "==> Repo:   $REPO_ROOT"
echo "==> Portal: $PORTAL"
echo "==> Deploy: $DEPLOY_DIR"
echo ""

# ── 1. Build frontend ─────────────────────────────────────────────────────────
echo "[1/6] Building frontend..."
cd "$PORTAL/frontend"
npm ci --prefer-offline
npm run build
echo "      Done — $(find dist -type f | wc -l) files in dist/"

# ── 2. Deploy frontend ────────────────────────────────────────────────────────
echo "[2/6] Deploying frontend dist..."
sudo mkdir -p "$DEPLOY_DIR/dist"
sudo rsync -a --delete dist/ "$DEPLOY_DIR/dist/"
echo "      Synced to $DEPLOY_DIR/dist/"

# ── 3. Build API ──────────────────────────────────────────────────────────────
echo "[3/6] Building API..."
cd "$PORTAL/api"
npm ci --prefer-offline
npm run build
echo "      Done"

# ── 4. Deploy API ─────────────────────────────────────────────────────────────
echo "[4/6] Deploying API dist + node_modules..."
sudo mkdir -p "$DEPLOY_DIR/api/dist" "$DEPLOY_DIR/api/node_modules"
sudo rsync -a --delete dist/ "$DEPLOY_DIR/api/dist/"
sudo rsync -a --delete node_modules/ "$DEPLOY_DIR/api/node_modules/"
echo "      Synced"

# ── 5. Sync config files ──────────────────────────────────────────────────────
echo "[5/6] Syncing config files..."
sudo cp "$PORTAL/docker-compose.yml"    "$DEPLOY_DIR/"
sudo cp "$PORTAL/traefik-dynamic.yml"   "$DEPLOY_DIR/"
sudo cp "$PORTAL/nginx.conf"            "$DEPLOY_DIR/"
# Only copy db init.sql if it hasn't run yet (postgres uses it only on first init)
sudo rsync -a --ignore-existing "$PORTAL/db/" "$DEPLOY_DIR/db/"
echo "      Done"

# ── 6. Restart services ───────────────────────────────────────────────────────
echo "[6/6] Restarting Docker Compose services..."
cd "$DEPLOY_DIR"
sudo docker compose pull --quiet
sudo docker compose up -d --remove-orphans
echo ""
echo "==> Deploy complete."
sudo docker compose ps
