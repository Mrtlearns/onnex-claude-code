# poc-backend Access — Lean Success Path

> This file is part of the template. It gets copied into every new POC workspace.
> It documents the exact working patterns for connecting to poc-backend (10.10.110.34)
> from Windows/Claude Code. Errors stripped — follow this exactly.
>
> **Derived from:** Knowledge Universe (personal-to-do) POC build, 2026-03-30

---

## 1. SSH — Use Paramiko Only

SSH keys at `/opt/claude-workspace/keys/claude-controller-key` are NOT accessible from Windows.
Root login is disabled. `sshpass` not available. **Use Python paramiko exclusively.**

```python
# Check/install
python3 -c "import paramiko; print('ok')"
python3 -m pip install paramiko -q  # if missing

# Standard connection
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.34', username='mrt', password=os.environ['VM_SSH_PASSWORD'])

_, stdout, stderr = client.exec_command('your command here', timeout=60)
print(stdout.read().decode('utf-8', errors='replace'))
client.close()
```

### Unicode output — always decode with errors='replace'
Docker/Ansible output contains Unicode (✓, ▲, etc.) that crashes Windows terminal (cp1252).
```python
out = stdout.read().decode('utf-8', errors='replace')  # never .decode('ascii') for docker output
```
Also append `2>&1 | cat` to Bash tool commands.

### Sudo
```python
sudo_pw = os.environ['VM_SSH_PASSWORD']
client.exec_command(f'echo {sudo_pw} | sudo -S <command>')
```

---

## 2. SFTP — Copy Files to Server

```python
# mrt cannot write to /opt/ — create and chown first:
sudo_pw = os.environ['VM_SSH_PASSWORD']
client.exec_command(
    f'echo {sudo_pw} | sudo -S mkdir -p /opt/pocs/<name> && '
    f'echo {sudo_pw} | sudo -S chown -R mrt:mrt /opt/pocs'
)

# Then SFTP works normally
sftp = client.open_sftp()
sftp.put('local/path/file.txt', '/opt/pocs/<name>/file.txt')

# Recursive copy helper (skip node_modules, .next, .git)
SKIP_DIRS = {'node_modules', '.next', '.git', '__pycache__'}

def sftp_mkdir_p(sftp, path):
    parts = [p for p in path.split('/') if p]
    cur = ''
    for p in parts:
        cur = cur + '/' + p
        try:
            sftp.stat(cur)
        except FileNotFoundError:
            try: sftp.mkdir(cur)
            except: pass

import os
for dirpath, dirnames, filenames in os.walk(LOCAL_ROOT):
    dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
    rel = os.path.relpath(dirpath, LOCAL_ROOT).replace(chr(92), '/')
    remote_dir = REMOTE_ROOT if rel == '.' else REMOTE_ROOT + '/' + rel
    sftp_mkdir_p(sftp, remote_dir)
    for fname in filenames:
        sftp.put(os.path.join(dirpath, fname), remote_dir + '/' + fname)
```

---

## 3. Postgres Connectivity — The Critical Rules

### Port map on 10.10.110.34
| Port | What | Use? |
|------|------|------|
| `5432` | **Supavisor** (pooler) | ❌ Fails: `"Tenant or user not found"` — tenant ID is unset placeholder |
| `6543` | Supavisor transaction mode | ❌ Same failure |
| `supabase-db:5432` | Direct Postgres (Docker hostname) | ✅ Always works |

### NEVER use `10.10.110.34:5432` as DATABASE_URL
```
# ❌ WRONG — goes through Supavisor, will fail
DATABASE_URL=postgresql://supabase_admin:<pw>@10.10.110.34:5432/postgres

# ✅ CORRECT — direct Postgres via Docker hostname
DATABASE_URL=postgresql://supabase_admin:<pw>@supabase-db:5432/postgres
```

