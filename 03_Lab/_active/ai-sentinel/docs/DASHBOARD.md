# AI-Sentinel — Admin Dashboard

## Access

**Production:** `https://ai-sentinel.on-nex.us/dashboard`
**Local:** `http://localhost:8080/dashboard`

## Authenticate

The dashboard speaks to `/admin/*` endpoints, which require the admin Bearer token
(value of `AI_SENTINEL_ADMIN_TOKEN` in `/opt/ai-sentinel/.env`).

1. Open the dashboard
2. Paste the admin token into the top bar
3. Click **Save** — the token is held in `sessionStorage` (cleared when you close the tab)

## Tabs

| Tab | What it shows |
|-----|---------------|
| **Overview** | Module counts (total / enabled / disabled) |
| **Modules** | Grid of all modules. Toggle each with the switch — every flip is audit-logged with actor = `admin` (override with `X-Actor` header in API calls). |
| **Audit** | Output of `GET /admin/audit/verify` — walks the tamper-evident chain and reports `ok` or `integrity_failure`. |
| **Dry-run** | Paste a YAML rule set + a sample prompt + pick a trigger → see which rules match and the merged top action without writing anything. |

## Philosophy

The Phase 5 dashboard is deliberately HTML-first (Tailwind via CDN, vanilla JS). The
Leptos CSR crate (`crates/ai-sentinel-dashboard/`) is scaffolded for a future richer
build. Everything the HTML dashboard does today is exposed as clean JSON API endpoints,
so the Leptos replacement is a drop-in.

## Endpoints Reference

| Method | Path | Purpose |
|--------|------|---------|
| GET    | `/admin/modules` | List all modules (respecting license tier) |
| GET    | `/admin/modules/:id` | Detail + current YAML config |
| PUT    | `/admin/modules/:id` | Update config (requires `If-Match: <version>` header) |
| DELETE | `/admin/modules/:id` | Delete + remove from policy engine |
| POST   | `/admin/modules/:id/enable` | Toggle on (audit: `enable`) |
| POST   | `/admin/modules/:id/disable` | Toggle off (audit: `disable`) |
| GET    | `/admin/modules/:id/versions` | Version history DESC |
| POST   | `/admin/modules/:id/revert/:version` | Rollback to a prior version (creates a new version) |
| GET    | `/admin/modules/:id/audit` | Last 100 audit entries for this module |
| POST   | `/admin/rules/validate` | Compile YAML, return rule count + errors |
| POST   | `/admin/rules/dry-run` | Run a YAML against a sample prompt |

All mutating endpoints accept an optional `X-Actor: <name>` header to attribute the
audit entry. Defaults to `admin`.

## License Tiers

Set `AI_SENTINEL_LICENSE_TIER` in the env to one of:

- `basic` — basic-tier modules only
- `pro` — basic + pro
- `enterprise` — all tiers

Modules above the deployment tier are filtered out of `GET /admin/modules` and cannot
be enabled. Default is `enterprise`.

## Troubleshooting

- **"HTTP 401" on every request** — token missing or wrong. Paste it into the bar again.
- **"HTTP 503 module_store_unavailable"** — `AI_SENTINEL_DB_URL` isn't set; the module
  admin API requires Postgres.
- **Dashboard blank / "Error: TypeError"** — check browser console. Likely a CORS issue
  if you're on a different origin. Dashboard is designed for same-origin.
