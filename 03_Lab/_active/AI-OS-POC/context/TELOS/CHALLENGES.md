# Challenges

## C1: No Formal Test Coverage / VALIDATION.md
- **Impact:** No single document defines what "done" looks like — hard to hand off or demo with confidence
- **Approach:** Create VALIDATION.md as part of v3.0. Use TDD for all new phases to enforce coverage discipline.
- **Strategy ref:** S1

## C2: Phase 11 Has No Plan
- **Impact:** Reports and Admin are high-visibility modules for demos — starting without a clear spec risks scope creep
- **Approach:** Run `/gsd:plan-phase` or `/generate-prp` before any implementation begins
- **Strategy ref:** S2

## C3: Kanban DnD Is UI-Only
- **Impact:** Task drag-and-drop changes don't persist — dealbreaker for live demos
- **Approach:** Scheduled for v3.0 — add PATCH endpoint + optimistic update in React Query
- **Strategy ref:** S3

## C4: Invoice PDF + SMTP Not Wired
- **Impact:** Invoice module exists but can't actually deliver invoices to clients
- **Approach:** Scheduled for v3.0 — pdf-lib + Nodemailer with SMTP config in settings panel
- **Strategy ref:** S3

## C5: Stray Files and Planning Docs Gap ✅ RESOLVED 2026-04-05
- **Impact:** Project root accumulates working scripts; planning dirs are empty; hard to orient quickly
- **Resolution:** `/cleanup` run — removed `tmp/` (176 files), moved `patch_*.py` → `scripts/`, removed `web_*.txt`. TELOS + `context/current-data.md` created.
- **Going forward:** Run `/cleanup` after each phase. Keep TELOS and current-data.md current.

## C6: GDrive-Sync Credential Drift ✅ RESOLVED 2026-04-05
- **Impact:** Nextcloud `/GDrive-Sync` shows empty (503) when Nextcloud external storage credentials diverge from `rclone.conf`. This is silent — rclone continues syncing successfully but Nextcloud can't read the bucket.
- **Resolution:** Updated Nextcloud mount ID 1 credentials to match `rclone.conf` (`awesomemrt`/`Poll00!!`). Full runbook at `infra/docs/gdrive-sync-runbook.md`.
- **Going forward:** Whenever MinIO credentials are rotated, update BOTH `rclone.conf` AND the Nextcloud external storage mount in the same operation. Never rotate one without the other.
