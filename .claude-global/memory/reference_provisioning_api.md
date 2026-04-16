---
name: Provisioning API — claude-controller server
description: HTTP API for async infrastructure provisioning — app onboarding (schema/bucket/route) and VM cloning. Two endpoints, job-based async with SSE streaming.
type: reference
---

# Provisioning API v2

**Server:** claude-controller
- LAN (VLAN 30): `http://10.10.30.40:5000`
- Tailscale: `http://100.111.233.126:5000`

No authentication required (trust the network).

## Endpoints

### POST /api/v2/provision/app
Provisions on poc-backend (10.10.110.34): Postgres schema, storage bucket, Traefik route, Pi-hole DNS.
Replaces manual SSH steps in poc-onboard for infrastructure setup.

### POST /api/v2/provision/server
Clones Ubuntu VM from CloudInit template 9001 on pve-r630, provisions with docker-compose/script/packages, optionally adds Traefik route.

## Async Pattern
- All calls return `202` immediately with `job_id`
- Stream progress: `GET /api/jobs/<job_id>/stream` (SSE)
- Poll status: `GET /api/jobs/<job_id>`
- Terminal events: `{"done": true, "status": "success|failed"}`

## Base URLs in Use
```bash
BASE=http://10.10.30.40:5000   # from LAN
BASE=http://100.111.233.126:5000  # via Tailscale
```

**Why:** Use 10.10.30.40 when on the homelab network. Use Tailscale IP when working remotely.
**How to apply:** Any time /poc-onboard, /new-project, or infra provisioning is needed — call this API instead of manual SSH steps for schema/bucket/route/VM work.
