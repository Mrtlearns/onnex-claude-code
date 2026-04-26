# NDT Portal v1 — Project-Specific Gotchas & Standards

**Purpose:** ndtv1-specific pitfalls and config facts. Universal execution principles live in the global `core-execution` skill — read that first.

**Global rules:** `D:\Code\Claude\.claude-global\skills\core-execution\SKILL.md`

**Last Updated:** 2026-04-26 (Infrastructure upgrade session — Docker, Authentik, Nextcloud, CI race condition)

---

## Pre-Execution: ndtv1-Specific Steps

Run these *after* the global five-phase protocol:

```bash
# ndtv1 environment check:
cd frontend
npm install
npx playwright install        # Playwright is used for E2E tests in this project
npm run build                 # Must succeed before any implementation

# Config files to audit for this project:
[ ] frontend/.env.local       # VITE_AUTHENTIK_ISSUER, VITE_AUTHENTIK_CLIENT_ID
[ ] frontend/vite.config.ts   # Build output, API proxy paths, vitest config
[ ] frontend/playwright.config.ts  # baseURL, testDir, actionTimeout
[ ] docker-compose.yml        # Service layout, ports, AUTHENTIK_URL env var
[ ] traefik-dynamic.yml       # Route priorities, prefix conflicts
[ ] nginx.conf                # SPA fallback (try_files to index.html)

# Connectivity check:
curl -s http://10.10.110.32:8888 | head -5   # Server reachable?
```

## Commit Gate for this project:
```
npm run build    ✓ (TypeScript, no errors)
npm test         ✓ (Vitest unit tests)
git commit       ✓
```

---

## Common Gotchas by Component

