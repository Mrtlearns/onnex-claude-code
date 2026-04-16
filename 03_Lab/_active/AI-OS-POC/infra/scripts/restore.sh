#!/usr/bin/env bash
# Agency AI-OS -- Restore Script
# Restores: Postgres databases + MinIO buckets from a backup directory
# Usage: ./infra/scripts/restore.sh <backup-dir>
# CAUTION: Postgres restore drops and recreates the target database.
set -euo pipefail

if [[ -z "${1:-}" ]]; then
  echo "Usage: $0 <backup-directory>"
  echo "Example: $0 /opt/agency-ai-os/backups/20260310_120000"
  exit 1
fi

BACKUP_DIR="$1"

if [[ ! -d "${BACKUP_DIR}" ]]; then
  echo "Error: backup directory not found: ${BACKUP_DIR}"
  exit 1
fi

# Load env vars
set -a
source "$(dirname "$0")/../env/.env"
set +a

echo "[restore] Restoring from ${BACKUP_DIR}"
echo "[restore] WARNING: This will overwrite existing data. Press CTRL+C within 5 seconds to abort."
sleep 5

# --- Postgres restore ---
echo "[restore] Restoring Postgres databases..."
for DB in aios authentik temporal; do
  DUMP_FILE="${BACKUP_DIR}/${DB}.dump"
  if [[ ! -f "${DUMP_FILE}" ]]; then
    echo "  -> SKIP: ${DB}.dump not found in backup dir"
    continue
  fi
  echo "  -> Restoring ${DB}..."
  docker exec postgres-core psql -U "${POSTGRES_USER}" \
    -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${DB}' AND pid <> pg_backend_pid();"
  docker exec postgres-core dropdb -U "${POSTGRES_USER}" --if-exists "${DB}"
  docker exec postgres-core createdb -U "${POSTGRES_USER}" "${DB}"
  docker cp "${DUMP_FILE}" "postgres-core:/tmp/${DB}.dump"
  docker exec postgres-core pg_restore \
    -U "${POSTGRES_USER}" \
    --no-password \
    --dbname="${DB}" \
    --no-owner \
    --role="${POSTGRES_USER}" \
    "/tmp/${DB}.dump"
  docker exec postgres-core rm -f "/tmp/${DB}.dump"
  echo "  -> ${DB} restored"
done

# --- MinIO restore ---
echo "[restore] Restoring MinIO buckets..."
docker exec minio-core mc alias set local \
  "http://localhost:9000" \
  "${MINIO_ROOT_USER}" \
  "${MINIO_ROOT_PASSWORD}" > /dev/null

for BUCKET in aios-uploads aios-artifacts; do
  BUCKET_BACKUP="${BACKUP_DIR}/minio-${BUCKET}"
  if [[ ! -d "${BUCKET_BACKUP}" ]]; then
    echo "  -> SKIP: minio-${BUCKET} dir not found in backup"
    continue
  fi
  echo "  -> Restoring bucket ${BUCKET}..."
  docker exec minio-core mc mb --ignore-existing "local/${BUCKET}"
  docker cp "${BUCKET_BACKUP}/." "minio-core:/tmp/restore-${BUCKET}/"
  docker exec minio-core mc cp --recursive "/tmp/restore-${BUCKET}/" "local/${BUCKET}/"
  docker exec minio-core rm -rf "/tmp/restore-${BUCKET}" 2>/dev/null || true
  echo "  -> ${BUCKET} restored"
done

echo "[restore] Complete."
