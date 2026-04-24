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

## Leptos dashboard — build

**Shipping Leptos CSR** at `/dashboard`. Bundle: ~625 KB total (51 KB JS loader + 572 KB WASM + 1 KB HTML). Pre-Leptos HTML dashboard remains available at `/dashboard-html` as a fallback for any browser that can't run WASM.

### Building locally

```bash
# One-time — install the wasm target
rustup target add wasm32-unknown-unknown

# One-time — install trunk. On low-RAM hosts prefer the pre-built tarball over
# `cargo install trunk`, which needs ~4 GB to compile from source:
wget https://github.com/trunk-rs/trunk/releases/download/v0.21.14/trunk-x86_64-unknown-linux-gnu.tar.gz
tar -xzf trunk-x86_64-unknown-linux-gnu.tar.gz -C ~/.cargo/bin/

# Build the WASM bundle. Trunk.toml pins public_url=/dashboard/ and filehash=false so
# filenames are stable for include_bytes!.
cd crates/ai-sentinel-dashboard && trunk build --release
```

Output lands in `crates/ai-sentinel-dashboard/dist/`:
- `index.html` — entrypoint with the WASM loader script
- `ai-sentinel-dashboard.js` — bindgen loader (~51 KB)
- `ai-sentinel-dashboard_bg.wasm` — compiled app (~572 KB)

All three are `include_bytes!`-embedded into the `ai-sentinel-api` binary at compile time, so the service ships as a single binary.

### Serving

Axum route table (in `ai-sentinel-api/src/main.rs`):

| Route | Served file |
|-------|-------------|
| `GET /dashboard` | `dist/index.html` |
| `GET /dashboard/` | same |
| `GET /dashboard/ai-sentinel-dashboard.js` | JS loader |
| `GET /dashboard/ai-sentinel-dashboard_bg.wasm` | WASM binary |
| `GET /dashboard-html` | Legacy HTML fallback |

### When you edit the dashboard

1. Rebuild WASM: `cd crates/ai-sentinel-dashboard && trunk build --release`
2. Rebuild binary: `docker compose build agentsec`
3. `docker compose up -d --force-recreate agentsec`

The committed `dist/` is the source of truth for the binary — the Dockerfile doesn't run trunk, so `dist/` must be present and current when you rebuild the image.

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