### Frontend (React + Vite)
```markdown
## Vite Build
- **Gotcha:** .env vars must be prefixed with VITE_ to be exposed
- **Gotcha:** import.meta.env is built-in, don't import dotenv
- **Gotcha:** .env.local is gitignored — CI must write .env.production before npm run build
- **Solution:** CI writes .env.production with VITE_* vars at build time

## Vite 8 (Rolldown) — CRITICAL: import.meta.env Tree-Shaking
- **Gotcha:** Vite 8 (Rolldown bundler) replaces `import.meta.env.VITE_*` with `undefined`
            at build time when the variable is not set. `if (!undefined)` is statically
            `true` — Rolldown tree-shakes the entire guarded block as dead code with
            NO warning. The code just disappears from the bundle.
- **Symptom:** Caused the login loop. `userManager` was never created because the entire
            OIDC setup block was removed. `login()` silently no-oped. "Redirecting to
            login..." shown forever with no redirect to Authentik.
- **Diagnosis:** `grep -c "your-oidc-issuer.com" dist/assets/*.js` → 0 matches despite
            correct .env.production. Bundle content hash unchanged across builds.
- **Rule:** NEVER guard critical init code with `if (!import.meta.env.VITE_VAR)` alone.
            ALWAYS use `import.meta.env.VITE_VAR || 'hardcoded-fallback'` for any value
            that controls initialization flow. Public OIDC config is not a secret.
- **Rule:** Do NOT set `VITE_*` in GitHub Actions `env:` blocks. Unresolved GitHub vars
            (`${{ vars.X }}` when X is not configured) become empty string in the shell,
            which overrides .env.production in Vite's process-env priority order.
            Use shell-level resolution instead: `[ -z "$VAR" ] && VAR="default"`

## oidc-client-ts v3.x (HTTP/PKCE)
- **Gotcha:** UserManager async initialization — check isLoading state
- **Gotcha:** Env vars missing → UserManager is null → no login happens
- **Gotcha:** oidc-client-ts v3 calls crypto.subtle.digest('SHA-256') directly for PKCE
            — crypto.subtle is undefined over plain HTTP (non-secure context)
- **Gotcha:** oidc-client-ts v3 has NO cryptoProvider hook — the field in UserManagerSettings
            is silently ignored; the library always uses its own CryptoUtils
- **Solution:** Polyfill window.crypto.subtle BEFORE creating UserManager.
            Use Object.defineProperty to install a SHA-256 impl as an own property
            on window.crypto, shadowing the prototype getter. See AuthContext.tsx:
            installCryptoSubtlePolyfill() function.
- **Solution:** Always call setIsLoading(false) in guard condition

## CI: Server Source Staleness
- **Gotcha:** CI only rsyncs dist/ to the server — the server's frontend/src/ can become stale
- **Gotcha:** If you manually rebuild on the server, the stale source produces wrong output
- **Solution:** CI now rsyncs frontend/ source (excluding node_modules, dist, .env*)
            to $DEPLOY_DIR/frontend/ on every deploy. Server source stays current.

## Testing
- **Gotcha:** Testing-library + vitest need jsdom environment
- **Gotcha:** Components must export names for imports to work
- **Solution:** Add `export const` before context/component definitions

## Playwright Tests
- **Gotcha:** CSS selectors with commas don't work as OR operators
- **Gotcha:** Selectors must be wrapped in try/catch for resilience
- **Gotcha:** LoginPage auto-redirects to Authentik on mount (no Sign In click needed)
- **Gotcha:** Authentik password stage button text is "Continue", not "Log in"
- **Gotcha:** Use page.type() not page.fill() for Authentik password — web components
            need key events, not programmatic value assignment
- **Solution:** Use single locators, chain with .first(), handle errors
```

### Authentik (OIDC)
```markdown
## Configuration
- **Gotcha:** AUTHENTIK_URL must be set for correct discovery doc URLs
- **Gotcha:** Issuer URL must match frontend + Traefik + Authentik output
- **Gotcha:** Redirect URI must not conflict with other Traefik routes
- **Gotcha:** Default authorization flow is "explicit consent" — shows "Allow access?"
            screen on every login. For first-party apps, switch to implicit consent.
- **Solution:** authentik/seed.py runs on every CI deploy and applies idempotent config
            including switching the provider to default-provider-authorization-implicit-consent

## HTTPS / X-Forwarded-Proto (CRITICAL)
- **Gotcha:** Authentik generates its issuer URL from the incoming request scheme (X-Forwarded-Proto),
            NOT from the AUTHENTIK_URL env var. If SSL terminates upstream (pfSense/load balancer),
            Traefik sees plain HTTP and Authentik emits http:// issuer URLs.
- **Symptom:** oidc-client-ts strict issuer validation fails (authority HTTPS ≠ issuer HTTP) →
            login button does nothing, or callback loop.
- **Solution:** Add `set-https-proto` Traefik middleware (`X-Forwarded-Proto: https`) on ALL
            Authentik routes (authentik AND authentik-direct in traefik-dynamic.yml).
- **Note:** Container env var AUTHENTIK_URL alone does NOT fix discovery doc issuer URLs.

## Token Validity Field Format (CRITICAL — causes 405 on token exchange)
- **Gotcha:** Authentik 2024.x stores access_token_validity/refresh_token_validity as TEXT fields
            expecting "unit=value" format: "hours=8", "days=7", "minutes=5".
- **Gotcha:** Assigning `timedelta(hours=8)` via Django ORM saves it as str(timedelta) = "8:00:00".
            Authentik's timedelta_from_string("8:00:00") fails with ValueError (no "=" found).
- **Symptom:** POST /application/o/token/ → HTTP 405 + system_exception → signinRedirectCallback()
            fails → navigate to /login → callback loop every 1 second.
- **Solution:** ALWAYS use string format in seed.py: `"hours=8"`, `"days=7"`. Never timedelta().
- **Diagnosis:** `docker exec authentik-db-1 psql -U authentik -d authentik -c "SELECT access_token_validity FROM authentik_providers_oauth2_oauth2provider;"` — value should be "hours=8" not "8:00:00".

## _redirect_uris JSONB Column
- **Gotcha:** In Authentik 2024.x, redirect URIs are JSONB in `_redirect_uris` (not `redirect_uris`).
            Standard Django ORM field access raises FieldDoesNotExist or ValueError.
- **Solution:** Use raw SQL via django.db.connection.cursor(). See authentik/seed.py section 2.

## DB Wipe Survival
- **Gotcha:** Manual Authentik config (provider settings, flows) is lost on DB wipe
- **Solution:** authentik/seed.py — committed to git, run by CI after every docker compose up.
            Re-applies implicit consent flow, redirect URIs, and token validity strings.
            Other setup (initial provider creation) still requires setup_authentik.js.

## Traefik Routes (Authentik paths)
- **Gotcha:** Authentik flow executor uses /flows/ path — must be in Traefik authentik-direct rule
- **Gotcha:** Admin UI uses /ws/ WebSocket — must be in Traefik authentik-direct rule
- **Gotcha:** API calls go to /api/v3/ — must be in Traefik authentik-direct rule
- **Solution:** traefik-dynamic.yml authentik-direct rule includes all required paths:
            /application/, /if/, /-/, /flows/, /ws/, /api/v3/, /static/dist/

## Web Components
- **Gotcha:** Admin setup uses ak-* web components, can't easily automate
- **Solution:** Either skip automation or use long timeouts + element waiting

## Testing
- **Gotcha:** Session state persists between test runs
- **Solution:** Either accept reusing existing setup or clear state explicitly
```

### oidc-client-ts Callback Loop Prevention
```markdown
## login() must be memoized
- **Gotcha:** Plain async login() in AuthContext gets a new reference on every AuthProvider re-render.
            LoginPage useEffect([user, login]) fires on every reference change → multiple
            signinRedirect() calls → each overwrites PKCE state in sessionStorage →
            signinRedirectCallback() throws "No matching state found in storage" → /login → loop.
- **Solution:** Wrap login and logout in useCallback([userManager]).

## Single-fire guards
- **LoginPage:** `loginCalledRef = useRef(false)` — set true before signinRedirect() call.
            Prevents multiple fires within one component mount (StrictMode, re-renders).
- **LoginCallback:** `processedRef = useRef(false)` — set true before signinRedirectCallback().
            Prevents second call when isLoading flips causing a re-render while on /login/callback.

## LoginCallback → navigate() race condition (CRITICAL)
- **Gotcha:** `signinRedirectCallback()` triggers `addUserLoaded` (async, awaits `rbacApi.me()` HTTP).
            If `navigate(returnPath)` fires immediately after `signinRedirectCallback()` resolves,
            `RequireAuth` renders before `setUser()` completes → sees `user=null` → redirects to
            `/login` → `LoginPage` mounts fresh → `loginCalledRef` reset → `login()` fires again → loop.
- **Symptom:** Login at Authentik succeeds (200 token response), but user immediately bounces back
            to LoginPage. API logs show `/rbac/me` 200 followed immediately by another redirect.
- **Solution:** After `signinRedirectCallback()` resolves, set a `callbackDone` state flag.
            Use `useEffect([callbackDone, user])` to navigate only AFTER `user` is non-null.
            Add a 5s timeout fallback to avoid getting stuck if RBAC call is slow.
- **Note:** This race is worse after Authentik restarts (fresh session = slower DB queries).

## Debugging callback loops — diagnostic sequence
1. No Authentik traffic at all = OIDC setup was tree-shaken (check bundle for issuer string)
2. Nginx/Traefik logs: multiple GET /login/callback with different code+state = signinRedirect() called multiple times
3. Authentik logs: POST /application/o/token/ status 405 + "system_exception" = server-side crash
   → check access_token_validity format in DB (must be "hours=8" not "8:00:00")
4. No POST at all = signinRedirectCallback() throws before HTTP request (state not found in sessionStorage)
5. POST status 200 + /rbac/me 200, but loop continues = LoginCallback navigate() race condition
   → ensure navigate() waits for user state, not just signinRedirectCallback() resolution
```

## API Calls — Authorization Headers (fetch hygiene)
- **Gotcha:** Any `fetch()` call without `{ headers: getAuthHeaders() }` returns 401 from the
            JWT middleware. The frontend silently shows empty data (no error thrown). Easy to miss
            in new components — the page loads, just with no data.
- **Rule:** Every `fetch()` to `/api/ut/*`, `/api/workshop/*`, `/api/rbac/*` MUST include
            `{ headers: getAuthHeaders() }` or `getAuthHeaders({ 'Content-Type': 'application/json' })`.
- **Pattern:** `getAuthHeaders()` from `@/lib/api` returns `{ Authorization: 'Bearer <token>' }`
            when a token is set, or `{}` when not. Safe to include on all calls.
- **Anti-pattern:** `fetch(url, { headers: { 'Content-Type': 'application/json' } })` — missing auth.
- **Diagnosis:** API logs show 401 responses for routes that require auth. Check with:
            `docker compose logs api --tail=50` — look for 401 on your route.
- **Affected files (fixed 2026-04-13):** InspectionTypesTab, RtMachineProfilesTab, ClaudeOAuthTab,
            useWorkshopMachines — all had raw fetch() without auth headers.

### Docker Compose — Race Conditions on Restart
```markdown
## Named-container conflict (CRITICAL — causes CI failures)
- **Gotcha:** Services with `container_name:` set (collabora, nextcloud-app, nextcloud-db,
            nextcloud-redis) use fixed names. When `docker compose up -d --remove-orphans`
            fails mid-run and the retry is `docker compose down && docker compose up -d`,
            Docker may report "container name already in use" even though down just removed it —
            the name deallocation isn't instant.
- **Symptom:** CI deploy fails with `Error response from daemon: Conflict. The container name
            "/collabora" is already in use`. Stack is actually healthy (containers came up
            despite the error).
- **Solution:** Before the retry `docker compose up -d`, force-remove the named containers:
            `for cname in collabora nextcloud-app nextcloud-db nextcloud-redis; do docker rm -f "$cname" 2>/dev/null || true; done`
            This guarantees the name is free before recreation. See step 7 in `.gitlab-ci.yml`.

## Hash-prefixed container names (orphan detection failure)
- **Gotcha:** When compose's `--remove-orphans` races with a container still stopping, the
            replacement gets a hash prefix (`a2c59a2_ndt-portal-api-1`). These break service
            discovery inside the compose network.
- **Symptom:** Containers run but can't reach each other by service name.
- **Solution:** `docker compose down && docker compose up -d` restores clean names. The CI
            retry logic handles this automatically.
```

### Authentik Upgrades
```markdown
## Never jump more than 2 minor versions at once
- **Gotcha:** Authentik 2024.12 → 2026.2.2 direct fails. Migration `authentik_core.0056_user_roles`
            (data migration added in 2025.10) references `group_id` on the Role model, but
            `authentik_rbac.0010` (added 2026.1) removes that field. When jumping directly,
            Django runs 0010 before 0056 in some orderings, leaving 0056 with no `group_id`
            to query → FieldError → crash loop.
- **Confirmed working path:** 2024.12 → 2025.4 → 2025.8 → 2026.2.2 (skip 2025.12 — same bug)
- **Workaround if stuck:** Mount a patched `0056_user_roles.py` with `RunPython.noop` replacing
            the broken data migration, start the container to let schema operations run, then
            remove the patch mount and restart clean. See `/opt/backups/2026-04-26/` for the
            patched file used in this session.
- **DB lock during migration restart loop:** Crashed Authentik processes leave `idle in transaction`
            sessions that block the `ALTER TABLE authentik_core_group DROP CONSTRAINT` step.
            Kill them: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';`

## ak_groups → groups (Authentik 2026.2.2)
- **Gotcha:** `User.ak_groups` is deprecated in 2026.2.2. Replaced by `User.groups`.
            Still works but emits a deprecation warning in every seed.py run.
- **Fix:** Replace `user.ak_groups.filter(...)` and `user.ak_groups.add(...)` with
            `user.groups.filter(...)` and `user.groups.add(...)` in `authentik/seed.py`.

## Sessions cleared on Authentik upgrade
- **Expected:** All user sessions are invalidated after an Authentik version upgrade.
            Users will see `error=login_required` and a 401 on first API call post-upgrade.
            This is normal — they log in again and all is fine.
```

### Nextcloud Upgrades
```markdown
## Must upgrade sequentially — cannot skip major versions
- **Gotcha:** Nextcloud 30 → 33 direct will fail or corrupt DB. Each major version runs its
            own schema migrations; skipping means missing intermediate migrations.
- **Correct path:** 30 → 31 → 32 → 33. Each step: change the image tag, docker compose up -d,
            wait for healthcheck to go `healthy` (~60-90s per step).
- **Maintenance mode:** Nextcloud briefly enters maintenance mode during upgrade. Healthcheck
            correctly reports `starting` during this window. Do NOT restart — wait it out.
- **Collabora (richdocuments):** Nextcloud auto-updates the Collabora app from the app store
            during each upgrade step. Expect 10-20s extra per step for app update.
```

### PostgREST v12 → v14 Upgrade
```markdown
## Drop-in replacement — no config changes needed
- **Confirmed:** All `PGRST_*` env vars remain identical between v12.2.3 and v14.10.
            Schema cache loading, JWT validation, and basic CRUD all work unchanged.
- **Schema cache:** v14 logs the cache load in <200ms. Log line changes slightly but
            still emits "Schema cache loaded N Relations".
- **Note:** v14 jumped from v12 (v13 was skipped in versioning). Do not worry about
            the version gap — there is no missing v13.
```

### Docker/Traefik
```markdown
## Routing
- **Gotcha:** Priority order matters (higher = evaluated first)
- **Gotcha:** /auth prefix at priority 50 catches all /auth/* paths
- **Gotcha:** Callback routes must be outside caught prefixes

## Environment
- **Gotcha:** docker-compose env vars need BOTH service and global definition
- **Solution:** Define at top level `environment:` in each service

## Restarts
- **Gotcha:** Services don't hot-reload (need restart after config changes)
- **Solution:** `docker compose restart <service>` after changes
```

---

## Decision Trees

> SSH vs HTTP and Commit Gate trees live in the global `core-execution` skill — check there first.

### "Should I automate Authentik setup?"
```
Setting up Authentik OIDC app?
├─ Server is ephemeral/changes often? → Automate with Playwright
├─ Server is stable/rarely changes? → Do manually once, document
├─ Need to verify it's set up correctly? → Write verification tests
├─ Need to set it up repeatedly? → Automate
└─ In doubt? → Verify current state first (curl /auth/api/v3/root/config/)
```

---

## References

| Topic | File |
|-------|------|
| Project context | CLAUDE.md |
| Architecture | files/ndtv1-complete-pipeline-spec.md |
| Open items | TODO.md |
| Current state | context/current-data.md |

---

## Evolution Log

**2026-04-22 → 2026-04-26 (Infrastructure: CI/CD restoration + full upgrade session)**

Five issues found and resolved across two sessions:

1. **ndt-portal-v1 had no local `.git` repo** — Code was tracked in root `D:\Code\Claude` workspace but never pushed to its own `gitlab.botonomy.xyz/mrt/ndt-portal-v1` repo. Runner was online but had no jobs to pick up. Fixed by `git init`, connecting both GitLab and GitHub remotes, committing 72-file delta (April 14→23 changes), pushing to both. CI immediately triggered and ran successfully.

2. **Docker compose race condition — two patterns** — (a) `removal already in progress` leaves hash-prefixed container names. (b) Named containers (`collabora`, `nextcloud-*`) report "name already in use" when `docker compose down && docker compose up -d` is retried too quickly. Fixed in `.gitlab-ci.yml` step 7: force-remove the four named containers before the retry, ensuring names are free.

3. **Full Docker stack upgrade (2026-04-26)** — All images updated. Key learnings:
   - Authentik: cannot jump 2024.12 → 2026.2.2 directly. `authentik_core.0056_user_roles` (added 2025.10) references `group_id` that `authentik_rbac.0010` (added 2026.1) removes. Correct path: 2024.12 → 2025.4 → 2025.8 → 2026.2.2 (skip 2025.12, same bug). During upgrade, stale `idle in transaction` DB sessions block ALTER TABLE — kill them with `pg_terminate_backend`.
   - Nextcloud: must upgrade sequentially per major version (30→31→32→33). Each step ~70s.
   - PostgREST v14.10: drop-in replacement for v12.2.3, no config changes.
   - Traefik v3.6, nginx 1.30, all patch updates: no issues.

4. **Authentik seed.py deprecation** — `User.ak_groups` renamed to `User.groups` in 2026.2.2. Was emitting deprecation warnings on every CI deploy seed run. Fixed by swapping two lines.

5. **Pipeline 190 failure** — Named-container conflict (collabora). Fixed by pipeline 191 (success) with the force-remove retry logic. Root cause documented as a gotcha above.

New rules added: Docker compose named-container race, Authentik stepped upgrade path, 0056_user_roles workaround, Nextcloud sequential upgrade requirement, PostgREST v14 compat, ak_groups deprecation.

**2026-04-13 (Login Loop — GitHub Actions migration + auth header sweep)**

Three root causes found and fixed:

1. **Vite 8 (Rolldown) tree-shaking killed the entire OIDC setup block** — `import.meta.env.VITE_AUTHENTIK_ISSUER` was undefined at build time, making `if (!undefined)` always true. Rolldown tree-shook the OIDC UserManager setup as dead code — no warning, no error, no login. Fixed by using `import.meta.env.VITE_VAR || 'hardcoded-fallback'` so the block is never dead code. Also fixed CI `deploy.yml` to not set VITE_* in GitHub Actions `env:` block (empty string overrides .env.production in Vite's priority order).

2. **`LoginCallback` navigate() race condition** — `signinRedirectCallback()` triggers async `addUserLoaded` (awaits HTTP `/api/rbac/me`). Old code called `navigate(returnPath)` immediately after the callback, before `setUser()` finished. `RequireAuth` saw `user=null`, redirected to `/login`, `LoginPage` mounted fresh and re-fired `login()`. Fixed by setting `callbackDone` state and using `useEffect([callbackDone, user])` — navigates only after user is non-null, with 5s timeout fallback.

3. **Missing auth headers on 15+ fetch() calls** — `InspectionTypesTab`, `RtMachineProfilesTab`, `ClaudeOAuthTab`, `useWorkshopMachines` all used raw `fetch()` without `getAuthHeaders()`. JWT middleware returned 401 silently, frontend showed empty data. All fixed.

New rules added:
- Vite 8 tree-shaking of `import.meta.env` — always use `|| 'fallback'` for init guards
- GitHub Actions env block pitfall — don't set VITE_* vars when GitHub vars may be unset
- LoginCallback navigate() race — wait for user state before navigating
- fetch() auth header hygiene — all API calls must include `getAuthHeaders()`

**2026-04-07 (Auth Login Flow — Session 1)**
- Discovered 4 root causes (isLoading, routing, issuer URL, AUTHENTIK_URL)
- Wrote 15 unit tests + 6 Playwright tests
- Identified 10 golden rules from lessons learned
- Time savings opportunity: 48% on similar tasks

**2026-04-09 (Auth Login Flow — Session 3: HTTPS + callback loop fix)**

Root causes found and fixed (4 in total):
1. **Mixed content (VITE issuer HTTP vs HTTPS portal)** — VITE_AUTHENTIK_ISSUER was `http://10.10.110.32:8888/...` but portal accessed at `https://ndt-v1.on-nex.us` → Chrome blocked HTTP fetch from HTTPS page → login button silent fail → changed issuer to HTTPS domain
2. **Authentik discovery doc returning http:// issuer** — Authentik reads scheme from X-Forwarded-Proto; SSL terminates at pfSense so Traefik sees plain HTTP → added `set-https-proto` middleware to both Authentik Traefik routes + `docker compose up -d --force-recreate` to apply env var change
3. **`login()` not memoized** — new reference each render → LoginPage useEffect re-fires → multiple signinRedirect() → PKCE state overwritten → "No matching state found" → loop → fixed with useCallback + single-fire ref guards on LoginPage + LoginCallback
4. **Token validity stored in wrong format** — seed.py assigned `timedelta(hours=8)` via ORM; stored as "8:00:00"; Authentik timedelta_from_string expects "hours=8" → POST /application/o/token/ crashed → HTTP 405 → loop → fixed string format in seed.py + direct DB UPDATE

New rules added:
- HTTPS / X-Forwarded-Proto — Authentik issuer comes from request scheme, not AUTHENTIK_URL
- Token validity text format — "hours=8" not timedelta()
- _redirect_uris JSONB — must use raw SQL cursor
- oidc-client-ts callback loop prevention — memoize login, single-fire guards

**2026-04-07 (Auth Login Flow — Session 2: Full OIDC end-to-end)**

Root causes found and fixed (6 in total):
1. **VITE env vars not baked** — `.env.local` gitignored; CI had no VITE_* at build time → CI now writes `.env.production` before `npm run build`
2. **`cryptoProvider` API missing in oidc-client-ts v3.5.0** — field silently ignored; library always uses its own `CryptoUtils` → polyfill `window.crypto.subtle` with `Object.defineProperty` before `UserManager` creation
3. **Server source stale** — CI only rsynced `dist/`; manual rebuilds used stale `frontend/src/` → CI now rsyncs full `frontend/` source (excluding node_modules, dist, .env*) every deploy
4. **Authentik user password wrong** — reset via Django `set_password` + verified with `check_password`
5. **Explicit consent flow blocked login** — Authentik default shows "Grant access?" on every login → switched to `default-provider-authorization-implicit-consent`; now persisted by `authentik/seed.py`
6. **Missing `/login/callback` route** — server's `App.tsx` was stale (from old deploy); route never registered → synced latest `App.tsx` + `LoginCallback.tsx` to server, rebuilt

Resilience mechanisms added:
- `authentik/seed.py` — committed to git, run by CI every deploy; applies implicit consent + verifies redirect URI; survives DB wipes
- CI rsyncs `frontend/` source — server stays current; manual rebuilds always use correct code
- CI writes `frontend/.env.production` — OIDC vars always baked into bundle regardless of .env.local state

Playwright outcome: both tests passing in 9.0s total
- `NDT Portal full OIDC login flow` ✅
- `Login page — auto-redirects to Authentik` ✅

New rules added to this file:
- oidc-client-ts v3 has no `cryptoProvider` hook — polyfill `window.crypto.subtle`
- CI source staleness pattern — rsync source, not just dist
- Authentik implicit consent — first-party apps should use implicit flow; document in seed.py
- Playwright: `page.type()` for Authentik web component password fields
- Playwright: LoginPage auto-redirects; no button click needed
