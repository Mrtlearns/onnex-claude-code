# Onnex Docker & Homelab Skill

Mr. T runs a self-hosted production homelab on Proxmox at botonomy.xyz. Apply this infrastructure context when working on deployments, Docker Compose files, or homelab-related tasks.

---

## Infrastructure Overview

| Layer | Technology | Notes |
|-------|-----------|-------|
| Hypervisor | Proxmox VE | Debian trixie base, unattended-upgrades enabled |
| Networking | Tailscale + Cloudflare | Tailscale for internal mesh, Cloudflare for DNS/tunnel |
| Reverse Proxy | Traefik | Wildcard SSL via Cloudflare DNS challenge |
| Auth | Authentik | OIDC/SSO for all internal services |
| Container Runtime | Docker + Docker Compose | No Kubernetes — Docker-first approach |
| Storage | MinIO | S3-compatible object storage |
| Database | PostgreSQL 16 + pgvector | Primary datastore for all apps |
| GraphQL | Hasura | Over PostgreSQL |
| Messaging | NATS | Event bus |
| Orchestration | Temporal | Critical workflow orchestration |
| Automation | n8n | Self-hosted at n8n.botonomy.xyz |
| LLM Inference | Ollama | Dual RTX 3090 GPUs for local inference |
| VCS | GitLab | Self-hosted at gitlab.botonomy.xyz |
| Agentic Workloads | claude-controller VM | Ubuntu 24.04, Tailscale IP 100.111.233.126 |

---

## Domain & DNS

- **Primary domains**: `botonomy.xyz`, `on-nex.us`
- **DDNS**: `favonia/cloudflare-ddns` for both domains
- **Wildcard SSL**: `*.botonomy.xyz` and `*.on-nex.us` via Traefik `dns-cloudflare` cert resolver
- **Internal services**: `[service].botonomy.xyz`
- **Client deployments**: `[client].on-nex.us` or dedicated subdomain

---

## Traefik Configuration Patterns

```yaml
# Standard service label pattern
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.[service].rule=Host(`[service].botonomy.xyz`)"
  - "traefik.http.routers.[service].entrypoints=websecure"
  - "traefik.http.routers.[service].tls.certresolver=dns-cloudflare"
  - "traefik.http.services.[service].loadbalancer.server.port=[port]"

# With Authentik forward auth
  - "traefik.http.routers.[service].middlewares=authentik@file"

# With Basic Auth (lightweight services)
  - "traefik.http.routers.[service].middlewares=basic-auth@file"

# Wildcard cert trigger pattern (dummy router)
  - "traefik.http.routers.wildcard-cf.rule=Host(`wildcard.botonomy.xyz`)"
  - "traefik.http.routers.wildcard-cf.tls.certresolver=dns-cloudflare"
  - "traefik.http.routers.wildcard-cf.tls.domains[0].main=botonomy.xyz"
  - "traefik.http.routers.wildcard-cf.tls.domains[0].sans=*.botonomy.xyz"
```

---

## Docker Compose Standards

```yaml
version: "3.8"

services:
  [service]:
    image: [image]:[version]  # pin version, never :latest in production
    container_name: [service]
    restart: unless-stopped
    networks:
      - [service]-net
      - traefik-net  # only if needs external exposure
    environment:
      - VAR=${VAR}   # from .env file, never hardcoded
    volumes:
      - [service]-data:/data
    labels:
      # traefik labels here

networks:
  [service]-net:
    driver: bridge
  traefik-net:
    external: true  # shared traefik network

volumes:
  [service]-data:
```

**Rules:**
- Pin image versions — no `:latest` in production
- Separate network per service stack + shared `traefik-net`
- All secrets via `.env` file (gitignored) or Docker secrets
- `restart: unless-stopped` on all production services
- Named volumes for persistent data — not bind mounts unless necessary

---

## PostgreSQL Conventions

```sql
-- Schema per application (not separate DB per app)
CREATE SCHEMA [app_name];

-- pgvector enabled for RAG workloads
CREATE EXTENSION IF NOT EXISTS vector;

-- Standard table pattern
CREATE TABLE [app_name].[entity] (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS pattern (multi-tenant)
ALTER TABLE [table] ENABLE ROW LEVEL SECURITY;
CREATE POLICY [name] ON [table]
    USING (firm_id = current_setting('app.firm_id')::uuid);
```

- Connection string: `postgresql://[user]:[pass]@postgres:5432/[db]`
- Service accounts: one per application, minimum required privileges
- pgvector: `vector(1536)` for OpenAI embeddings, `vector(768)` for nomic-embed-text (Ollama)

---

## claude-controller VM

- **Purpose**: Central SSH orchestration hub for Claude Code agentic workloads
- **Location**: Proxmox VM, Tailscale IP `100.111.233.126`
- **OS**: Ubuntu 24.04 LTS
- **Workspace**: `/opt/claude-workspace`
- **SSH chain**: Claude Code → claude-controller → downstream hosts (e.g., openclaw at `10.10.110.5`)
- **Tools**: Ansible, Git, Python, Docker CLI (points to Proxmox Docker hosts)
- APT cache: `apt-cacher-ng` proxy configured for WSL Ubuntu APT

---

## Ollama / LLM Inference

- **Hardware**: Dual RTX 3090 (48GB VRAM total)
- **Models**: nomic-embed-text (embeddings), various LLMs for on-prem inference
- **Routing logic** (ndtv1 pattern):
  - ITAR/controlled content → Ollama only
  - Uncontrolled content → Anthropic Claude API (primary) / OpenAI (fallback)
- **OpenRouter**: Used for frontier model routing in System B / AI training platform

---

## Fast-Lane Deployment Pattern (Lovable/Vercel-Inspired)

For rapid client app deployments:
1. Docker Compose with isolated PostgreSQL schema (not separate DB)
2. Random subdomain on `on-nex.us`
3. Basic Auth via Traefik middleware (Authentik for production)
4. Traefik routes auto-configured via labels
5. GitLab CI/CD pipeline for `git push` → deploy

---

## Network Topology

```
Internet
    ↓
Cloudflare DNS (DDNS via favonia/cloudflare-ddns)
    ↓
Traefik (reverse proxy, wildcard SSL)
    ↓
    ├── n8n.botonomy.xyz → n8n container
    ├── gitlab.botonomy.xyz → GitLab VM
    ├── [app].botonomy.xyz → app containers
    └── [client].on-nex.us → client deployments

Internal (Tailscale mesh)
    ├── 100.111.233.126 → claude-controller VM
    ├── 10.10.110.5 → openclaw host
    └── [other Proxmox VMs]
```

---

## Common Tasks

### Add new service
1. Create Docker Compose file with Traefik labels
2. Add to `traefik-net` network
3. Add subdomain DNS if needed (Cloudflare)
4. Add Authentik provider/application if SSO required
5. Add to GitLab for version control

### Proxmox VM provisioning
- Ansible-driven via `claude-provisioning` VM
- Templates: Ubuntu 24.04 LTS cloud-init image
- Minimum: 2 vCPU, 4GB RAM, 20GB disk for utility VMs

### SSL cert troubleshooting
- Check `wildcard-cf` dummy router is present in Traefik config
- Verify Cloudflare API token has `Zone:DNS:Edit` permission
- Check Traefik logs: `docker logs traefik --tail 50`