### docker-compose.yml — app must join supabase_default network
```yaml
services:
  app:
    networks:
      - poc-net          # Traefik routing
      - supabase_default # Direct Postgres access

networks:
  poc-net:
    external: true
  supabase_default:
    external: true
```

### Migrations — pipe SQL via stdin
```python
sql = open('db/migrations/0001_init.sql').read()
stdin, stdout, stderr = client.exec_command(
    'docker exec -i supabase-db psql -U supabase_admin -d postgres'
)
stdin.write(sql)
stdin.channel.shutdown_write()
print(stdout.read().decode())
# "NOTICE: schema already exists" is fine — not an error
```

### Seeds — run in temporary container on supabase_default
Node.js is NOT installed on the Ubuntu host. Never `npm run seed` directly on the server.
```python
cmd = (
    'docker run --rm '
    '--network supabase_default '
    '-v /opt/pocs/<name>:/app '
    '-w /app '
    '-e DATABASE_URL="postgresql://supabase_admin:<pw>@supabase-db:5432/postgres" '
    'node:20-alpine '
    'sh -c "npx tsx scripts/seed.ts" 2>&1'
)
_, stdout, _ = client.exec_command(cmd, timeout=120)
print(stdout.read().decode('utf-8', errors='replace'))
```

---

## 4. Fetch Supabase Keys

```python
_, stdout, _ = client.exec_command(
    "grep -E '^(ANON_KEY|SERVICE_ROLE_KEY|POSTGRES_PASSWORD)=' /opt/stacks/supabase/.env"
)
print(stdout.read().decode())
```

---

## 5. Docker on poc-backend

### Port 3000 is taken — always check first
```python
_, stdout, _ = client.exec_command('docker ps --format "{{.Names}}\t{{.Ports}}"')
```
Supabase Studio owns 3000. **Start POC apps at 3100+.**

### Updating Traefik route port
Re-call the provisioning API — it overwrites cleanly (no Traefik restart needed):
```bash
curl -s -X POST http://10.10.30.40:5000/api/v2/provision/app \
  -H 'Content-Type: application/json' \
  -d '{"name":"<name>","needs_db":false,"route":{"enabled":true,"visibility":"internal","port":<new_port>}}'
```

### Dockerfile — no public/ directory
```dockerfile
# ❌ Fails if public/ doesn't exist (common with Next.js standalone):
COPY --from=builder /app/public ./public

# ✅ Safe:
RUN mkdir -p ./public
```

### docker-compose.yml — remove version attribute
```yaml
# ❌ Causes "attribute version is obsolete" warning:
version: '3.8'
services: ...

# ✅ Omit it:
services: ...
```

---

## 6. Next.js Middleware — API Routes Must Return 401, Not Redirect

```typescript
if (!session) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Only redirect UI routes
  return NextResponse.redirect(new URL('/login', req.url))
}
```
If API routes redirect to `/login`, the frontend silently gets an HTML page instead of JSON,
and shows 0 data with no visible error.

---

## 7. Complete Lean Sequence (App Path)

```
1. pip install paramiko
2. POST /api/v2/provision/app → stream job → capture schema/bucket/route_url
3. Check docker ps for port conflicts (avoid 3000)
4. paramiko: grep ANON_KEY + SERVICE_ROLE_KEY + POSTGRES_PASSWORD from /opt/stacks/supabase/.env
5. Write .env with DATABASE_URL=postgresql://...@supabase-db:5432/postgres
6. Write docker-compose.yml with supabase_default + poc-net networks
7. paramiko: sudo mkdir /opt/pocs/<name> + chown mrt
8. paramiko SFTP: copy all project files (skip node_modules/.next/.git)
9. paramiko: pipe migration SQL → docker exec -i supabase-db psql
10. paramiko: docker compose up -d --build
11. paramiko: docker run --rm --network supabase_default ... npx tsx scripts/seed.ts
12. paramiko: curl localhost:<port> → expect 2xx/3xx
```
