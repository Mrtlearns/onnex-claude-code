# Agency AI-OS -- Kubernetes Migration Conventions

**Version:** 1.0
**Updated:** 2026-03-10
**Scope:** All 27 services in the Agency AI-OS Docker Compose stack

This document defines how to translate each Docker Compose construct to a Kubernetes equivalent.
Use this as a reference when migrating the POC stack to a Kubernetes cluster.

---

## Section 1: General Migration Principles

### Concept Mapping

| Docker Compose Concept | Kubernetes Equivalent |
|------------------------|----------------------|
| service: | Deployment (stateless) or StatefulSet (stateful) |
| image: | Same image -- no change required |
| container_name: | Pod name via label app: <name> |
| Docker DNS (service name) | K8s Service (ClusterIP) with same name |
| environment: (non-secret vars) | ConfigMap -- referenced via envFrom or env.valueFrom.configMapKeyRef |
| environment: (passwords/keys) | Secret -- referenced via env.valueFrom.secretKeyRef |
| env_file: .env | Multiple Secrets and ConfigMaps (split by sensitivity) |
| volumes: (named) | PersistentVolumeClaim (PVC) with appropriate StorageClass |
| volumes: (bind mount config) | ConfigMap mounted as volume via volumeMounts |
| ports: host:container | Service with NodePort or LoadBalancer |
| healthcheck: | readinessProbe + livenessProbe in Pod spec |
| depends_on: | InitContainers or Helm hooks for startup ordering |
| networks: | K8s Namespace (optional isolation) or NetworkPolicy |
| restart: unless-stopped | Deployment restartPolicy: Always (default) |
| network_mode: host | Pod hostNetwork: true |
| pid: host | Pod hostPID: true |

### Key Principles

1. **Container images** are reused as-is. Ensure images are accessible from the cluster registry.

2. **Service discovery**: Docker service names become K8s Service names. Internal traffic uses
   ClusterIP services with the same hostname. Example: postgres-core remains reachable as
   postgres-core within the namespace.

3. **Secrets management**: All sensitive environment variables from infra/env/.env must become
   K8s Secrets. Non-sensitive config becomes ConfigMaps.

4. **Persistent storage**: Every named Docker volume becomes a PVC. Size estimates below are
   based on POC data + 50% growth buffer.

5. **Config files as volumes**: Files like loki.yaml, prometheus.yml, promtail config are bind-mounted
   in Compose. In K8s, these become ConfigMaps mounted as read-only volumes.

6. **Health checks**: Docker healthcheck blocks translate to readinessProbe (controls traffic routing)
   and livenessProbe (controls restart behavior).

7. **Network isolation**: The three Compose networks (edge_net, app_net, data_net) map to
   K8s NetworkPolicies. By default all Pods in a namespace can communicate.
   data_net: internal: true becomes a NetworkPolicy denying external ingress.

8. **aios-scheduler**: This container exits 0 intentionally after registering Temporal schedules.
   In K8s, deploy as a Job (not a Deployment) with restartPolicy: Never.

---

## Section 2: Service Migration Table

All 27 services. Column definitions:
- Named Volumes -> PVC: named Docker volumes that need PersistentVolumeClaims
- Config Mounts -> ConfigMap: bind-mounted config files that become ConfigMaps
- Secret Env Vars -> Secret: environment variable names to move to K8s Secrets
- Host Port -> K8s Service: how the service is exposed externally
- Special Notes: migration considerations

