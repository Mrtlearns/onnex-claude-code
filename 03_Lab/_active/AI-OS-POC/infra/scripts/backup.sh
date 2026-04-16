#!/usr/bin/env bash
# Agency AI-OS -- Backup Script
# Backs up: Postgres databases (aios, authentik, temporal) + MinIO buckets (aios-uploads, aios-artifacts)
# Usage: ./infra/scripts/backup.sh
# Run from: /opt/agency-ai-os (project root)
set -euo pipefail

# Load env vars
set -a
# shellcheck source=/dev/null
source "$(dirname "$0")/../env/.env"
set +a

BACKUP_DIR="/opt/agency-ai-os/backups/$(date +%Y%m%d_%H%M%S)"
mkdir -p "${BACKUP_DIR}"

echo "[backup] Starting backup to ${BACKUP_DIR}"

# --- Postgres dumps ---
echo "[backup] Dumping Postgres databases..."
for DB in aios authentik temporal; do
  echo "  -> ${DB}.dump"
  docker exec postgres-core pg_dump     -U "${POSTGRES_USER}"     --no-password     --format=custom     "${DB}" > "${BACKUP_DIR}/${DB}.dump"
done

# --- MinIO bucket backup ---
echo "[backup] Backing up MinIO buckets..."
# Set mc alias fresh (alias state is not persisted across container restarts)
docker exec minio-core mc alias set local   "http://localhost:9000"   "${MINIO_ROOT_USER}"   "${MINIO_ROOT_PASSWORD}" > /dev/null

for BUCKET in aios-uploads aios-artifacts; do
  echo "  -> minio-${BUCKET}/"
  docker exec minio-core sh -c "mc cp --recursive local/${BUCKET} /tmp/minio-backup-${BUCKET}/" || true
  mkdir -p "${BACKUP_DIR}/minio-${BUCKET}"
  docker cp "minio-core:/tmp/minio-backup-${BUCKET}/." "${BACKUP_DIR}/minio-${BUCKET}/" 2>/dev/null ||     echo "  [info] bucket ${BUCKET} is empty or does not exist -- skipping"
  docker exec minio-core rm -rf "/tmp/minio-backup-${BUCKET}" 2>/dev/null || true
done

# --- Summary ---
BACKUP_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)
echo "[backup] Complete. Location: ${BACKUP_DIR} (${BACKUP_SIZE})"
ls -lh "${BACKUP_DIR}"
