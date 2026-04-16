#!/usr/bin/env python3
"""
Deploy Admin panel + sf_sync optimization.

Steps:
  1. Run migration 009_job_runs.sql
  2. Upload updated sf_sync.py (truly incremental, job_runs integration)
  3. Upload API route files (admin.ts + updated index.ts)
  4. Recompile TypeScript
  5. Build frontend
  6. Restart API + frontend containers
  7. Timed incremental sync test
  8. Validate: GET /admin/jobs returns the test run
"""
import io
import json
import os
import time
import urllib.request
import paramiko

HERE   = os.path.dirname(os.path.abspath(__file__))
REPO   = os.path.join(HERE, '..')
SERVER = '10.10.110.32'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(SERVER, username='root', password='Poll0000',
            timeout=10, look_for_keys=False, allow_agent=False)
ssh.get_transport().set_keepalive(30)


def run(cmd, timeout=300):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    rc  = stdout.channel.recv_exit_status()
    return out, err, rc


def upload_file(local_path: str, remote_path: str):
    sftp = ssh.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()


def upload_bytes(data: bytes, remote_path: str):
    sftp = ssh.open_sftp()
    sftp.putfo(io.BytesIO(data), remote_path)
    sftp.close()


# ── 1. Database migration ─────────────────────────────────────────────────────
print('=== Phase 1: Database migration 009_job_runs.sql ===')
migration_local = os.path.join(REPO, 'postgres/migrations/009_job_runs.sql')
upload_file(migration_local, '/tmp/009_job_runs.sql')

run('docker cp /tmp/009_job_runs.sql ndt-portal-postgres-1:/tmp/009_job_runs.sql', timeout=15)
out, err, rc = run(
    'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -f /tmp/009_job_runs.sql',
    timeout=60,
)
print(f'  OUT:\n{out}')
if err.strip():
    print(f'  ERR: {err}')
if rc != 0:
    raise RuntimeError(f'Migration failed (rc={rc})')
print('  Migration applied')

# Verify table exists
out, err, rc = run(
    'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -t -c '
    '"SELECT count(*) FROM app.job_runs;"',
    timeout=15,
)
print(f'  app.job_runs row count: {out.strip()}')


# ── 2. Upload sf_sync.py ──────────────────────────────────────────────────────
print('\n=== Phase 2: Upload updated sf_sync.py ===')
sync_local = os.path.join(HERE, 'sf_sync.py')
upload_file(sync_local, '/tmp/sf_sync.py')
upload_file(sync_local, '/opt/ndt-portal/sf_sync.py')
print('  sf_sync.py uploaded to /tmp/ and /opt/ndt-portal/')


# ── 3. Upload API route files ─────────────────────────────────────────────────
print('\n=== Phase 3: Upload admin.ts route + updated index.ts ===')

route_files = [
    (
        os.path.join(REPO, 'api/src/routes/admin.ts'),
        '/opt/ndt-portal/api/src/routes/admin.ts',
    ),
    (
        os.path.join(REPO, 'api/src/index.ts'),
        '/opt/ndt-portal/api/src/index.ts',
    ),
]

for local_path, remote_path in route_files:
    upload_file(local_path, remote_path)
    print(f'  Uploaded: {os.path.basename(local_path)}')


# ── 4. Recompile TypeScript ───────────────────────────────────────────────────
print('\n=== Phase 4: Recompile TypeScript (on host) ===')
out, err, rc = run(
    'cd /opt/ndt-portal/api && ./node_modules/.bin/tsc 2>&1',
    timeout=120,
)
print(f'  TSC OUT: {out[-500:]}')
if rc != 0:
    print(f'  TSC ERR: {err[-300:]}')
    raise RuntimeError(f'TypeScript compile failed (rc={rc})')
print('  Compiled successfully')


# ── 5. Build frontend ─────────────────────────────────────────────────────────
print('\n=== Phase 5: Build frontend ===')

# Upload changed frontend files
frontend_files = [
    (
        os.path.join(REPO, 'frontend/src/App.tsx'),
        '/opt/ndt-portal/frontend/src/App.tsx',
    ),
    (
        os.path.join(REPO, 'frontend/src/components/layout/Sidebar.tsx'),
        '/opt/ndt-portal/frontend/src/components/layout/Sidebar.tsx',
    ),
    (
        os.path.join(REPO, 'frontend/src/components/layout/Topbar.tsx'),
        '/opt/ndt-portal/frontend/src/components/layout/Topbar.tsx',
    ),
    (
        os.path.join(REPO, 'frontend/src/components/admin/AdminApp.tsx'),
        '/opt/ndt-portal/frontend/src/components/admin/AdminApp.tsx',
    ),
    (
        os.path.join(REPO, 'frontend/src/components/admin/JobsTab.tsx'),
        '/opt/ndt-portal/frontend/src/components/admin/JobsTab.tsx',
    ),
]

