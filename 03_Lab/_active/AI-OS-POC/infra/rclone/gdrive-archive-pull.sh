#!/bin/sh
# ONE-TIME PULL: Google Drive "1 Onnex Main" -> minio-truenas:onnex-main (NAS-Full-Onnex)
#
# Purpose: Build a local NAS mirror of the full 1 Onnex Main drive (~27 GB+).
#          Used as a fast seeding source during sync architecture development.
#          After this runs once, use SYNC_MODE=nas to source from NAS instead of GDrive.
#
# Run via (from /opt/agency-ai-os/infra):
#   docker run --rm --entrypoint /bin/sh \
#     -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:rw \
#     -v $(pwd)/rclone/filters.txt:/config/filters.txt:ro \
#     -v $(pwd)/rclone/gdrive-archive-pull.sh:/gdrive-archive-pull.sh:ro \
#     rclone/rclone:latest /gdrive-archive-pull.sh
#
# Or run via the detached container name (persists logs):
#   docker run -d --name onnex-archive-pull --restart=no --entrypoint /bin/sh \
#     -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:rw \
#     -v $(pwd)/rclone/filters.txt:/config/filters.txt:ro \
#     -v $(pwd)/rclone/gdrive-archive-pull.sh:/gdrive-archive-pull.sh:ro \
#     rclone/rclone:latest /gdrive-archive-pull.sh
#
# Monitor progress:
#   docker logs onnex-archive-pull -f
#
# Safe to interrupt and re-run -- rclone copy resumes from where it stopped.
# Expected runtime: 2-4 hours for ~27 GiB.
#
# NOTE: The last 1-2 GiB will slow to KB/s -- Google Drive API throttling
# bulk exports of Google Docs/Sheets. It is expected. Do not kill and restart at 99%.
#
# "device or resource busy" errors on rclone.conf are harmless -- rclone-sync container
# also holds the file open. The sync proceeds successfully regardless.

DEST="minio-truenas:onnex-main"
CONFIG="/config/rclone/rclone.conf"

echo "[$(date -Iseconds)] === NAS-Full-Onnex: Starting archive pull to $DEST ==="
echo "[$(date -Iseconds)] Expected runtime: 2-4 hours. Safe to Ctrl+C and re-run."
echo "[$(date -Iseconds)] Last 1-2 GiB will slow to KB/s -- Google API throttle on Doc exports. Normal."
echo ""

rclone copy gdrive-root: "$DEST" \
  --config "$CONFIG" \
  --filter-from /config/filters.txt \
  --transfers 4 \
  --checkers 8 \
  --tpslimit 10 \
  --tpslimit-burst 20 \
  --retries 5 \
  --low-level-retries 10 \
  --drive-acknowledge-abuse \
  --ignore-errors \
  --progress \
  --stats 60s \
  --log-level INFO

echo ""
echo "[$(date -Iseconds)] === Archive pull complete. Verifying... ==="
rclone size "$DEST" --config "$CONFIG"
echo "[$(date -Iseconds)] Done. NAS-Full-Onnex is ready for SYNC_MODE=nas use."
