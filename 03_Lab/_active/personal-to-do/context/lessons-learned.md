# Lessons Learned — Knowledge Universe POC Build

> 2026-03-30. All errors hit during initial build. Read this before touching anything on poc-backend.

---

## 1. Supabase Postgres — Supavisor vs Direct

**The #1 gotcha. Will waste your time if ignored.**

Port `5432` on `10.10.110.34` is **Supavisor** (connection pooler), NOT direct Postgres.
Supavisor requires `username.tenant_id` format. The tenant_id in this stack is the placeholder
`your-tenant-id` (never configured). Result: every connection attempt fails with:

```
PostgresError: Tenant or user not found
```

### Fix
- App containers: join `supabase_default` Docker network, use `supabase-db:5432` as host
- Seeds/migrations outside container: `docker run --rm --network supabase_default ...`
- Never put `10.10.110.34:5432` or `10.10.110.34:6543` in `DATABASE_URL`

### Correct DATABASE_URL
```
postgresql://supabase_admin:<POSTGRES_PASSWORD>@supabase-db:5432/postgres
```

---

## 2. Docker Network — Must Join supabase_default

The app container starts on `poc-net` (for Traefik). But `supabase-db` is only on `supabase_default`.
If you only join `poc-net`, the container can't reach the DB.

### Fix in docker-compose.yml
```yaml
services:
  app:
    networks:
      - poc-net
      - supabase_default

networks:
  poc-net:
    external: true
  supabase_default:
    external: true
```

---

## 3. Port 3000 Is Taken by Supabase Studio

Always check before picking a port:
```python
_, stdout, _ = client.exec_command('docker ps --format "{{.Names}}\t{{.Ports}}"')
```
Start POC apps at **3100+**.

If you picked the wrong port, update the Traefik route by re-calling the provisioning API:
```bash
curl -s -X POST http://10.10.30.40:5000/api/v2/provision/app \
  -H 'Content-Type: application/json' \
  -d '{"name":"personal-to-do","needs_db":false,"route":{"enabled":true,"visibility":"internal","port":3100}}'
```
No restart of anything needed — Traefik hot-reloads the config file.

---

## 4. Middleware Must Return 401 JSON for API Routes

The initial middleware redirected ALL unauthenticated requests to `/login` — including API calls.
This silently caused the app to show 0 nodes (the fetch was redirected, not erroring).

### Fix
```typescript
if (!session) {
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // redirect UI routes to login
  return NextResponse.redirect(loginUrl)
}
```

---

## 5. Dockerfile — No public/ Directory

Next.js standalone builds don't require a `public/` directory. If one doesn't exist in the project,
this line fails:
```dockerfile
COPY --from=builder /app/public ./public  # ❌ fails if /app/public doesn't exist
```

### Fix
```dockerfile
RUN mkdir -p ./public  # ✅ always succeeds
```

---

## 6. SSH from Windows — Paramiko Only

- SSH keys at `/opt/claude-workspace/keys/claude-controller-key` are NOT accessible from Windows
- Root login is disabled (`root@10.10.110.34` → `Authentication failed`)
- `sshpass` not available on Windows

### Correct pattern
```python
import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.34', username='mrt', password='Poll0000')
```

Install if needed: `python3 -m pip install paramiko -q`

---

## 7. Unicode in Docker/Ansible Output Crashes Windows Terminal

Docker build logs and Ansible output contain Unicode (✓, ▲, etc.).
Windows terminal (cp1252) raises `UnicodeEncodeError` when printing these.

### Fix — always decode with errors='replace'
```python
out = stdout.read().decode('utf-8', errors='replace')
```
Also append `2>&1 | cat` to Bash tool commands to prevent the shell from crashing.

---

## 8. mrt Cannot Write to /opt/ Directly

SFTP put to `/opt/pocs/<name>/` will fail with `PermissionError: [Errno 13]` if the directory
doesn't exist yet.

### Fix — create and chown before SFTP
```python
client.exec_command(
    'echo Poll0000 | sudo -S mkdir -p /opt/pocs/<name> && '
    'echo Poll0000 | sudo -S chown -R mrt:mrt /opt/pocs'
)
```
After this, SFTP works normally.

---

## 9. npm/node Not Installed on poc-backend Host

The Ubuntu host has Docker but not Node.js. `npm run seed` on the server fails with
`bash: npm: command not found`.

### Fix — run in a container
```python
cmd = (
    'docker run --rm '
    '--network supabase_default '
    '-v /opt/pocs/personal-to-do:/app '
    '-w /app '
    '-e DATABASE_URL="postgresql://supabase_admin:<pw>@supabase-db:5432/postgres" '
    'node:20-alpine '
    'sh -c "npx tsx scripts/seed.ts" 2>&1'
)
```

---

## 10. Next.js Standalone Image Has No node_modules

The production Docker image (multi-stage standalone) contains only the server bundle — no
`node_modules`. Running `npx` or `npm run` inside the running container will fail.

Any scripts (seed, migrate) must run:
- Locally (if DB is reachable) — it isn't from Windows via `10.10.110.34:5432`
- Via `docker run --rm --network supabase_default ...` (the working solution)

---

## 11. docker-compose version: attribute

```yaml
version: '3.8'  # causes warning: "the attribute version is obsolete"
```
Non-breaking but noisy. Remove it from future docker-compose files.

---

## 12. POC Development Must Happen in the POC Session, Not workspace-pro

This entire build was done in `claude-workspace-pro` — which is wrong. The correct flow:

```
workspace-pro:  provision infra → copy template → write CLAUDE.md + .env → STOP
POC session:    open new claude in D:\Code\Claude\03_POC\personal-to-do → build everything
```

Building in workspace-pro means the POC's own CLAUDE.md, skills, and commands are never loaded.
The new Claude session has no context about what was built. This is why you're reading this file.
