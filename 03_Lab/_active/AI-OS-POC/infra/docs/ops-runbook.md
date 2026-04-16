# Agency AI-OS -- Operations Runbook

**Version:** 1.1
**Updated:** 2026-04-05
**VM:** Agency-POC (10.10.110.31) -- accessed via claude-controller (100.111.233.126 Tailscale)
**Project root:** /opt/agency-ai-os
**Compose file:** /opt/agency-ai-os/infra/docker-compose.yml

---

## 1. Stack Overview

### VM Access

Access Agency-POC via two-hop SSH. ProxyJump does NOT work here (key not forwarded for second hop).
Use the sshpass pattern instead:

    ssh -i ~/.ssh/MrT_Personal_Key_ed25519 -o StrictHostKeyChecking=no mrt@100.111.233.126 \
      "sshpass -p 'Poll0000' ssh -o StrictHostKeyChecking=no \
       -o PreferredAuthentications=password root@10.10.110.31 'YOUR COMMAND'"

| Hop | Host | User | Auth |
|-----|------|------|------|
| 1 — Jumpbox | 100.111.233.126 (Tailscale) | mrt | ~/.ssh/MrT_Personal_Key_ed25519 |
| 2 — Agency-POC | 10.10.110.31 | root | password Poll0000 |

For interactive sessions, SSH to jumpbox first then hop manually:

    ssh -i ~/.ssh/MrT_Personal_Key_ed25519 mrt@100.111.233.126
    # then:
    sshpass -p 'Poll0000' ssh root@10.10.110.31

### All 27 Containers

**Edge / Platform (3)**

| Container | Image | Purpose |
|-----------|-------|---------|
| edge-traefik | traefik:v3 | Reverse proxy (deferred from Phase 1 -- not active as ingress in POC) |
| authentik-server | ghcr.io/goauthentik/server:2024.10.x | SSO / OIDC identity provider |
| authentik-worker | ghcr.io/goauthentik/server:2024.10.x | Authentik background task worker |

**Core Data (3)**

| Container | Image | Purpose |
|-----------|-------|---------|
| postgres-core | pgvector/pgvector:pg16 | Primary PostgreSQL 16 + pgvector extension |
| redis-core | redis:7-alpine | Application cache / session store |
| minio-core | minio/minio | S3-compatible object storage |

**AI-OS App (4)**

| Container | Image | Purpose |
|-----------|-------|---------|
| aios-api | aios-api (local build) | Fastify REST API (port 3001) |
| aios-web | aios-web (local build) | Next.js 14 frontend (port 3002) |
| aios-worker | aios-worker (local build) | Temporal workflow worker |
| aios-scheduler | aios-scheduler (local build) | Temporal schedule registrar (exits 0 on success) |

**Agent Layer (1)**

| Container | Image | Purpose |
|-----------|-------|---------|
| openclaw-runtime | ghcr.io/openclaw/openclaw:latest | OpenClaw AI agent gateway |

**Sync (1)**

| Container | Image | Purpose |
|-----------|-------|---------|
| rclone-sync | rclone/rclone:latest | Google Drive → MinIO TrueNAS sync (fast every 15 min, full daily at midnight) |

**Temporal (2)**

| Container | Image | Purpose |
|-----------|-------|---------|
| temporal | temporalio/auto-setup:1.24.2 | Temporal server (workflow orchestration) |
| temporal-ui | temporalio/ui:2.32.0 | Temporal web UI (port 8080) |

**Document / Collaboration (7)**

| Container | Image | Purpose |
|-----------|-------|---------|
| nextcloud-app | nextcloud:30-apache | File storage / collaboration (port 8090) |
| nextcloud-db | mariadb:10.6 | Nextcloud MariaDB |
| nextcloud-redis | redis:7-alpine | Nextcloud Redis cache |
| paperless-web | ghcr.io/paperless-ngx/paperless-ngx:2.13 | Document management (port 8010) |
| paperless-broker | redis:7-alpine | Paperless task queue |
| paperless-db | postgres:16 | Paperless PostgreSQL |
| paperless-ai | clusterzx/paperless-ai:latest | RAGZ semantic document enrichment (port 8501) |

