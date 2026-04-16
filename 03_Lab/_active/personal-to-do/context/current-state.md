# Current State — Knowledge Universe POC

> Last updated: 2026-03-30

---

## Deployment Status: ✅ Live

| Item | Status |
|------|--------|
| Container running | ✅ `personal-to-do-app-1` on `10.10.110.34:3100` |
| Database schema | ✅ `poc_personal_to_do` — all 4 tables created |
| Storage bucket | ✅ `poc-personal-to-do-uploads` |
| Traefik route | ✅ `personal-to-do.poc.playsap.us → 10.10.110.34:3100` |
| Pi-hole DNS | ✅ Resolves on homelab network |
| Seed data | ✅ 6 nodes + 5 edges inserted |
| Login | ✅ `admin` / `Poll0000` |
| Nodes API | ✅ Returns seeded data |
| Universe view | ✅ Renders (reported 0 initially — was Supavisor connection bug, now fixed) |
| Mindmap view | ✅ Built — not yet verified live |
| AI route | ⚠️ Built — needs `OPENROUTER_API_KEY` in `.env` |
| File upload | ⚠️ Built — not yet tested end-to-end |
| postMessage embed | ⚠️ Built — not yet tested |

---

## What Works (Verified)

- Login flow (POST `/api/auth/login` → sets `ku_session` cookie)
- Middleware auth guard — UI routes redirect to `/login`, API routes return `401 JSON`
- GET `/api/nodes` returns all nodes (verified via curl with cookie)
- Docker container joins both `poc-net` (Traefik) and `supabase_default` (direct Postgres)
- DB migration applied — all tables and indexes exist
- 6 seed nodes spanning all 4 status types (fresh/aging/urgent/catchall) + 5 edges

---

## Known Issues / Pending Work

### OpenRouter API key not set
`OPENROUTER_API_KEY=` is empty in `.env`. AI chat feature will fail until populated.

### UI not manually verified end-to-end
The app was verified at the API level (curl tests). A full browser walkthrough of:
- Universe spheres rendering with correct glow colors
- Click → NodePanel slide-in
- Create node form
- Edge creation
- Mindmap view rendering
- File upload to Supabase storage

...should be the first task in a new session.

### next.config.mjs vs next.config.ts
The scaffold created `next.config.mjs` (not `.ts` as spec intended). Functional but inconsistent with spec.

### `version:` in docker-compose.yml
`version: '3.8'` is present — causes a warning. Non-breaking but should be removed.

---

## Seeded Nodes

| Title | Type | Status |
|-------|------|--------|
| Onnex AI Agency Strategy | project | fresh |
| PI Lawyer OS Product Spec | reference | fresh |
| Research: LLM inference on Proxmox | idea | aging |
| n8n Automation Workflows | note | urgent |
| SAP GRC Module Notes | reference | catchall |
| Knowledge Universe POC | project | fresh |

---

## Next Recommended Actions

1. **Full browser walkthrough** — verify all views render correctly
2. **Add OpenRouter key** to `.env` on server + restart container
3. **Test AI chat** — POST `/api/ai` with a query
4. **Test file upload** — attach a file to a node
5. **Test postMessage bridge** — embed in a simple HTML page
6. **Create/edit nodes** via the UI form
7. **Edge creation UI** — verify it works in both views
