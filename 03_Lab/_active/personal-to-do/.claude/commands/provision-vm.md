---
name: provision-vm
description: >
  Clone a new Ubuntu VM from the CloudInit template and provision it via the
  claude-controller provisioning API. Handles docker-compose stacks, setup scripts, or bare clones.
  Triggers on: "provision vm", "spin up vm", "new vm", "clone vm", "create server", "new server".
---

# Provision VM

Clone a new Ubuntu VM from Proxmox CloudInit template via the provisioning API.

---

## Provisioning API

| Network | Base URL |
|---------|----------|
| LAN (VLAN 30) | `http://10.10.30.40:5000` |
| Tailscale | `http://100.111.233.126:5000` |

Endpoint: `POST /api/v2/provision/server` — async, returns `job_id`.

---

## Intake

Ask for:
1. **VM name** — lowercase, hyphens ok
2. **Description** — one line
3. **Specs** (defaults: 2 cores, 4096MB RAM, 20G disk)
4. **Provisioning method:**
   - A) Docker Compose — provide `docker-compose.yml` inline
   - B) Setup script — bash script
   - C) Package list — apt packages
   - D) Bare clone — clean Ubuntu Noble VM
5. **Public hostname?** — port, subdomain, visibility (internal/external)

---

## Step 1: Submit Job

```bash
BASE=http://10.10.30.40:5000

RESP=$(curl -s -X POST $BASE/api/v2/provision/server \
  -H 'Content-Type: application/json' \
  -d "{
    \"name\": \"<n>\",
    \"description\": \"<description>\",
    \"specs\": {\"cores\": <cores>, \"memory_mb\": <memory_mb>, \"disk\": \"<disk>\"},
    \"provision\": {\"docker_compose\": \"<yaml-string>\"},
    \"route\": {\"enabled\": true, \"port\": <port>, \"visibility\": \"<internal|external>\", \"subdomain\": \"<subdomain>\"}
  }")

JOB=$(echo $RESP | python3 -c "import sys,json; print(json.load(sys.stdin)['job_id'])")
```

**Provision field mapping:**
- Docker Compose → `"provision": {"docker_compose": "<yaml-string>"}`
- Setup script → `"provision": {"setup_script": "<bash-script>"}`
- Packages → `"provision": {"packages": ["pkg1", "pkg2"]}`
- Bare clone → omit `provision` entirely

---

## Step 2: Stream Output

```bash
curl -N "$BASE/api/jobs/$JOB/stream"
```

**The VM IP appears in the clone step output** — capture it. Wait for `{"done": true, "status": "success"}`.

---

## Step 3: Verify

```bash
ssh root@<vm-ip>
docker compose ps    # if docker-compose provisioned
```

---

## Step 4: Report

- VM hostname, IP, specs
- Services running
- Public URL (if route created)
- SSH command

---

## Infrastructure Notes

| Resource | Value |
|----------|-------|
| Clone template | `9001` (CloudInit-Ubuntu-Noble) on `pve-r630` |
| VM VLAN | VLAN 110 (`10.10.110.x`) |
| POC domain | `poc.playsap.us` |

## Rules

- VM name must be `^[a-z0-9][a-z0-9\-]*$`
- VM IP is NOT in API response — comes from job output stream
- `internal` = Pi-hole DNS only; `external` = public Route53
