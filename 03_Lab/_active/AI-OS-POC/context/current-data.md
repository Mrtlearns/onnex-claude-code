# Current Data — AI-OS-POC

> Last Updated: 2026-04-06 (session: NAS-Full-Onnex fully implemented, tested, and documented)
> Update this after each phase completion or major deployment.

---

## Build Status

| Metric | Value |
|--------|-------|
| Current version | v2.0 complete |
| Total commits | 62 |
| Phases complete | 01–10 |
| Active phase | 11 (not started) |
| Next version | v3.0 (production hardening) |

---

## Modules

| Module | API Routes | UI | Tests | Status |
|--------|-----------|-----|-------|--------|
| Clients | clients.ts | ✅ | ✅ | Done |
| Contacts | contacts.ts | ✅ | ✅ | Done |
| Projects | projects.ts | ✅ | ✅ | Done |
| Tasks | tasks.ts | ✅ kanban+list | ✅ | Done |
| Deals | deals.ts | ✅ pipeline kanban | ✅ | Done |
| Invoices | invoices.ts | ✅ | ✅ | Done (PDF+SMTP pending v3.0) |
| Time Tracking | time-entries.ts | ✅ timer+sheet | ✅ | Done |
| Documents | documents.ts | ✅ | — | Done (Paperless sync) |
| AI Assistant | memory.ts | ✅ | — | Stub |
| Portal | embed.ts | ✅ | — | Stub |
| Reports | — | stub | — | Phase 11 |
| Admin | — | stub | — | Phase 11 |
| Settings | — | ✅ | — | Done |
| Notifications | — | stub | — | Planned |

---

## Test Coverage

| Suite | Location | Status |
|-------|----------|--------|
| API unit tests | `apps/api/src/__tests__/` | ✅ 62 tests GREEN |
| Web unit tests | `apps/web/src/` | ✅ component tests |
| E2E (Playwright) | `apps/web/e2e/tests/` | 17 suites, 6 auth states |

---

## Deployment

| Item | Value |
|------|-------|
| VM | Proxmox Agency-POC `10.10.110.31` |
| Jump host | `claude-controller` `100.111.233.126` (Tailscale) |
| Frontend | `http://10.10.110.31:3002` |
| API | `http://10.10.110.31:3001` |
| Compose file | `/opt/agency-ai-os/infra/docker-compose.yml` |
| External domain | `agencyos-v1.on-nex.us` (v3.0+) |

---

## Infrastructure Status

| Service | Status | Notes |
|---------|--------|-------|
| rclone-sync | ✅ Running | SYNC_MODE=gdrive (production). Fast sync every 15 min, full sync daily midnight. 414 files / 1.87 GiB |
| GDrive-Sync (Nextcloud mount) | ✅ Fixed 2026-04-05 | Was showing empty due to credential mismatch. Runbook: `infra/docs/gdrive-sync-runbook.md` |
| MinIO TrueNAS (10.10.20.30:9000) | ✅ Reachable | Buckets: `gdrive-sync`, `gdrive-deleted`, `onnex-main`. Credentials: see `.env` MINIO_SYNC_* |
| Nextcloud ext storage mount ID 1 | ✅ Verified | Key: `awesomemrt` — must match `rclone.conf` always |
| NAS-Full-Onnex (onnex-main bucket) | 🔄 Pulling 2026-04-05 | One-time archive pull of full "1 Onnex Main" (~27 GB, 22 folders) running as `onnex-archive-pull` container. ETA 2-4h. |
| .claude/settings.json | ✅ Fixed 2026-04-05 | Was invalid JSON (smart quotes). Now uses proper escaped ASCII quotes |

---

## NAS-Full-Onnex Architecture (Implemented 2026-04-05)

### Purpose
Avoid 27 GB re-downloads from Google Drive every time sync architecture changes. One-time pull creates a local NAS mirror, enabling instant testing of folder expansions and infrastructure changes via `SYNC_MODE` switch.

### Current State

| Component | Status | Details |
|-----------|--------|---------|
| **Google Drive** | ✅ Source | Team drive "1 Onnex Main" (0ADlSo-YFtIREUk9PVA) — 22 folders, 9,950 files, ~27 GB |
| **NAS-Full-Onnex Archive** | ✅ Complete | MinIO bucket `onnex-main`: 9,950 files, 26.583 GiB. Pulled 2026-04-05 in 1h 21m 27s |
| **SYNC_MODE=gdrive** | ✅ Active | Production mode. Live sync from "04 Clients" folder (1.87 GiB, 414 files). Daily full + 15-min fast |
| **SYNC_MODE=nas** | ✅ Tested | Dev/testing mode. Syncs from `onnex-main/$NAS_SUBFOLDER` instantly (intra-NAS). Verified 2026-04-05 |
| **Nextcloud Mount** | ✅ Works | WebDAV mount `/GDrive-Sync` reads from active `gdrive-sync` bucket. Status: OK in both modes |

### Folder Expansion Workflow

To add new folders (e.g., "07 Sales AI" to live sync):

1. Edit `docker-compose.yml` → set `SYNC_MODE=nas`, `NAS_SUBFOLDER=07 Sales AI`
2. Restart: `docker compose up -d --force-recreate rclone-sync`
3. Test: Files appear in Nextcloud, RAG pipeline works (locally, no GDrive needed)
4. Restore production: `SYNC_MODE=gdrive` → rclone checksum-diffs, minimal delta transfer from GDrive

### Documentation

- **Full architecture & design:** `context/NAS-FULL-ONNEX-ARCHITECTURE.md`
- **Procedures & incidents:** `infra/docs/gdrive-sync-runbook.md`
- **Scripts:** `infra/rclone/sync.sh` (SYNC_MODE logic), `infra/rclone/gdrive-archive-pull.sh` (one-time pull)

### Test Results (2026-04-05)

- Archive pull: ✅ 1h 21m 27s, 9,950 files, 26.583 GiB
- NAS mode: ✅ Source verified, sync working, Nextcloud mount OK
- GDrive restore: ✅ Switched back to production, live sync active

---

## v3.0 Checklist

- [ ] Traefik TLS for all services
- [ ] Authentik full browser E2E test
- [ ] VALIDATION.md + formal test coverage matrix
- [ ] Kanban DnD persistence
- [ ] Invoice PDF + SMTP delivery
- [ ] Performance profiling + bundle optimization
- [ ] Demo environment automation script
- [ ] `/promote` to GitLab