**Observability (4)**

| Container | Image | Purpose |
|-----------|-------|---------|
| prometheus | prom/prometheus:v2.54.1 | Metrics collection (port 9090) |
| grafana | grafana/grafana:11.3.1 | Dashboards / visualization (port 3000) |
| loki | grafana/loki:latest | Log aggregation (port 3100) |
| promtail | grafana/promtail:latest | Log shipper from Docker containers |

**Metric Exporters (3)**

| Container | Image | Purpose |
|-----------|-------|---------|
| node-exporter | quay.io/prometheus/node-exporter:v1.8.2 | Host metrics (network_mode: host, port 9100) |
| postgres-exporter | quay.io/prometheuscommunity/postgres-exporter:v0.15.0 | Postgres metrics (port 9187) |
| redis-exporter | oliver006/redis_exporter:v1.62.0 | Redis metrics (port 9121) |

### Docker Networks

| Network | Type | Purpose |
|---------|------|---------|
| edge_net | bridge | Traefik <-> public-facing services |
| app_net | bridge | App services inter-communication |
| data_net | bridge, internal | Database-tier isolation (no external routes) |

---

## 2. Daily Health Check

### 2a. Container Status

Run from Agency-POC (cd /opt/agency-ai-os/infra first):

    # Show containers NOT in Up state:
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v "Up "

    # Full status including health:
    make status

Expected: All containers show Up. Note: aios-scheduler may show "Exited (0)" -- this is normal.
It registers Temporal schedules then exits cleanly with exit code 0.

### 2b. Prometheus Targets

Browser: http://10.10.110.31:9090/targets

Expected: All 5 targets show state=UP:
- prometheus (self-scrape)
- node-exporter (host metrics via 172.17.0.1:9100)
- postgres-exporter
- redis-exporter
- aios-api (/metrics endpoint)

### 2c. Grafana Dashboards

Browser: http://10.10.110.31:3000 (admin / admin or configured password)

Navigate to AI-OS folder. Check all three dashboards:
- Infra Overview -- CPU, memory, disk, network panels
- App Metrics -- HTTP rate, p95 latency, 5xx panels
- Container Logs -- Loki log stream panel with recent container logs

### 2d. Key Application Endpoints

    # aios-api health:
    curl -s http://localhost:3001/health | python3 -m json.tool

    # aios-api ready:
    curl -s http://localhost:3001/ready | python3 -m json.tool

    # Authentik reachable (expect 200):
    curl -o /dev/null -s -w "%{http_code}" http://localhost:9000/if/flow/default-authentication-flow/

    # Temporal UI (expect 200):
    curl -o /dev/null -s -w "%{http_code}" http://localhost:8080/

---

## 3. Backup Procedures

### 3a. What Gets Backed Up

| Resource | Method | Output |
|----------|--------|--------|
| aios Postgres database | pg_dump --format=custom | aios.dump |
| authentik Postgres database | pg_dump --format=custom | authentik.dump |
| temporal Postgres database | pg_dump --format=custom | temporal.dump |
| MinIO bucket aios-uploads | mc cp --recursive | minio-aios-uploads/ |
| MinIO bucket aios-artifacts | mc cp --recursive | minio-aios-artifacts/ |

Not backed up by this script: Nextcloud DB (MariaDB), Paperless DB (postgres-16 container),
Nextcloud files volume, Grafana dashboards (provisioned from git -- no backup needed).

### 3b. Manual Backup

    cd /opt/agency-ai-os
    ./infra/scripts/backup.sh

Output is written to: /opt/agency-ai-os/backups/<YYYYMMDD_HHMMSS>/

### 3c. Automated Daily Backup (cron)

As mrt user on Agency-POC:

    crontab -e

Add this line (runs at 2:00 AM daily):

    0 2 * * * cd /opt/agency-ai-os && ./infra/scripts/backup.sh >> /var/log/aios-backup.log 2>&1

