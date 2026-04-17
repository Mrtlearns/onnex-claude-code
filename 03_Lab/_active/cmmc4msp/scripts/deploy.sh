#!/bin/bash
# deploy.sh
# Full deployment script for cmmc4msp.
# Syncs all components to the VM and restarts services.
#
# Usage:
#   bash scripts/deploy.sh
#
# Prerequisites:
#   - SSH access to the VM via the claude-controller jump host
#   - rsync available locally
#   - .env present at $STACK_ROOT on the VM
#
# Environment overrides (optional):
#   VM_USER   — SSH user on the target VM  (default: mrt)
#   VM_HOST   — Target VM IP/hostname      (default: 10.10.110.41)
#   STACK_ROOT — Remote stack directory    (default: /opt/stacks/cmmc4msp)

set -euo pipefail

VM_USER="${VM_USER:-mrt}"
VM_HOST="${VM_HOST:-10.10.110.41}"
VM="${VM_USER}@${VM_HOST}"
STACK_ROOT="${STACK_ROOT:-/opt/stacks/cmmc4msp}"

JUMP_HOST="claude-controller"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"
SSH_CMD="ssh ${SSH_OPTS} -J ${JUMP_HOST} ${VM}"
RSYNC_SSH="ssh ${SSH_OPTS} -J ${JUMP_HOST}"

# Determine the repo root relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# ─────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────
step() { echo ""; echo "=== $* ==="; }
ok()   { echo "  OK: $*"; }
warn() { echo "  WARN: $*"; }

rsync_to_vm() {
  # Usage: rsync_to_vm [extra rsync flags] <local_src/> <remote_dst/>
  rsync -avz --progress \
    -e "${RSYNC_SSH}" \
    "$@" \
    "${VM}:${STACK_ROOT}/"
}

# ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════╗"
echo "║    CMMC4MSP — Full Deploy        ║"
echo "╚══════════════════════════════════╝"
echo "  Target : ${VM}"
echo "  Stack  : ${STACK_ROOT}"
echo "  Jump   : ${JUMP_HOST}"
echo ""

# Quick connectivity check
step "Connectivity check"
if ! $SSH_CMD "echo 'VM reachable'" 2>/dev/null; then
  echo "ERROR: Cannot reach ${VM} via jump host ${JUMP_HOST}." >&2
  exit 1
fi
ok "VM is reachable"

# ─────────────────────────────────────────────
# Step 1: Deploy DB migrations
# ─────────────────────────────────────────────
step "Step 1: Deploying DB migrations"
rsync_to_vm \
  "${REPO_ROOT}/postgres/migrations/" \
  "postgres/migrations/"
ok "Migrations synced"

# ─────────────────────────────────────────────
# Step 2: Run migrations (idempotent via IF NOT EXISTS / DO NOTHING)
# ─────────────────────────────────────────────
step "Step 2: Running SQL migrations"

# Pull DB user from remote .env
DB_USER=$($SSH_CMD "grep '^POSTGRES_USER=' ${STACK_ROOT}/.env | cut -d= -f2" || echo "cmmc_app")

run_migration() {
  local file="$1"
  local label="$2"
  echo "  Running ${label}..."
  $SSH_CMD "docker exec -i cmmc-postgres psql \
    -U ${DB_USER} -d cmmc_main \
    -f ${STACK_ROOT}/${file}" \
    && ok "${label} applied" \
    || warn "${label} may already be applied (continuing)"
}

run_migration "postgres/migrations/001_core_schema.sql"  "001_core_schema"
run_migration "postgres/migrations/002_controls_seed.sql" "002_controls_seed"
run_migration "postgres/migrations/003_indexes.sql"       "003_indexes"
run_migration "postgres/migrations/004_msp_hierarchy.sql" "004_msp_hierarchy"
run_migration "postgres/migrations/010_assignments_state_machine.sql" "010_assignments_state_machine"
run_migration "postgres/migrations/011_team_invites.sql"  "011_team_invites"

# ─────────────────────────────────────────────
# Step 3: Deploy FastAPI
# ─────────────────────────────────────────────
step "Step 3: Deploying FastAPI"
rsync_to_vm \
  --exclude='__pycache__' \
  --exclude='*.pyc' \
  --exclude='.pytest_cache' \
  "${REPO_ROOT}/fastapi/" \
  "fastapi/"

$SSH_CMD "cd ${STACK_ROOT} && sudo docker compose up -d --build fastapi"
ok "FastAPI container rebuilt"

