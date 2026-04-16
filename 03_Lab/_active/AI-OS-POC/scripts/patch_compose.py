import re

with open('/opt/agency-ai-os/infra/docker-compose.yml', 'r') as f:
    content = f.read()

# ─── 1. grafana: add env vars ────────────────────────────────────────────────
old = '      GF_USERS_ALLOW_SIGN_UP: "false"\n    volumes:'
new = ('      GF_USERS_ALLOW_SIGN_UP: "false"\n'
       '      GF_SERVER_ROOT_URL: "https://AgencyOS-v1.onnex.cox.playsap.us/grafana"\n'
       '      GF_SERVER_SERVE_FROM_SUB_PATH: "true"\n'
       '    volumes:')
content = content.replace(old, new, 1)

grafana_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.grafana.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/grafana`)"\n'
    '      - "traefik.http.routers.grafana.entrypoints=web"\n'
    '      - "traefik.http.routers.grafana.priority=10"\n'
    '      - "traefik.http.services.grafana.loadbalancer.server.port=3000"\n'
    '      - "traefik.http.middlewares.grafana-strip.stripprefix.prefixes=/grafana"\n'
    '      - "traefik.http.routers.grafana.middlewares=grafana-strip"\n')
old = '      retries: 3\n      start_period: 20s\n\n  loki:'
new = '      retries: 3\n      start_period: 20s\n' + grafana_labels + '\n  loki:'
content = content.replace(old, new, 1)

# ─── 2. temporal-ui: add env var + labels ────────────────────────────────────
old = '      TEMPORAL_CORS_ORIGINS: "http://localhost:3000"\n    networks:'
new = ('      TEMPORAL_CORS_ORIGINS: "http://localhost:3000"\n'
       '      TEMPORAL_UI_BASE_HREF: "/temporal/"\n'
       '    networks:')
content = content.replace(old, new, 1)

temporal_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.temporal-ui.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/temporal`)"\n'
    '      - "traefik.http.routers.temporal-ui.entrypoints=web"\n'
    '      - "traefik.http.routers.temporal-ui.priority=10"\n'
    '      - "traefik.http.services.temporal-ui.loadbalancer.server.port=8080"\n'
    '      - "traefik.http.middlewares.temporal-ui-strip.stripprefix.prefixes=/temporal"\n'
    '      - "traefik.http.routers.temporal-ui.middlewares=temporal-ui-strip"\n')
old = '        condition: service_started\n\n  # ----------------------------------------------------------\n  # AI-OS APP'
new = '        condition: service_started\n' + temporal_labels + '\n  # ----------------------------------------------------------\n  # AI-OS APP'
content = content.replace(old, new, 1)

# ─── 3. paperless-web: update URL + add env vars + labels ────────────────────
old = '      PAPERLESS_URL: http://10.10.110.31:8010\n'
new = ('      PAPERLESS_URL: "https://AgencyOS-v1.onnex.cox.playsap.us"\n'
       '      PAPERLESS_FORCE_SCRIPT_NAME: "/paperless"\n'
       '      PAPERLESS_STATIC_URL: "/paperless/static/"\n')
content = content.replace(old, new, 1)

paperless_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.paperless.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/paperless`)"\n'
    '      - "traefik.http.routers.paperless.entrypoints=web"\n'
    '      - "traefik.http.routers.paperless.priority=10"\n'
    '      - "traefik.http.services.paperless.loadbalancer.server.port=8000"\n'
    '      - "traefik.http.middlewares.paperless-strip.stripprefix.prefixes=/paperless"\n'
    '      - "traefik.http.routers.paperless.middlewares=paperless-strip"\n')
old = '      retries: 5\n      start_period: 60s\n\n  paperless-ai:'
new = '      retries: 5\n      start_period: 60s\n' + paperless_labels + '\n  paperless-ai:'
content = content.replace(old, new, 1)

# ─── 4. paperless-ai: add labels ─────────────────────────────────────────────
paperless_ai_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.paperless-ai.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/paperless-ai`)"\n'
    '      - "traefik.http.routers.paperless-ai.entrypoints=web"\n'
    '      - "traefik.http.routers.paperless-ai.priority=10"\n'
    '      - "traefik.http.services.paperless-ai.loadbalancer.server.port=3000"\n'
    '      - "traefik.http.middlewares.paperless-ai-strip.stripprefix.prefixes=/paperless-ai"\n'
    '      - "traefik.http.routers.paperless-ai.middlewares=paperless-ai-strip"\n')
old = '        condition: service_healthy\n\n  # ----------------------------------------------------------\n  # OBSERVABILITY'
new = '        condition: service_healthy\n' + paperless_ai_labels + '\n  # ----------------------------------------------------------\n  # OBSERVABILITY'
content = content.replace(old, new, 1)

# ─── 5. minio-core: update MINIO_BROWSER_REDIRECT_URL + labels ───────────────
old = '      MINIO_BROWSER_REDIRECT_URL: ${MINIO_BROWSER_REDIRECT_URL:-http://10.10.110.31:9001}\n'
new = '      MINIO_BROWSER_REDIRECT_URL: "https://AgencyOS-v1.onnex.cox.playsap.us/minio"\n'
content = content.replace(old, new, 1)