| Service | Image | Named Volumes -> PVC | Config Mounts -> ConfigMap | Secret Env Vars -> Secret | Host Port -> K8s Service | Special Notes |
|---------|-------|---------------------|---------------------------|--------------------------|--------------------------|---------------|
| edge-traefik | traefik:v3.2 | - | traefik.yml, dynamic config -> traefik-config | - | 80, 443 -> LoadBalancer | Deploy after all backend services; configure Ingress rules |
| authentik-server | ghcr.io/goauthentik/server:2024.10 | authentik_media -> 5Gi PVC | - | AUTHENTIK_SECRET_KEY, AUTHENTIK_POSTGRESQL__PASSWORD -> authentik-secrets | 9000 -> NodePort or ClusterIP+Ingress | Shares secret with authentik-worker |
| authentik-worker | ghcr.io/goauthentik/server:2024.10 | authentik_media -> 5Gi PVC (shared) | - | Same as authentik-server | Internal ClusterIP only | Must share media PVC with authentik-server; use ReadWriteMany StorageClass |
| postgres-core | pgvector/pgvector:pg16 | pg_core_data -> 20Gi PVC | - | POSTGRES_USER, POSTGRES_PASSWORD -> pg-core-secrets | ClusterIP only (no external) | readinessProbe: pg_isready; initContainer: enable pgvector extension via SQL |
| redis-core | redis:7-alpine | redis_core_data -> 2Gi PVC | - | (no secrets in POC) | ClusterIP only | Consider StatefulSet for ordered startup |
| minio-core | minio/minio:latest | minio_core_data -> 50Gi PVC | - | MINIO_ROOT_USER, MINIO_ROOT_PASSWORD -> minio-secrets | 9001 -> NodePort (admin console) | mc alias must be set fresh per session; use MinIO Operator for production K8s |
| temporal | temporalio/auto-setup:1.25 | - | dynamicconfig.yaml -> temporal-config | DB_PORT, POSTGRES_USER, POSTGRES_PWD -> temporal-secrets | 7233 -> ClusterIP (gRPC); 8233 -> ClusterIP | Recommended: use temporalio/helm-charts instead of manual deployment (see Section 4) |
| temporal-ui | temporalio/ui:2.32.0 | - | - | TEMPORAL_ADDRESS -> temporal-ui-config | 8080 -> NodePort or Ingress | Points to temporal:7233 |
| aios-web | aios-web:local | - | - | NEXTAUTH_SECRET, NEXTAUTH_URL -> aios-web-secrets | 3002 -> NodePort or Ingress | Next.js standalone; HOSTNAME=0.0.0.0 env var required |
| aios-api | aios-api:local | - | - | DATABASE_URL, OPENAI_API_KEY, AUTHENTIK_CLIENT_SECRET -> aios-api-secrets | 3001 -> ClusterIP+Ingress | See Section 5 sample manifests |
| aios-worker | aios-worker:local | - | - | DATABASE_URL, TEMPORAL_ADDRESS -> aios-worker-secrets | ClusterIP only (no external) | worker process; no HTTP port |
| aios-scheduler | aios-worker:local | - | - | DATABASE_URL, TEMPORAL_ADDRESS -> aios-worker-secrets | None | Run as K8s Job (not Deployment); restartPolicy: Never -- exits 0 after schedule registration |
| openclaw-runtime | ghcr.io/openclaw/openclaw:latest | openclaw_config (bind mount) -> ConfigMap | openclaw.json -> openclaw-config | OPENCLAW_GATEWAY_TOKEN, ANTHROPIC_API_KEY -> openclaw-secrets | 18789, 18790 -> ClusterIP | gateway.bind=lan required (bind 0.0.0.0); ConfigMap mounted as volume |
| nextcloud-db | mariadb:11 | nextcloud_db_data -> 20Gi PVC | - | MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD -> nextcloud-db-secrets | ClusterIP only | StatefulSet recommended; initContainer for DB creation |
| nextcloud-redis | redis:7-alpine | - | - | - | ClusterIP only | Separate from redis-core |
| nextcloud-app | nextcloud:30-apache | nextcloud_data -> 50Gi PVC | - | NEXTCLOUD_ADMIN_PASSWORD, NEXTCLOUD_DB_PASSWORD -> nextcloud-secrets | 8090 -> NodePort or Ingress | ReadWriteMany PVC needed if scaling replicas; single replica is fine for POC migration |
| paperless-db | pgvector/pgvector:pg16 | paperless_db_data -> 10Gi PVC | - | POSTGRES_USER, POSTGRES_PASSWORD -> paperless-db-secrets | ClusterIP only | Separate Postgres instance (not postgres-core) |
| paperless-broker | redis:7-alpine | - | - | - | ClusterIP only | Celery task queue for Paperless |
| paperless-web | ghcr.io/paperless-ngx/paperless-ngx:2.13 | paperless_data -> 10Gi PVC, paperless_media -> 20Gi PVC | - | PAPERLESS_DBPASS, PAPERLESS_SECRET_KEY -> paperless-secrets | 8010 -> NodePort or Ingress | consume folder can be a PVC or object storage |
| paperless-ai | clusterzx/paperless-ai:latest | - | - | PAPERLESS_API_TOKEN -> paperless-ai-secrets | 8501 -> ClusterIP or NodePort | POST /initialize required after startup (initContainer or Job) |
| node-exporter | quay.io/prometheus/node-exporter:v1.8.2 | - | - | - | 9100 -> ClusterIP (Prometheus scrape) | Deploy as DaemonSet with hostNetwork: true and hostPID: true (see Section 3) |
| postgres-exporter | quay.io/prometheuscommunity/postgres-exporter:v0.15.0 | - | - | DATA_SOURCE_NAME -> pg-exporter-secrets | 9187 -> ClusterIP (Prometheus scrape) | Points to postgres-core ClusterIP |
| redis-exporter | oliver006/redis_exporter:v1.62.0 | - | - | REDIS_ADDR -> redis-exporter-config | 9121 -> ClusterIP (Prometheus scrape) | Points to redis-core:6379 |
| prometheus | prom/prometheus:latest | prometheus_data -> 20Gi PVC | prometheus.yml -> prometheus-config | - | 9090 -> NodePort or Ingress | ConfigMap for scrape config; ServiceMonitor CRD if using Prometheus Operator |
| grafana | grafana/grafana:latest | grafana_data -> 5Gi PVC | provisioning/ -> grafana-provisioning-config, dashboards/ -> grafana-dashboards-config | GF_SECURITY_ADMIN_PASSWORD -> grafana-secrets | 3000 -> NodePort or Ingress | Mount both provisioning and dashboards ConfigMaps as separate volumes |
| loki | grafana/loki:latest | loki_data -> 20Gi PVC | loki.yaml -> loki-config | - | 3100 -> ClusterIP (Grafana datasource) | HEALTHCHECK NONE in Compose; use httpGet readinessProbe /ready in K8s |
| promtail | grafana/promtail:latest | promtail_positions -> 1Gi PVC | config.yml -> promtail-config | - | 9080 -> ClusterIP | Requires access to /var/log/pods on each node; deploy as DaemonSet with hostPath volume |

