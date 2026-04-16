# Build History — Knowledge Universe POC

> Session: 2026-03-30 | Built in claude-workspace-pro (should have been in POC workspace — see lessons-learned.md)

---

## What Was Built

### Infrastructure (via claude-controller Provisioning API)

Provisioned via `POST http://10.10.30.40:5000/api/v2/provision/app`:

```json
{
  "name": "personal-to-do",
  "needs_db": true,
  "bucket": "uploads",
  "route": { "enabled": true, "visibility": "internal", "port": 3100 }
}
```

Result:
- Schema `poc_personal_to_do` created with full grants
- Bucket `poc-personal-to-do-uploads` created
- Traefik route: `personal-to-do.poc.playsap.us → 10.10.110.34:3100`
- Pi-hole DNS: `personal-to-do.poc.playsap.us → 10.10.30.35`

Note: Initially provisioned with port 3000. Supabase Studio owns 3000, so the route was
re-provisioned with port 3100 (a second `POST /api/v2/provision/app` with `needs_db: false`
and the new port overwrites Traefik cleanly).

---

### Application Code (57 files — built by subagent)

Built by a background `general-purpose` agent given the full design spec. The agent:
1. Ran `npx create-next-app@14.2.25 . --typescript --tailwind --app --no-src-dir --no-git`
2. Installed all additional dependencies
3. Wrote all 57 custom files
4. Confirmed `npm run build` passes cleanly (14 routes, zero errors)

#### Key files written:
- `db/schema.ts` — Drizzle pgSchema for all 4 tables
- `db/migrations/0001_init.sql` — raw DDL
- `lib/auth.ts` — jose JWT cookie auth
- `lib/aging.ts` — status state machine
- `middleware.ts` — auth guard
- `app/api/**` — full CRUD for nodes, edges, attachments, AI, auth
- `components/universe/` — CSS 3D sphere canvas
- `components/mindmap/` — React Flow
- `store/universe.ts` — Zustand
- `scripts/seed.ts` — 6 nodes + 5 edges
- `Dockerfile` + `docker-compose.yml`

---

### Migration

Run via paramiko + `docker exec -i supabase-db psql` stdin pipe:
```
CREATE SCHEMA (already existed from provisioning API — NOTICE skipped)
CREATE TABLE nodes ✅
CREATE TABLE edges ✅
CREATE TABLE node_attachments ✅
CREATE TABLE action_logs ✅
+ all indexes ✅
```

---

### Seed

Run via temporary Docker container on `supabase_default` network:
```
docker run --rm --network supabase_default -v /opt/pocs/personal-to-do:/app -w /app \
  -e DATABASE_URL="postgresql://supabase_admin:<pw>@supabase-db:5432/postgres" \
  node:20-alpine sh -c "npx tsx scripts/seed.ts"
```
Result: 6 nodes inserted, 5 edges inserted ✅

---

### Deployment

Files copied via paramiko SFTP to `/opt/pocs/personal-to-do/` (57 files).
Container built and started with `docker compose up -d --build`.

**Fixes applied during deployment:**
1. Dockerfile: `COPY --from=builder /app/public ./public` → `RUN mkdir -p ./public` (no public/ dir exists)
2. `docker-compose.yml`: port `3000:3000` → `3100:3000` (Supabase Studio owns 3000)
3. `docker-compose.yml`: added `supabase_default` as external network
4. `.env`: `DATABASE_URL` host changed from `10.10.110.34:5432` (Supavisor) to `supabase-db:5432` (direct)
5. `middleware.ts`: API routes were redirecting to `/login` instead of returning `401 JSON`

---

## Decisions Made

| Decision | Chosen | Reason |
|----------|--------|--------|
| DB engine | Postgres (Drizzle) | Already available on poc-backend; Postgres-swappable per spec |
| Auth | jose JWT cookie | Spec said JWT; jose is lightweight, no extra deps |
| Port | 3100 | 3000 taken by Supabase Studio |
| Docker network | supabase_default + poc-net | Needed for direct Postgres + Traefik routing |
| Public dir | `RUN mkdir -p ./public` | Next.js standalone doesn't need real public/ dir |
| Postgres host | `supabase-db:5432` | Supavisor (10.10.110.34:5432) rejects without tenant ID |
