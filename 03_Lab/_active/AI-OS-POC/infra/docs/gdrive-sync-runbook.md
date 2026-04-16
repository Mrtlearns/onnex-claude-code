# GDrive-Sync Runbook

> Covers: architecture, normal operation, monitoring, and incident recovery for the Google Drive → MinIO → Nextcloud sync pipeline.
> Updated: 2026-04-05 — added NAS-Full-Onnex archive layer and SYNC_MODE switch.

---

## Architecture

### Three-Layer Model (as of 2026-04-05)

```
Google Drive "1 Onnex Main" (team drive: 0ADlSo-YFtIREUk9PVA)
│
│  [one-time pull — gdrive-archive-pull.sh]
▼
minio-truenas:onnex-main/          ← NAS-Full-Onnex (static archive, ~27 GB)
  ├── 01 Archive Onnex Main/
  ├── 02 Agents Workflows n8n AI/
  ├── 03 Articles AI/
  ├── 04 Clients/                  ← currently active live scope
  ├── 05 Industries AI/
  ├── ... (22 folders total)
  └── Z Misc AI/

SYNC_MODE=gdrive  (default / production):
  gdrive: [root_folder_id=04 Clients] ──────────────────► minio-truenas:gdrive-sync ► Nextcloud
  (live, every 15 min fast / daily full)

SYNC_MODE=nas  (dev / testing / expansion):
  minio-truenas:onnex-main/$NAS_SUBFOLDER ──────────────► minio-truenas:gdrive-sync ► Nextcloud
  (intra-NAS, near-instant, no internet needed)
```

**NAS-Full-Onnex purpose:** Avoid 27 GB re-downloads every time the sync architecture changes. Once populated, use `SYNC_MODE=nas` during development to test folder expansions instantly. Switch back to `SYNC_MODE=gdrive` when ready — rclone diffs checksums, minimal delta transfer.

**Scope (gdrive mode):** `root_folder_id = 1hXUECdNLzSMV2G63qdqwcIz2ybOwZ3Tv` (04 Clients subfolder — NOT the full drive). Current size: ~1.87 GiB, 414 files across 4 project folders.

**Soft-delete:** Full sync uses `--backup-dir minio-truenas:gdrive-deleted` — deleted files move to a separate bucket, never hard-deleted from MinIO.

**RAG hook:** After every full sync (gdrive mode), rclone triggers `POST http://n8n:5678/webhook/nextcloud-rag-autosync` to kick off document re-indexing.

---

## Key Credentials & Locations

| Component | Location | Credential |
|-----------|----------|------------|
| rclone config | `/opt/agency-ai-os/infra/rclone/rclone.conf` on VM | MinIO: `awesomemrt` / `Poll00!!` |
| rclone filters | `/opt/agency-ai-os/infra/rclone/filters.txt` on VM | — |
| rclone sync.sh | `/opt/agency-ai-os/infra/rclone/sync.sh` on VM | — |
| rclone archive script | `/opt/agency-ai-os/infra/rclone/gdrive-archive-pull.sh` on VM | — |
| rclone sync state | Docker volume `agency-ai-os_rclone_state` | — |
| Nextcloud ext storage | occ `files_external:config`, mount ID 1 | Must match rclone: `awesomemrt` / `Poll00!!` |
| MinIO endpoint | `http://10.10.20.30:9000` | TrueNAS Scale MinIO |
| MinIO bucket (active) | `gdrive-sync` | Written by rclone, read by Nextcloud |
| MinIO bucket (archive) | `onnex-main` | NAS-Full-Onnex — written by gdrive-archive-pull.sh |
| MinIO bucket (deleted) | `gdrive-deleted` | Soft-delete destination |
| Nextcloud admin | `http://10.10.110.31:8090` | `ncadmin` / see `.env` |

**CRITICAL:** The Nextcloud external storage credentials (key + secret for mount ID 1) **must always match** the `access_key_id` / `secret_access_key` in `rclone.conf`. If they diverge, the folder will appear empty in Nextcloud with a 503 error.

---

## Normal Operation

