#!/bin/sh
set -e

LOG_FILE="/logs/gdrive-sync.log"
SYNC_DEST="nextcloud:/GDrive-Sync"
DELETED_DIR="nextcloud:/_GDrive_Deleted"
RCLONE_CONFIG="/tmp/rclone-working.conf"

log() {
  echo "[$(date -Iseconds)] $1" | tee -a "$LOG_FILE"
}

# Copy config to writable location (rclone updates token on each refresh)
cp /config/rclone/rclone.conf "$RCLONE_CONFIG"

# Fast incremental: only files modified in last 35 min, no deletion detection
run_fast_sync() {
  log "Starting fast sync (--max-age 12m)..."
  rclone copy gdrive: "$SYNC_DEST" \
    --config "$RCLONE_CONFIG" \
    --max-age 12m \
    --fast-list \
    --transfers 8 \
    --checkers 16 \
    --drive-acknowledge-abuse \
    --ignore-errors \
    --log-level INFO \
    --log-file "$LOG_FILE" \
    --stats 30s \
    --stats-log-level DEBUG \
    && log "Fast sync completed successfully." \
    || log "Fast sync completed with errors — check log above."
}

# Full sync: reconcile all files + soft-delete removed files (runs at midnight)
run_full_sync() {
  log "Starting full sync (reconcile + soft-delete)..."
  rclone sync gdrive: "$SYNC_DEST" \
    --config "$RCLONE_CONFIG" \
    --backup-dir "$DELETED_DIR" \
    --fast-list \
    --transfers 8 \
    --checkers 16 \
    --drive-acknowledge-abuse \
    --ignore-errors \
    --log-level INFO \
    --log-file "$LOG_FILE" \
    --stats 30s \
    --stats-log-level DEBUG \
    && log "Full sync completed successfully." \
    || log "Full sync completed with errors — check log above."
}

# Initial full sync on container start
log "=== gdrive-sync container starting — initial full sync ==="
run_full_sync

# Loop: fast sync every 30 min, full sync at midnight
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
