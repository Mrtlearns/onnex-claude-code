# Agency AI-OS

POC stack for the Agency AI-OS platform.

## Quick Start

```bash
cd infra
cp env/.env.example env/.env
# Fill in env/.env values
make up
make status
```

## Makefile Targets

| Target | Description |
|--------|-------------|
| `make up [SERVICE=x]` | Start all services or a specific service |
| `make down [SERVICE=x]` | Stop all services or a specific service |
| `make logs [SERVICE=x]` | Tail logs (all or specific service) |
| `make restart [SERVICE=x]` | Restart all or specific service |
| `make status` | Show container status |
| `make pull [SERVICE=x]` | Pull latest images |
| `make clean` | Destroy containers and volumes (DESTRUCTIVE) |

## Directory Layout

```
infra/
  docker-compose.yml   Single Compose file for all services
  Makefile             Ops targets
  config/              Per-service config files (mounted as volumes)
  env/
    .env               Secrets — VM only, gitignored
    .env.example       All variable keys — committed
  scripts/             Utility scripts
```

## SSH Access

Via claude-controller jump host (Tailscale). ProxyJump does not work here — use sshpass two-hop:

```bash
ssh -i ~/.ssh/MrT_Personal_Key_ed25519 -o StrictHostKeyChecking=no mrt@100.111.233.126 \
  "sshpass -p 'Poll0000' ssh -o StrictHostKeyChecking=no \
   -o PreferredAuthentications=password root@10.10.110.31 'YOUR COMMAND'"
```

See `infra/docs/ops-runbook.md` for full ops procedures.
See `infra/docs/gdrive-sync-runbook.md` for GDrive-Sync / Nextcloud diagnosis and recovery.