### Verify rclone is syncing
```bash
docker logs rclone-sync --tail 20
```
Expected output every 15 min:
```
[timestamp] Starting fast sync (--max-age 12m)...
[timestamp] Fast sync completed successfully.
[timestamp] Scanning Nextcloud external storage for new files...
[timestamp] Nextcloud scan complete.
[timestamp] Sleeping 15 minutes...
```

### Check bucket contents
```bash
docker exec rclone-sync rclone lsd minio-truenas:gdrive-sync \
  --config /config/rclone/rclone.conf
docker exec rclone-sync rclone size minio-truenas:gdrive-sync \
  --config /config/rclone/rclone.conf
```

### Check Nextcloud mount status
```bash
docker exec nextcloud-app php occ files_external:verify 1
```
Expected: `status: ok`

### WebDAV smoke test
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -u "ncadmin:<password>" \
  -X PROPFIND "http://localhost:8090/remote.php/dav/files/ncadmin/GDrive-Sync/" \
  -H "Depth: 1"
```
Expected: `207`

---

---

## NAS-Full-Onnex: One-Time Archive Pull

Run this ONCE to populate `minio-truenas:onnex-main` with the full "1 Onnex Main" Google Drive.
After this, use `SYNC_MODE=nas` for development and testing without re-downloading.

### Run the archive pull

```bash
cd /opt/agency-ai-os/infra
docker run -d --name onnex-archive-pull --restart=no --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:rw \
  -v $(pwd)/rclone/filters.txt:/config/filters.txt:ro \
  -v $(pwd)/rclone/gdrive-archive-pull.sh:/gdrive-archive-pull.sh:ro \
  rclone/rclone:latest /gdrive-archive-pull.sh
```

Monitor progress (safe to close — runs in background):
```bash
docker logs onnex-archive-pull -f
```

Expected runtime: 2–4 hours for ~27 GiB.
The last 1–2 GiB slows to KB/s — Google API throttle on Doc exports. **Do not interrupt at 99%.**
Safe to Ctrl+C and re-run at any point — `rclone copy` is idempotent and resumes.

### Verify archive is complete

```bash
docker run --rm --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:ro \
  rclone/rclone:latest -c \
  "rclone lsd minio-truenas:onnex-main --config /config/rclone/rclone.conf"
# Expect: 22 folders (01 Archive ... Z Misc AI)

docker run --rm --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:ro \
  rclone/rclone:latest -c \
  "rclone size minio-truenas:onnex-main --config /config/rclone/rclone.conf"
# Expect: ~27 GiB
```

---

## SYNC_MODE Switch

### Switch to NAS mode (dev/testing)

Edit `docker-compose.yml` — change `SYNC_MODE=gdrive` to `SYNC_MODE=nas`:
```yaml
environment:
  - SYNC_MODE=nas
  - NAS_SUBFOLDER=04 Clients   # or any other subfolder of onnex-main
```

Then restart the container:
```bash
cd /opt/agency-ai-os/infra
docker compose --env-file env/.env up -d --force-recreate rclone-sync
docker logs rclone-sync --tail 5
# Expect: "NAS mode active — source: minio-truenas:onnex-main/04 Clients"
```

### Switch back to production (gdrive mode)

```bash
# 1. Edit docker-compose.yml → SYNC_MODE=gdrive
# 2. Restart:
docker compose --env-file env/.env up -d --force-recreate rclone-sync
docker logs rclone-sync --tail 5
# Expect: "GDrive mode active — source: Google Drive [gdrive: remote]"
```

### Expanding to new folders (e.g., "07 Sales AI")

1. NAS-Full-Onnex already has it — no download needed
2. Set `SYNC_MODE=nas`, `NAS_SUBFOLDER=07 Sales AI` → restart rclone-sync
3. Test: Nextcloud shows it, RAG pipeline processes it
4. When happy: switch `SYNC_MODE=gdrive` → rclone checksum-diffs, minimal delta transfer

For syncing **multiple folders** simultaneously from NAS:
- Set `NAS_SUBFOLDER=` (empty) to sync entire `onnex-main` to `gdrive-sync`
- Use `filters.txt` include rules to control what's exposed to Nextcloud

---

## Incident: /GDrive-Sync Folder Appears Empty (503 in Nextcloud)

**Symptom:** Nextcloud shows `/GDrive-Sync` as empty or throws an error. `files_external:verify 1` returns `SignatureDoesNotMatch` or `403 Forbidden`.

**Root cause:** The credentials stored in Nextcloud's external storage mount have drifted from the credentials in `rclone.conf`. This happens when:
- MinIO credentials are rotated
- The mount is recreated via `docker-compose down && up` without re-applying credentials
- Nextcloud database is restored from a backup with old credentials

**This exact incident occurred on 2026-04-05** — the mount showed 503, the bucket had 414 files and 1.87 GiB fully synced, but Nextcloud couldn't authenticate.

### Fix

```bash
# Step 1: Confirm rclone can still read the bucket (establishes correct credentials)
docker exec rclone-sync rclone lsd minio-truenas:gdrive-sync \
  --config /config/rclone/rclone.conf

