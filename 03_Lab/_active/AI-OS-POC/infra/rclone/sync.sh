#!/bin/sh
set -e

LOG_FILE="/bisync_state/gdrive-sync.log"
SYNC_DEST="minio-truenas:gdrive-sync"
DELETED_DIR="minio-truenas:gdrive-deleted"
RCLONE_CONFIG="/config/rclone/rclone.conf"
NEXTCLOUD_CONTAINER="nextcloud-app"
NEXTCLOUD_SCAN_PATH="/ncadmin/GDrive-Sync"

# SYNC_MODE controls the sync source:
#   gdrive  (default) — live Google Drive, "04 Clients" subfolder, fast+full schedule
#   nas               — NAS-Full-Onnex archive, intra-MinIO copy, use during infra dev
# NAS_SUBFOLDER: which subfolder of onnex-main to sync to gdrive-sync bucket
#   Default: "04 Clients" (mirrors current live scope)
#   Change to expand: e.g., "07 Sales AI" or leave empty for full onnex-main
SYNC_MODE="${SYNC_MODE:-gdrive}"
NAS_SUBFOLDER="${NAS_SUBFOLDER:-04 Clients}"
NAS_SOURCE="minio-truenas:onnex-main/${NAS_SUBFOLDER}"

log() {
  echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

# Log rotation — keep log under 100MB
rotate_log() {
  LOG_SIZE=$(stat -c%s "$LOG_FILE" 2>/dev/null || echo 0)
  if [ "$LOG_SIZE" -gt 104857600 ]; then
    mv "$LOG_FILE" "${LOG_FILE}.old"
    log "Log rotated (was >100MB)"
  fi
}

# Trigger Nextcloud to index new/updated files into its DB (metadata + thumbnails)
scan_nextcloud() {
  log "Scanning Nextcloud external storage for new files..."
  docker exec "$NEXTCLOUD_CONTAINER" php occ files:scan \
    --path="$NEXTCLOUD_SCAN_PATH" --generate-metadata -q \
    && log "Nextcloud scan complete." \
    || log "Nextcloud scan failed (non-fatal)."
}

run_nas_sync() {
  rotate_log
  log "Starting NAS sync (source: $NAS_SOURCE)..."
  rclone sync "$NAS_SOURCE" "$SYNC_DEST" \
    --config "$RCLONE_CONFIG" \
    --filter-from /config/filters.txt \
    --fast-list \
    --transfers 8 \
    --checkers 16 \
    --log-level INFO \
    --log-file "$LOG_FILE" \
    && log "NAS sync completed successfully." \
    || log "NAS sync completed with errors."
  scan_nextcloud
}

run_fast_sync() {
  rotate_log
  log "Starting fast sync (--max-age 12m)..."
  rclone copy gdrive: "$SYNC_DEST" \
    --config "$RCLONE_CONFIG" \
    --filter-from /config/filters.txt \
    --max-age 12m \
    --fast-list \
    --transfers 8 \
    --checkers 16 \
    --drive-acknowledge-abuse \
    --ignore-errors \
    --log-level INFO \
    --log-file "$LOG_FILE" \
    && log "Fast sync completed successfully." \
    || log "Fast sync completed with errors."
  scan_nextcloud
}

run_full_sync() {
  rotate_log
  log "Starting full sync (reconcile + soft-delete)..."
  rclone sync gdrive: "$SYNC_DEST" \
    --config "$RCLONE_CONFIG" \
    --filter-from /config/filters.txt \
    --backup-dir "$DELETED_DIR" \
    --fast-list \
    --transfers 8 \
    --checkers 16 \
    --drive-acknowledge-abuse \
    --ignore-errors \
    --log-level INFO \
    --log-file "$LOG_FILE" \
    && log "Full sync completed successfully." \
    || log "Full sync completed with errors."
  scan_nextcloud

  log "Triggering RAG auto-sync..."
  curl -s -X POST http://n8n:5678/webhook/nextcloud-rag-autosync \
    -H "Content-Type: application/json" \
    -d '{"trigger":"post-rclone-sync"}' \
    && log "RAG auto-sync triggered." \
    || log "RAG auto-sync trigger failed (non-fatal)."
}

log "=== gdrive-sync starting (SYNC_MODE=$SYNC_MODE) ==="

if [ "$SYNC_MODE" = "nas" ]; then
  log "NAS mode active — source: $NAS_SOURCE (no Google Drive connection)"
  run_nas_sync
  while true; do
    log "Sleeping 15 minutes..."
    sleep 900
    run_nas_sync
  done
else
  log "GDrive mode active — source: Google Drive [gdrive: remote]"
  run_full_sync
  while true; do
    log "Sleeping 15 minutes..."
    sleep 900
    HOUR=$(date +%H)
    if [ "$HOUR" = "00" ]; then
      run_full_sync
    else
      run_fast_sync
    fi
  done
fi