# Ensure admin dir exists
run('mkdir -p /opt/ndt-portal/frontend/src/components/admin', timeout=10)

for local_path, remote_path in frontend_files:
    upload_file(local_path, remote_path)
    print(f'  Uploaded: {os.path.basename(local_path)}')

out, err, rc = run(
    'cd /opt/ndt-portal/frontend && npm run build 2>&1',
    timeout=300,
)
out_safe = out[-500:].encode('ascii', errors='replace').decode('ascii')
print(f'  Build OUT (last 500): {out_safe}')
if rc != 0:
    err_safe = err[-300:].encode('ascii', errors='replace').decode('ascii')
    print(f'  Build ERR: {err_safe}')
    raise RuntimeError(f'Frontend build failed (rc={rc})')
print('  Frontend built successfully')


# ── 6. Restart containers ─────────────────────────────────────────────────────
print('\n=== Phase 6: Restart API + frontend containers ===')
out, err, rc = run(
    'cd /opt/ndt-portal && docker compose restart api nginx 2>&1',
    timeout=60,
)
print(f'  {out.strip()}')
if rc != 0:
    raise RuntimeError(f'Restart failed (rc={rc})')

time.sleep(5)
out, err, rc = run(
    'docker exec ndt-portal-api-1 curl -s http://localhost:3100/health 2>&1',
    timeout=15,
)
print(f'  Health check: {out.strip()}')


# ── 7. Timed incremental sync test ────────────────────────────────────────────
print('\n=== Phase 7: Timed incremental sync test ===')
SF_ENV = (
    'PGHOST=localhost '
    'PGPORT=5432 '
    'PGDATABASE=ndtportal '
    'PGUSER=ndtapp '
    'PGPASSWORD="Ndt@P0rtal2026!" '
    'SF_INSTANCE_URL="https://ndt.my.salesforce.com" '
    'SF_CLIENT_ID="3MVG98XJQQAccJQfALhpE_TXrxUXql2ZMFlON2paJKn.tQppNon5kbrweTHjT_KNf_Jm9dUNwEDHNhk85HTEM" '
    'SF_CLIENT_SECRET="F97AFD02A8765E085364E8BAC38A24F0124F7D45BF2AE055950F2AEC42B7D41F"'
)
t0 = time.time()
out, err, rc = run(
    f'{SF_ENV} python3 /tmp/sf_sync.py --mode incremental 2>&1',
    timeout=120,
)
elapsed = time.time() - t0
print(f'  Elapsed: {elapsed:.1f}s')
print(f'  OUT (last 1000):\n{out[-1000:]}')
if rc != 0:
    print(f'  ERR: {err[-300:]}')
    raise RuntimeError(f'Incremental sync failed (rc={rc})')
print(f'  Sync complete in {elapsed:.1f}s (target < 10s)')


# ── 8. Validate ───────────────────────────────────────────────────────────────
print('\n=== Phase 8: Validation ===')

# Check job_runs row
out, err, rc = run(
    'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -t -c '
    '"SELECT id, status, duration_ms, records_upserted FROM app.job_runs '
    'ORDER BY started_at DESC LIMIT 3;"',
    timeout=15,
)
print(f'  Recent job_runs:\n{out}')

# Hit admin API
time.sleep(2)
out, err, rc = run(
    'curl -s "http://localhost:3100/admin/jobs?limit=5" 2>&1',
    timeout=15,
)
try:
    parsed = json.loads(out)
    runs = parsed.get('runs', [])
    print(f'  GET /admin/jobs → total={parsed.get("total")}, first={runs[0] if runs else None}')
except Exception:
    print(f'  /admin/jobs response: {out[:500]}')

ssh.close()
print('\n=== Deploy complete ===')
print('Verify:')
print('  1. Navigate to /admin in the portal')
print('  2. Jobs tab shows run history with status, duration, records')
print('  3. Click a row to expand full detail')
print(f'  4. Last incremental sync completed in {elapsed:.1f}s')