# Step 2: Update Nextcloud external storage credentials
# Use single quotes around the secret to avoid shell expansion of special chars (!, etc.)
docker exec nextcloud-app php occ files_external:config 1 key awesomemrt
docker exec nextcloud-app php occ files_external:config 1 secret 'Poll00!!'

# Step 3: Verify the mount
docker exec nextcloud-app php occ files_external:verify 1
# Expected: status: ok

# Step 4: Re-scan so Nextcloud indexes the files
docker exec nextcloud-app php occ files:scan \
  --path="/ncadmin/files/GDrive-Sync" --output

# Step 5: WebDAV smoke test (expect 207)
curl -s -o /dev/null -w "%{http_code}" \
  -u "ncadmin:<password>" \
  -X PROPFIND "http://localhost:8090/remote.php/dav/files/ncadmin/GDrive-Sync/" \
  -H "Depth: 1"
```

**Important quoting note:** The secret `Poll00!!` contains `!` which bash history-expands. Always wrap in single quotes when passing to `occ` via `docker exec`.

---

## Incident: rclone Token Expired

**Symptom:** `docker logs rclone-sync` shows `401 Unauthorized` from Google Drive.

The `rclone.conf` contains a `refresh_token` which rclone uses to auto-renew. If the refresh token is revoked (Google account security event, token idle >6 months), rclone will fail.

**Fix:**
1. On a machine with a browser, run: `rclone config reconnect gdrive:`
2. Copy the new `token = {...}` line into `/opt/agency-ai-os/infra/rclone/rclone.conf`
3. Restart the container: `docker compose restart rclone-sync`

---

## Incident: gdrive-sync Bucket Missing in MinIO

**Symptom:** `rclone ls minio-truenas:gdrive-sync` returns `bucket does not exist`.

**Fix:**
```bash
# Create bucket via rclone
docker exec rclone-sync rclone mkdir minio-truenas:gdrive-sync \
  --config /config/rclone/rclone.conf

# Trigger a full sync immediately
docker exec rclone-sync /bin/sh -c "cd /data && /config/sync.sh" &
# Or restart the container to re-run the startup full sync:
docker compose restart rclone-sync
```

---

## Preventing Large Sync Scope

The sync is scoped to a single shared drive folder via `root_folder_id` in `rclone.conf`. **Do not remove this** or rclone will attempt to sync the entire Google Drive (>20 GiB).

The `filters.txt` file also excludes: `.DS_Store`, `Thumbs.db`, `desktop.ini`, `*.tmp`, `~$*`, `*.lock`, Apple-specific files.

To add more exclusions: edit `/opt/agency-ai-os/infra/rclone/filters.txt` and restart `rclone-sync`.

---

## Log Location

Persistent sync log: inside `agency-ai-os_rclone_state` volume at `/bisync_state/gdrive-sync.log`.

To tail from the host:
```bash
docker exec rclone-sync tail -f /bisync_state/gdrive-sync.log
```

Log auto-rotates at 100 MB (old log saved as `gdrive-sync.log.old`).
