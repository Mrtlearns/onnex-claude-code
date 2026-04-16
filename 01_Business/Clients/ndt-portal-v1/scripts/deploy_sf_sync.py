#!/usr/bin/env python3
"""
Deploy Salesforce → PostgreSQL sync infrastructure.

Steps:
  1. Run migration 008_sf_sync.sql against the database
  2. Upload sf_sync.py to the API container
  3. Run full Salesforce sync (accounts → jobs → quotes → lines → products → BOM)
  4. Upload bom.ts route + updated index.ts
  5. Recompile TypeScript
  6. Restart API container
  7. Validate: check DB counts + hit /bom/accounts?q=Miller
"""
import io
import json
import os
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


# ── 1. Run database migration ─────────────────────────────────────────────────
print('=== Phase 1: Database migration 008_sf_sync.sql ===')
migration_local = os.path.join(REPO, 'postgres/migrations/008_sf_sync.sql')
upload_file(migration_local, '/tmp/008_sf_sync.sql')

run('docker cp /tmp/008_sf_sync.sql ndt-portal-postgres-1:/tmp/008_sf_sync.sql', timeout=15)
out, err, rc = run(
    'docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -f /tmp/008_sf_sync.sql',
    timeout=60,
)
print(f'  OUT:\n{out}')
if err.strip():
    print(f'  ERR: {err}')
if rc != 0:
    raise RuntimeError(f'Migration failed (rc={rc})')
print('  Migration applied')


# ── 2. Upload sf_sync.py + set up venv on host ───────────────────────────────
print('\n=== Phase 2: Upload sf_sync.py + install psycopg2 in venv ===')
sync_local = os.path.join(HERE, 'sf_sync.py')
upload_file(sync_local, '/tmp/sf_sync.py')

out, err, rc = run(
    'pip3 install psycopg2-binary --break-system-packages --quiet 2>&1',
    timeout=120,
)
if rc != 0:
    print(f'  ERR pip: {out[-300:]} {err[-300:]}')
    raise RuntimeError(f'psycopg2 install failed (rc={rc})')
print('  sf_sync.py uploaded, psycopg2-binary installed')


# ── 3. Full Salesforce sync ───────────────────────────────────────────────────
print('\n=== Phase 3: Full Salesforce sync (this may take 5-15 minutes) ===')
# Run on the host — PGHOST=localhost because postgres is exposed on host:5432
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
out, err, rc = run(
    f'{SF_ENV} python3 /tmp/sf_sync.py --mode full 2>&1',
    timeout=900,
)
print(f'  OUT (last 1500):\n{out[-1500:]}')
if rc != 0:
    print(f'  ERR: {err[-500:]}')
    raise RuntimeError(f'SF sync failed (rc={rc})')
print('  Sync complete')


# ── 4. Upload API route files ─────────────────────────────────────────────────
print('\n=== Phase 4: Upload BOM route + updated index.ts ===')

route_files = [
    (
        os.path.join(REPO, 'api/src/routes/bom.ts'),
        '/opt/ndt-portal/api/src/routes/bom.ts',
    ),
    (
        os.path.join(REPO, 'api/src/index.ts'),
        '/opt/ndt-portal/api/src/index.ts',
    ),
]

for local_path, remote_path in route_files:
    upload_file(local_path, remote_path)
    print(f'  Uploaded: {os.path.basename(local_path)}')


# ── 5. Recompile TypeScript on the host ──────────────────────────────────────
# dist/ is bind-mounted from host into the container (read-only), so we compile
# on the host using the local node_modules, then restart the container.
print('\n=== Phase 5: Recompile TypeScript (on host) ===')
out, err, rc = run(
    'cd /opt/ndt-portal/api && ./node_modules/.bin/tsc 2>&1',
    timeout=120,
)
print(f'  TSC OUT: {out[-500:]}')
if rc != 0:
    print(f'  TSC ERR: {err[-300:]}')
    raise RuntimeError(f'TypeScript compile failed (rc={rc})')
print('  Compiled successfully')


# ── 6. Restart API container ──────────────────────────────────────────────────
print('\n=== Phase 6: Restart API container ===')
out, err, rc = run(
    'cd /opt/ndt-portal && docker compose restart api 2>&1',
    timeout=60,
)
print(f'  {out.strip()}')
if rc != 0:
    raise RuntimeError(f'Restart failed (rc={rc})')

# Wait for API to be healthy
import time
time.sleep(5)
out, err, rc = run(
    'docker exec ndt-portal-api-1 curl -s http://localhost:3100/health 2>&1',
    timeout=15,
)
print(f'  Health check: {out.strip()}')


# ── 7. Validate ───────────────────────────────────────────────────────────────
print('\n=== Phase 7: Validation ===')

# DB counts
count_query = """
docker exec ndt-portal-postgres-1 psql -U ndtapp -d ndtportal -t -c "
  SELECT 'accounts'   || ': ' || count(*) FROM sf.accounts
  UNION ALL
  SELECT 'jobs'       || ': ' || count(*) FROM sf.jobs
  UNION ALL
  SELECT 'quotes'     || ': ' || count(*) FROM sf.quotes
  UNION ALL
  SELECT 'quote_lines'|| ': ' || count(*) FROM sf.quote_lines
  UNION ALL
  SELECT 'bom_parts'  || ': ' || count(*) FROM sf.bom_parts
  UNION ALL
  SELECT 'jobs_with_parts: ' || count(*) FROM sf.jobs WHERE part_number IS NOT NULL;
"
"""
out, err, rc = run(count_query, timeout=30)
print(f'  DB counts:\n{out}')

# API endpoint check
out, err, rc = run(
    'curl -s "http://localhost:3100/bom/accounts?q=Miller" 2>&1',
    timeout=15,
)
try:
    parsed = json.loads(out)
    accts  = parsed.get('accounts', [])
    print(f'  /bom/accounts?q=Miller → {len(accts)} result(s)')
    if accts:
        print(f'    First: {accts[0].get("name")} (jobs: {accts[0].get("job_count")})')
except Exception:
    print(f'  /bom/accounts response: {out[:300]}')

ssh.close()
print('\n=== Deploy complete ===')
print('Verify:')
print('  1. GET /bom/accounts?q=Miller     — customer search')
print('  2. GET /bom/parts?q=6061          — part number search')
print('  3. GET /bom/parts/80635/history   — job history for part')
print('  4. GET /bom/accounts/:sfId/parts  — all parts for a customer')