Create log file:

    sudo touch /var/log/aios-backup.log
    sudo chown mrt:mrt /var/log/aios-backup.log

Check last backup ran:

    tail -20 /var/log/aios-backup.log

### 3d. Backup Retention

Recommended: keep 7 daily backups and 4 weekly backups.

Delete backups older than 7 days:

    find /opt/agency-ai-os/backups -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +

### 3e. Verify Backup

    LATEST=$(ls /opt/agency-ai-os/backups/ | sort | tail -1)
    ls -lh "/opt/agency-ai-os/backups/${LATEST}/"

    # Verify Postgres dump files are non-empty:
    for DB in aios authentik temporal; do
      SIZE=$(stat -c%s "/opt/agency-ai-os/backups/${LATEST}/${DB}.dump" 2>/dev/null || echo 0)
      echo "${DB}.dump: ${SIZE} bytes"
    done

---

## 4. Restore Procedure

### 4a. Before Restoring

1. Identify backup directory:

    ls /opt/agency-ai-os/backups/

2. Stop dependent app containers to prevent write conflicts:

    cd /opt/agency-ai-os/infra
    make down SERVICE="aios-api aios-worker aios-scheduler aios-web"
    # For Authentik restore, also stop:
    make down SERVICE="authentik-server authentik-worker"

### 4b. Run Restore

    cd /opt/agency-ai-os
    ./infra/scripts/restore.sh /opt/agency-ai-os/backups/20260310_020000

The script pauses 5 seconds with a CTRL+C abort window. Then it:
1. Terminates existing connections to each target database
2. Drops and recreates each database
3. Restores from pg_dump custom-format dump via pg_restore
4. Restores MinIO bucket contents

### 4c. After Restoring

    cd /opt/agency-ai-os/infra
    make up
    # Wait ~60 seconds then check:
    docker ps --format "table {{.Names}}\t{{.Status}}" | grep -v "Up "

Spot-check application data:

    docker exec postgres-core psql -U "${POSTGRES_USER}" -d aios -c "\dt"
    docker exec postgres-core psql -U "${POSTGRES_USER}" -d aios -c "SELECT count(*) FROM memory_entries;"

---

## 5. Common Failure Remediation

### Container Crash Loop

    docker ps -a | grep <name>
    docker logs <container-name> --tail 50

    cd /opt/agency-ai-os/infra
    make restart SERVICE=<container-name>
    # Or force recreate:
    docker compose --env-file env/.env up -d --force-recreate <container-name>

### Disk Space Low

    df -h /opt
    docker system df
    docker system prune -f
    docker image prune -f

    # Remove old backups (keep last 3):
    ls /opt/agency-ai-os/backups/ | sort | head -n -3 | xargs -I{} rm -rf /opt/agency-ai-os/backups/{}

### Postgres Connection Refused

    docker ps | grep postgres-core
    docker exec postgres-core pg_isready -U "${POSTGRES_USER}"
    docker logs postgres-core --tail 50
    cd /opt/agency-ai-os/infra && make restart SERVICE=postgres-core

### Loki Not Collecting Logs

Note: Loki and Promtail use HEALTHCHECK NONE (distroless/minimal images lack wget/curl/sh).
They should show "Up" without health status.

    docker logs loki --tail 50
    # Storage permission fix if "permission denied" on /loki:
    docker exec loki chown -R 10001:10001 /loki
    docker logs promtail --tail 30
    curl -s http://localhost:3100/ready

### Temporal Workflow Failures

    # Check Temporal UI: http://10.10.110.31:8080
    docker logs aios-worker --tail 50
    docker exec temporal temporal operator cluster health --address localhost:7233
    cd /opt/agency-ai-os/infra && make restart SERVICE=aios-worker

### GDrive-Sync Folder Empty / 503 in Nextcloud

Full diagnosis + fix procedure: see `infra/docs/gdrive-sync-runbook.md`

