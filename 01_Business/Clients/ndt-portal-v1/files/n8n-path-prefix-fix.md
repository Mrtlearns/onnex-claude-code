# n8n Embedded Path-Prefix Fix — Reusable Reference

**Problem:** n8n served via a path prefix (`/n8n/`) shows a blank page. CSS files return 503 or are served as HTML.

**Root cause:** n8n's static file server always serves assets at `/assets/xxx` and `/static/xxx` (root-relative). Without help, requests for those paths go to your frontend server, not n8n.

---

## The Fix — Two Parts

### 1. `docker-compose.yml` — n8n service must have `N8N_PATH` set

```yaml
n8n:
  image: n8nio/n8n
  environment:
    N8N_HOST: "0.0.0.0"
    N8N_PORT: "5678"
    N8N_PROTOCOL: "http"
    N8N_PATH: "/n8n/"                                    # ← REQUIRED
    WEBHOOK_URL: "https://yourdomain.com/n8n/"
    N8N_ENCRYPTION_KEY: "your-32-char-key"
    N8N_SECURE_COOKIE: "false"
```

`N8N_PATH` tells n8n to prefix ALL HTML asset references: `/assets/xxx` becomes `/n8n/assets/xxx`, `/static/xxx` becomes `/n8n/static/xxx`. Without this, every asset request goes to the wrong server.

### 2. `traefik-dynamic.yml` — add `strip-n8n` middleware to the n8n router

```yaml
http:
  routers:
    n8n:
      rule: "PathPrefix(`/n8n`)"
      priority: 10
      entryPoints: [web]
      middlewares: [strip-n8n]      # ← ADD THIS
      service: n8n

  middlewares:
    strip-n8n:
      stripPrefix:
        prefixes: ["/n8n"]          # ← ADD THIS BLOCK

  services:
    n8n:
      loadBalancer:
        servers:
          - url: "http://n8n:5678"
```

The middleware strips `/n8n` before forwarding to the n8n container. So `/n8n/assets/xxx.css` → n8n receives `/assets/xxx.css` → serves the real CSS file.

---

## Why Both Parts Are Required

| Scenario | HTML refs | Browser requests | Traefik routes to | n8n receives | Result |
|---|---|---|---|---|---|
| Neither set | `/assets/xxx` | `/assets/xxx` | nginx | — | ❌ blank |
| Only `N8N_PATH` | `/n8n/assets/xxx` | `/n8n/assets/xxx` | n8n | `/n8n/assets/xxx` | ❌ 503 (SPA fallback) |
| Only strip middleware | `/assets/xxx` | `/assets/xxx` | nginx | — | ❌ blank |
| **Both** | `/n8n/assets/xxx` | `/n8n/assets/xxx` | n8n | `/assets/xxx` | ✅ works |

---

## Verification Commands

```bash
# HTML should show /n8n/assets/ prefixed paths
curl -s http://localhost:8888/n8n/ | grep 'href=\|src=' | head -5

# CSS file should return Content-Type: text/css (not text/html)
curl -si http://localhost:8888/n8n/assets/index-*.css | head -5

# base-path.js should return: window.BASE_PATH = '/n8n/';
curl -s http://localhost:8888/n8n/static/base-path.js
```
