---
name: provision-vm
description: >
  Clone a new Ubuntu VM from the CloudInit template and provision it with software via the
  claude-controller provisioning API. Handles docker-compose stacks, setup scripts, or bare clones.
  Optionally adds a Traefik route and Pi-hole DNS entry.
  Triggers on: "provision vm", "spin up vm", "new vm", "clone vm", "create server",
  "new server for <name>", "deploy vm", "spin up a server".
  Does NOT trigger for: onboarding onto existing poc-backend (use /poc-onboard).
---

# Provision VM

Clone a new Ubuntu VM from the Proxmox CloudInit template and provision it with the
claude-controller provisioning API.

---

## Provisioning API

| Network | Base URL |
|---------|----------|
| LAN (VLAN 30) | `http://10.10.30.40:5000` |
| Tailscale | `http://100.111.233.126:5000` |

Endpoint: `POST /api/v2/provision/server`
Async — returns `job_id` immediately. VM IP is emitted in the job output stream.

---

## Intake — Gather Requirements

Ask the user for:

1. **VM name** — lowercase, hyphens ok (e.g. `redis-host`, `n8n-worker`). Becomes the hostname.
2. **Description** — one line, what it's for.
3. **Specs** (or accept defaults):
   - CPU cores (default: 2)
   - RAM in MB (default: 4096)
   - Disk size (default: `20G`)
4. **Provisioning method** — pick one:
   - **A) Docker Compose** — provide a `docker-compose.yml` inline
   - **B) Setup script** — provide a bash script (apt installs, config, etc.)
   - **C) Package list** — list of apt packages to install
   - **D) Bare clone** — no provisioning, clean Ubuntu Noble VM
5. **Public hostname?** — if yes:
   - Port the service listens on
   - Subdomain (default: VM name)
   - Visibility: `internal` (Pi-hole DNS only) or `external` (public Route53)

---

## Step 1: Submit provisioning job

Build the request and POST to the API:

```bash
BASE=http://10.10.30.40:5000

# Example: docker-compose provision with internal route
RESP=$(curl -s -X POST $BASE/api/v2/provision/server \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"<name>\",
    \"description\": \"<description>\",
    \"specs\": {
      \"cores\": <cores>,
      \"memory_mb\": <memory_mb>,
      \"disk\": \"<disk>\"
    },
    \"provision\": {
      \"docker_compose\": $(cat docker-compose.yml | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
    },
    \"route\": {
      \"enabled\": true,
      \"port\": <port>,
      \"visibility\": \"<internal|external>\",
      \"subdomain\": \"<subdomain>\"
    }
  }")

echo $RESP
JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
```

**Provision field mapping:**
- Docker Compose → `"provision": {"docker_compose": "<yaml-string>"}` — written to `/tmp/docker-compose.yml` and started with `docker compose up -d`
- Setup script → `"provision": {"setup_script": "<bash-script>"}` — run as `sudo bash`
- Packages → `"provision": {"packages": ["pkg1", "pkg2"]}` — installed via `apt-get`
- Bare clone → omit `provision` entirely

**Route field:** omit entire `route` object if no hostname needed.

---

## Step 2: Stream job output

```bash
curl -N "$BASE/api/jobs/$JOB/stream"
```

Watch for pipeline step banners:
```
[STEP 1/3] Clone VM
[STEP 2/3] Provisioning
[STEP 3/3] Create Traefik route
```

**The VM IP appears in the clone step output** — capture it for later use.

Wait for `{"done": true, "status": "success"}`.

If `{"done": true, "status": "failed"}` — read `[PIPELINE FAILED]` line to identify which step failed, diagnose, and retry or fix manually.

---

## Step 3: Verify VM is up

Once job succeeds, SSH to the new VM (use IP from job output):

```bash
ssh root@<vm-ip>
# or
ssh mrt@<vm-ip>
```

Verify provisioned services are running:
```bash
# If docker-compose
docker compose ps

# If packages
dpkg -l | grep <package>
```

---

## Step 4: Report to user

Summarize:
- VM hostname: `<name>`
- VM IP: `<ip>` (from job output)
- Specs: `<cores>` cores / `<memory_mb>MB` RAM / `<disk>` disk
- Services running: (list from docker compose ps or service status)
- Public URL: `https://<subdomain>.poc.playsap.us` (if route created)
- SSH: `ssh root@<vm-ip>`

---

## Infrastructure Notes

| Resource | Value |
|----------|-------|
| Clone template | `9001` (CloudInit-Ubuntu-Noble) on `pve-r630` |
| Clone target node | `pve-6029u` |
| VM VLAN | VLAN 110 (`10.10.110.x`) |
| POC domain | `poc.playsap.us` |
| traefik-a | `10.10.30.35` |
| Pi-hole | `10.10.20.2` |

---

## Troubleshooting

### Clone step fails
- Proxmox API may be unreachable or template 9001 missing on pve-r630
- Check Ansible output in job stream for specific error

### SSH not available after clone
- VM may still be booting — wait 30–60s and retry
- Check job output for the IP that was assigned

### Route step fails
- traefik-a (10.10.30.35) unreachable or rules directory missing
- Can add route manually: `POST /api/v2/provision/app` with just `route.enabled: true` once VM is up

### Poll full job output
```bash
curl http://10.10.30.40:5000/api/jobs/<job_id> | python3 -m json.tool
```

---

## Rules

- VM name must be `^[a-z0-9][a-z0-9\-]*$` — validate before submitting
- `docker_compose` takes priority over `setup_script` which takes priority over `packages` — only one runs
- The VM IP is NOT in the API response — it comes from the job output stream; always capture it
- `internal` visibility = Pi-hole DNS only (not publicly resolvable outside the homelab)
- `external` visibility = relies on `*.poc.playsap.us` Route53 wildcard — use for client-facing URLs