Quick fix summary:

    # 1. Verify rclone can reach the bucket
    docker exec rclone-sync rclone lsd minio-truenas:gdrive-sync \
      --config /config/rclone/rclone.conf

    # 2. Reset Nextcloud external storage credentials (mount ID 1)
    #    Single quotes required — secret contains ! which bash history-expands
    docker exec nextcloud-app php occ files_external:config 1 key awesomemrt
    docker exec nextcloud-app php occ files_external:config 1 secret 'Poll00!!'

    # 3. Verify mount
    docker exec nextcloud-app php occ files_external:verify 1
    # Expected: status: ok

    # 4. Re-scan files
    docker exec nextcloud-app php occ files:scan \
      --path="/ncadmin/files/GDrive-Sync" --output

Root cause when this happens: Nextcloud credentials drifted from rclone.conf.
The credentials in rclone.conf (minio-truenas section) and the Nextcloud external
storage mount MUST always be the same key/secret pair.

### Authentik Not Accessible

    docker logs authentik-server --tail 50
    docker exec redis-core redis-cli ping
    cd /opt/agency-ai-os/infra && make restart SERVICE="authentik-server authentik-worker"

### MinIO Not Accessible

    curl -s http://localhost:9000/minio/health/live
    docker logs minio-core --tail 30
    source /opt/agency-ai-os/infra/env/.env
    docker exec minio-core mc alias set local http://localhost:9000 "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null
    docker exec minio-core mc ls local

### aios-api Not Responding

    curl -s http://localhost:3001/health
    docker logs aios-api --tail 50
    docker exec aios-api sh -c "nc -zv postgres-core 5432 && echo OK || echo FAIL"
    cd /opt/agency-ai-os
    docker build -t aios-api ./apps/api/
    cd infra && make restart SERVICE=aios-api

---

## 6. Makefile Reference

Location: /opt/agency-ai-os/infra/Makefile
Run all make commands from: /opt/agency-ai-os/infra/

| Target | Command | Effect |
|--------|---------|--------|
| up | make up | Start all containers in detached mode |
| up SERVICE=x | make up SERVICE=aios-api | Start a single service |
| down | make down | Stop all containers |
| down SERVICE=x | make down SERVICE=aios-api | Stop a single service |
| logs | make logs | Follow logs for all containers |
| logs SERVICE=x | make logs SERVICE=aios-api | Follow logs for one service |
| restart | make restart | Restart all containers |
| restart SERVICE=x | make restart SERVICE=aios-api | Restart one service |
| status | make status | Show all container statuses |
| pull | make pull | Pull latest images |
| pull SERVICE=x | make pull SERVICE=loki | Pull image for one service |
| clean | make clean | Stop all + remove volumes + orphans (DESTRUCTIVE -- destroys all data) |

---

## 7. Service Port Reference

All ports on host 10.10.110.31 (Agency-POC).

| Service | Host Port | Purpose |
|---------|-----------|---------|
| authentik-server | 9000 | Authentik OIDC / Admin UI |
| aios-api | 3001 | REST API + /metrics (Prometheus scrape target) |
| aios-web | 3002 | Next.js 14 frontend |
| temporal-ui | 8080 | Temporal workflow browser |
| nextcloud-app | 8090 | Nextcloud file collaboration |
| paperless-web | 8010 | Paperless-ngx document management |
| paperless-ai | 8501 | RAGZ semantic search (container port 3000) |
| minio-core | 9001 | MinIO admin console |
| prometheus | 9090 | Prometheus UI + query API |
| grafana | 3000 | Grafana dashboards (admin/admin) |
| openclaw-runtime | 18789 | OpenClaw gateway |
| openclaw-runtime | 18790 | OpenClaw bridge |
| node-exporter | 9100 | Host metrics (network_mode: host) |

Internal only (no host binding):

| Service | Internal Port | Notes |
|---------|--------------|-------|
| postgres-core | 5432 | app_net / data_net only |
| redis-core | 6379 | data_net only |
| loki | 3100 | app_net only, scraped by Grafana |
| promtail | 9080 | app_net only |
| postgres-exporter | 9187 | scraped by Prometheus |
| redis-exporter | 9121 | scraped by Prometheus |
| temporal | 7233, 7235 | app_net only (gRPC) |
