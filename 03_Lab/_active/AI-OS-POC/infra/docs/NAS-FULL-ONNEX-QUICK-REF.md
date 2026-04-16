# NAS-Full-Onnex — Quick Reference

**Status:** ✅ Live (2026-04-05)  
**Architecture:** Three-layer GDrive → NAS archive → active sync with SYNC_MODE switch

---

## TL;DR

Google Drive has 22 folders (27 GB). Instead of re-downloading from GDrive on every infra change (2-4 hours), we pulled it once to MinIO (`onnex-main`). Now we toggle between:

- **`SYNC_MODE=gdrive`** — Production, syncs live from GDrive (current, takes time)
- **`SYNC_MODE=nas`** — Development, syncs from local NAS instantly (no GDrive needed)

---

## Quick Commands

### Show Current Mode

```bash
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 -o StrictHostKeyChecking=no mrt@100.111.233.126 \
  "sshpass -p 'Poll0000' ssh root@10.10.110.31 'grep SYNC_MODE /opt/agency-ai-os/infra/docker-compose.yml'"
```

### Switch to NAS Mode (Dev/Testing)

```bash
# 1. Edit docker-compose.yml on VM
# Change line ~802: SYNC_MODE=gdrive → SYNC_MODE=nas
#                   NAS_SUBFOLDER=04 Clients (or other folder)

# 2. Restart container
cd /opt/agency-ai-os/infra
docker compose --env-file env/.env up -d --force-recreate rclone-sync

# 3. Verify (should say "NAS mode active")
docker logs rclone-sync --tail 3
```

### Switch to Production (GDrive Mode)

```bash
# 1. Edit docker-compose.yml on VM
# Change line ~802: SYNC_MODE=nas → SYNC_MODE=gdrive

# 2. Restart container
cd /opt/agency-ai-os/infra
docker compose --env-file env/.env up -d --force-recreate rclone-sync

# 3. Verify (should say "GDrive mode active")
docker logs rclone-sync --tail 3
```

### Check Archive Integrity

```bash
# From VM (Agency-POC 10.10.110.31):
cd /opt/agency-ai-os/infra

# List all 22 folders
docker run --rm --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:ro \
  rclone/rclone:latest -c \
  "rclone lsd minio-truenas:onnex-main --config /config/rclone/rclone.conf"

# Verify total size (~27 GB)
docker run --rm --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:ro \
  rclone/rclone:latest -c \
  "rclone size minio-truenas:onnex-main --config /config/rclone/rclone.conf"
```

---

## Google Drive Folder Structure

**Team Drive:** "1 Onnex Main" (ID: `0ADlSo-YFtIREUk9PVA`)

| # | Folder | Size | Status |
|---|--------|------|--------|
| 01 | Archive Onnex Main | — | ✅ In archive |
| 02 | Agents Workflows n8n AI | — | ✅ In archive |
| 03 | Articles AI | — | ✅ In archive |
| **04** | **Clients** | **1.87 GiB, 414 files** | **🟢 Currently synced** |
| 05 | Industries AI | — | ✅ In archive |
| 06 | AI Readiness Audit… | — | ✅ In archive |
| 07 | Sales AI | — | ✅ In archive |
| ... | ... (17 more) | — | ✅ In archive |
| Z | Misc AI | — | ✅ In archive |

---

## MinIO Buckets

| Bucket | Purpose | Size |
|--------|---------|------|
| `gdrive-sync` | Active sync (currently "04 Clients" from GDrive) | 1.87 GiB |
| `onnex-main` | Full "1 Onnex Main" archive (NAS source) | 26.583 GiB |
| `gdrive-deleted` | Soft-delete archive (files deleted from source) | Variable |

---

## Adding New Folders to Sync

**Example: Expand to "07 Sales AI"**

### Option 1: Test in NAS Mode (No GDrive Download)

```bash
# 1. Edit docker-compose.yml (on VM)
#    SYNC_MODE=nas
#    NAS_SUBFOLDER=07 Sales AI

# 2. Restart
docker compose up -d --force-recreate rclone-sync

# 3. Wait ~1 min, files appear in Nextcloud (/GDrive-Sync)
# 4. Test RAG pipeline, document processing, etc.
# 5. Ready to deploy? Switch back to GDrive (production)
```

### Option 2: Go Live in GDrive Mode

After testing in NAS mode:

```bash
# 1. Edit docker-compose.yml
#    SYNC_MODE=gdrive
#    NAS_SUBFOLDER=04 Clients  # or update as needed

# 2. Restart
docker compose up -d --force-recreate rclone-sync

# 3. rclone checksums and syncs delta from GDrive (minimal transfer)
```

---

## Troubleshooting

### "What folders are in the archive?"

```bash
cd /opt/agency-ai-os/infra
docker run --rm --entrypoint /bin/sh \
  -v $(pwd)/rclone/rclone.conf:/config/rclone/rclone.conf:ro \
  rclone/rclone:latest -c \
  "rclone lsd minio-truenas:onnex-main --config /config/rclone/rclone.conf | wc -l"
# Expect: 22 (one line per folder)
```

### "NAS mode not syncing"

Check that `onnex-main` bucket is accessible:

```bash
docker exec rclone-sync rclone lsd minio-truenas:onnex-main --config /config/rclone/rclone.conf
# Expect: 22 folders listed
```

### "Nextcloud showing nothing"

Try re-scanning:

```bash
docker exec nextcloud-app php occ files:scan --path="/ncadmin/files/GDrive-Sync"
```

Or check mount status:

```bash
docker exec nextcloud-app php occ files_external:verify 1
# Expected: status: ok
```

### "Switching modes broke everything"

The active sync bucket (`gdrive-sync`) is re-populated on each mode switch. Just wait for the first sync cycle:

- Fast sync: ~15 min (checks recent files)
- Full sync: ~1 min (NAS) to ~20 min (GDrive)

---

## Files & Documentation

| What | Where |
|------|-------|
| **Full architecture** | `context/NAS-FULL-ONNEX-ARCHITECTURE.md` |
| **Sync procedures** | `infra/docs/gdrive-sync-runbook.md` |
| **sync.sh logic** | `infra/rclone/sync.sh` (SYNC_MODE branching) |
| **Archive pull script** | `infra/rclone/gdrive-archive-pull.sh` |
| **Current status** | `context/current-data.md` → "NAS-Full-Onnex Architecture" |

---

## Contact / Questions

- Implemented: 2026-04-05 by Claude + MrT
- Tested: ✅ NAS mode, ✅ GDrive restoration, ✅ All 22 folders present
- Production status: ✅ LIVE, ready for folder expansion workflows