---

## Section 3: node-exporter Special Case

node-exporter uses `network_mode: host` and `pid: host` in Docker Compose to access host metrics.
In Kubernetes, deploy as a **DaemonSet** (runs one pod per node):

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: aios
spec:
  selector:
    matchLabels:
      app: node-exporter
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      hostNetwork: true
      hostPID: true
      containers:
        - name: node-exporter
          image: quay.io/prometheus/node-exporter:v1.8.2
          ports:
            - containerPort: 9100
              hostPort: 9100
          volumeMounts:
            - name: proc
              mountPath: /host/proc
              readOnly: true
            - name: sys
              mountPath: /host/sys
              readOnly: true
            - name: root
              mountPath: /host/root
              readOnly: true
          args:
            - --path.procfs=/host/proc
            - --path.sysfs=/host/sys
            - --path.rootfs=/host/root
      volumes:
        - name: proc
          hostPath:
            path: /proc
        - name: sys
          hostPath:
            path: /sys
        - name: root
          hostPath:
            path: /
```

Similarly, **promtail** should be deployed as a DaemonSet with:
- hostPath volume: /var/log/pods (or /var/lib/docker/containers for Docker logging driver)
- A persistent positions PVC or emptyDir for tracking log position

---

## Section 4: Temporal Special Case

Temporal in Kubernetes is complex -- it has multiple components (frontend, history, matching, worker, web)
plus database schema migrations. The recommended approach is the official Helm chart:

**Reference:** https://github.com/temporalio/helm-charts

Instead of deploying the `temporalio/auto-setup` image directly, use:

```bash
helm repo add temporalio https://go.temporal.io/helm-charts
helm install temporal temporalio/temporal   --namespace temporal   --set server.replicaCount=1   --set cassandra.enabled=false   --set mysql.enabled=false   --set postgresql.enabled=true   --set postgresql.postgresqlPassword=<password>   --set elasticsearch.enabled=false
```

Or point to the existing postgres-core instance by configuring:
- `server.config.persistence.default.sql.host=postgres-core`
- `server.config.persistence.default.sql.database=temporal`

The `aios` namespace and retention period (168h) must be created post-deploy:
```bash
temporal operator namespace create aios --retention 168h --address temporal-frontend:7233
```

---

## Section 5: Migration Checklist

Use this checklist when performing the Docker Compose to Kubernetes migration:

### Pre-migration
- [ ] Build all local images (aios-api, aios-web, aios-worker) and push to a container registry
- [ ] Create namespace: kubectl create namespace aios
- [ ] Export all secrets from infra/env/.env and create K8s Secrets

### Infrastructure (deploy first)
- [ ] Create PVCs for all stateful services (postgres-core, redis-core, minio-core)
- [ ] Create ConfigMaps for all bind-mounted config files
- [ ] Deploy postgres-core (StatefulSet or Deployment + PVC)
- [ ] Deploy redis-core
- [ ] Deploy minio-core + create buckets (aios-uploads, aios-artifacts)
- [ ] Verify all data services are Ready

### Application Services
- [ ] Deploy temporal (via Helm chart recommended)
- [ ] Create aios namespace in Temporal: temporal operator namespace create aios
- [ ] Deploy authentik-server + authentik-worker (shared media PVC)
- [ ] Deploy openclaw-runtime with openclaw.json ConfigMap
- [ ] Deploy aios-api (Deployment + Service)
- [ ] Deploy aios-web (Deployment + Service)
- [ ] Deploy aios-worker (Deployment)
- [ ] Deploy aios-scheduler (Job -- runs once)

### Document Stack
- [ ] Deploy nextcloud-db (MariaDB StatefulSet)
- [ ] Deploy nextcloud-app
- [ ] Deploy paperless-db, paperless-broker, paperless-web, paperless-ai

### Observability
- [ ] Deploy node-exporter (DaemonSet)
- [ ] Deploy postgres-exporter, redis-exporter
- [ ] Deploy prometheus with prometheus.yml ConfigMap
- [ ] Deploy loki with loki.yaml ConfigMap
- [ ] Deploy promtail (DaemonSet)
- [ ] Deploy grafana with provisioning ConfigMaps

### Networking
- [ ] Create Services for all deployments
- [ ] Create NetworkPolicies for data_net isolation
- [ ] Deploy Traefik (or nginx-ingress) as Ingress controller
- [ ] Create Ingress resources for external services
- [ ] Verify DNS resolution between services

### Verification
- [ ] All Pods show Running/Ready
- [ ] Prometheus targets all UP
- [ ] Grafana dashboards loading
- [ ] aios-api /health returns 200
- [ ] Authentik OIDC well-known endpoint reachable
- [ ] Temporal UI accessible
