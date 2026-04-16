#!/usr/bin/env bash
# PI Lawyer OS — First-time server setup
# Run once on a fresh Ubuntu/Debian VM (10.10.110.33)
# Usage: ssh root@10.10.110.33 "bash -s" < scripts/server-setup.sh

set -euo pipefail

DEPLOY_DIR="/opt/pi-lawyer-os"
REPO_URL="git@gitlab.botonomy.xyz:claude-workspace-pro/projects/pi-lawyer-os.git"

echo "==> PI Lawyer OS server setup"

# Docker
if ! command -v docker &>/dev/null; then
  echo "--- Installing Docker ---"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# Docker Compose plugin
docker compose version &>/dev/null || apt-get install -y docker-compose-plugin

# Clone repo
if [ ! -d "$DEPLOY_DIR" ]; then
  echo "--- Cloning repo to $DEPLOY_DIR ---"
  git clone "$REPO_URL" "$DEPLOY_DIR"
else
  echo "--- Repo already exists at $DEPLOY_DIR ---"
fi

cd "$DEPLOY_DIR"

# Create .env from example
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "==> .env created from .env.example"
  echo "    EDIT /opt/pi-lawyer-os/.env with real values before starting!"
  echo ""
else
  echo "--- .env already exists ---"
fi

echo "==> Server setup complete"
echo ""
echo "Next steps:"
echo "  1. Edit /opt/pi-lawyer-os/.env with real credentials"
echo "  2. Run: cd /opt/pi-lawyer-os && docker compose up -d"
echo "  3. Import n8n workflows from n8n/workflows/"