echo "  Waiting 8s for FastAPI to start..."
sleep 8
$SSH_CMD "sudo docker logs cmmc-fastapi --tail=25" || warn "Could not fetch FastAPI logs"

# ─────────────────────────────────────────────
# Step 4: Deploy Next.js
# ─────────────────────────────────────────────
step "Step 4: Deploying Next.js"
rsync_to_vm \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='.turbo' \
  "${REPO_ROOT}/nextjs/" \
  "nextjs/"

$SSH_CMD "cd ${STACK_ROOT} && sudo docker compose up -d --build nextjs"
ok "Next.js container rebuilt"

# ─────────────────────────────────────────────
# Step 5: Deploy n8n workflows
# ─────────────────────────────────────────────
step "Step 5: Deploying n8n workflows"
rsync_to_vm \
  "${REPO_ROOT}/n8n/workflows/" \
  "n8n/workflows/"
ok "n8n workflow files synced"

# ─────────────────────────────────────────────
# Step 6: Import n8n workflows via API
# ─────────────────────────────────────────────
step "Step 6: Importing n8n workflows"

N8N_URL="http://localhost:5678"
N8N_PASS=$($SSH_CMD "grep '^N8N_BASIC_AUTH_PASS=' ${STACK_ROOT}/.env | cut -d= -f2" || echo "")

if [[ -z "$N8N_PASS" ]]; then
  warn "N8N_BASIC_AUTH_PASS not found in .env — skipping n8n import"
else
  $SSH_CMD "bash -s" <<'REMOTESCRIPT'
N8N_URL="http://localhost:5678"
N8N_PASS=$(grep '^N8N_BASIC_AUTH_PASS=' /opt/stacks/cmmc4msp/.env | cut -d= -f2)
WORKFLOW_DIR="/opt/stacks/cmmc4msp/n8n/workflows"

if ! ls "${WORKFLOW_DIR}"/*.json >/dev/null 2>&1; then
  echo "  No workflow JSON files found — skipping"
  exit 0
fi

for f in "${WORKFLOW_DIR}"/*.json; do
  echo "  Importing $(basename "$f")..."
  result=$(curl -s -X POST "${N8N_URL}/rest/workflows" \
    -H "Content-Type: application/json" \
    -u "admin:${N8N_PASS}" \
    -d @"$f" 2>/dev/null || echo '{"error":"curl failed"}')

  wf_id=$(echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('id',''))" 2>/dev/null || echo "")
  wf_err=$(echo "$result" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")

  if [[ -n "$wf_id" ]]; then
    echo "    -> imported, id: $wf_id"
  else
    echo "    -> WARN: ${wf_err:-unknown error}"
  fi
done
REMOTESCRIPT
  ok "n8n workflow import complete"
fi

# ─────────────────────────────────────────────
# Step 7: Apply Hasura metadata
# ─────────────────────────────────────────────
step "Step 7: Applying Hasura metadata"

HASURA_SECRET=$($SSH_CMD "grep '^HASURA_ADMIN_SECRET=' ${STACK_ROOT}/.env | cut -d= -f2" || echo "")

if [[ -z "$HASURA_SECRET" ]]; then
  warn "HASURA_ADMIN_SECRET not found in .env — skipping Hasura metadata"
else
  # Copy the apply script to the VM, then execute it there
  rsync -avz --progress \
    -e "${RSYNC_SSH}" \
    "${SCRIPT_DIR}/apply_hasura_metadata.sh" \
    "${VM}:/tmp/apply_hasura_metadata.sh"

  $SSH_CMD "HASURA_URL=http://localhost:8080 \
    HASURA_ADMIN_SECRET=${HASURA_SECRET} \
    bash /tmp/apply_hasura_metadata.sh"

  $SSH_CMD "rm -f /tmp/apply_hasura_metadata.sh"
  ok "Hasura metadata applied"
fi

# ─────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════╗"
echo "║    Deploy complete!              ║"
echo "╚══════════════════════════════════╝"
echo ""
echo "  Frontend : https://app.cmmc4msp.on-nex.us"
echo "  API      : https://api.cmmc4msp.on-nex.us/api/docs"
echo "  GraphQL  : https://gql.cmmc4msp.on-nex.us"
echo ""
echo "Verify:"
echo "  curl https://api.cmmc4msp.on-nex.us/health"
echo "  curl -s https://gql.cmmc4msp.on-nex.us/healthz"