minio_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.minio.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/minio`)"\n'
    '      - "traefik.http.routers.minio.entrypoints=web"\n'
    '      - "traefik.http.routers.minio.priority=10"\n'
    '      - "traefik.http.services.minio.loadbalancer.server.port=9001"\n'
    '      - "traefik.http.middlewares.minio-strip.stripprefix.prefixes=/minio"\n'
    '      - "traefik.http.routers.minio.middlewares=minio-strip"\n')
old = '      retries: 3\n      start_period: 20s\n\n  # ----------------------------------------------------------\n  # WORKFLOW ORCHESTRATION'
new = '      retries: 3\n      start_period: 20s\n' + minio_labels + '\n  # ----------------------------------------------------------\n  # WORKFLOW ORCHESTRATION'
content = content.replace(old, new, 1)

# ─── 6. nextcloud-app: update env vars + labels ──────────────────────────────
old = '      OVERWRITEPROTOCOL: http\n      OVERWRITEHOST: "10.10.110.31:8090"'
new = ('      OVERWRITEPROTOCOL: "https"\n'
       '      OVERWRITEHOST: "AgencyOS-v1.onnex.cox.playsap.us"\n'
       '      OVERWRITEWEBROOT: "/nextcloud"\n'
       '      OVERWRITECLIURL: "https://AgencyOS-v1.onnex.cox.playsap.us/nextcloud"')
content = content.replace(old, new, 1)

nextcloud_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.nextcloud.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/nextcloud`)"\n'
    '      - "traefik.http.routers.nextcloud.entrypoints=web"\n'
    '      - "traefik.http.routers.nextcloud.priority=10"\n'
    '      - "traefik.http.services.nextcloud.loadbalancer.server.port=80"\n'
    '      - "traefik.http.middlewares.nextcloud-strip.stripprefix.prefixes=/nextcloud"\n'
    '      - "traefik.http.routers.nextcloud.middlewares=nextcloud-strip"\n')
old = '      retries: 5\n      start_period: 120s\n  paperless-db:'
new = '      retries: 5\n      start_period: 120s\n' + nextcloud_labels + '  paperless-db:'
content = content.replace(old, new, 1)

# ─── 7. authentik-server: add labels ─────────────────────────────────────────
authentik_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.authentik.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/auth`)"\n'
    '      - "traefik.http.routers.authentik.entrypoints=web"\n'
    '      - "traefik.http.routers.authentik.priority=10"\n'
    '      - "traefik.http.services.authentik.loadbalancer.server.port=9000"\n'
    '      - "traefik.http.middlewares.authentik-strip.stripprefix.prefixes=/auth"\n'
    '      - "traefik.http.routers.authentik.middlewares=authentik-strip"\n')
old = '      retries: 5\n      start_period: 60s\n\n  authentik-worker:'
new = '      retries: 5\n      start_period: 60s\n' + authentik_labels + '\n  authentik-worker:'
content = content.replace(old, new, 1)

# ─── 8. openclaw-runtime: add labels ─────────────────────────────────────────
openclaw_labels = ('    labels:\n'
    '      - "traefik.enable=true"\n'
    '      - "traefik.http.routers.openclaw.rule=Host(`AgencyOS-v1.onnex.cox.playsap.us`) && PathPrefix(`/openclaw`)"\n'
    '      - "traefik.http.routers.openclaw.entrypoints=web"\n'
    '      - "traefik.http.routers.openclaw.priority=10"\n'
    '      - "traefik.http.services.openclaw.loadbalancer.server.port=18789"\n'
    '      - "traefik.http.middlewares.openclaw-strip.stripprefix.prefixes=/openclaw"\n'
    '      - "traefik.http.routers.openclaw.middlewares=openclaw-strip"\n')
old = '      retries: 3\n      start_period: 60s\n\n  nextcloud-db:'
new = '      retries: 3\n      start_period: 60s\n' + openclaw_labels + '\n  nextcloud-db:'
content = content.replace(old, new, 1)

with open('/opt/agency-ai-os/infra/docker-compose.yml', 'w') as f:
    f.write(content)

print('Done. Checking all changes applied:')
checks = [
    'GF_SERVER_ROOT_URL',
    'GF_SERVER_SERVE_FROM_SUB_PATH',
    'TEMPORAL_UI_BASE_HREF',
    'PAPERLESS_FORCE_SCRIPT_NAME',
    'traefik.http.routers.grafana',
    'traefik.http.routers.temporal-ui',
    'traefik.http.routers.paperless.',
    'traefik.http.routers.paperless-ai',
    'traefik.http.routers.minio',
    'traefik.http.routers.nextcloud',
    'traefik.http.routers.authentik',
    'traefik.http.routers.openclaw',
]
for c in checks:
    print(f'  {"OK" if c in content else "MISSING"}: {c}')
