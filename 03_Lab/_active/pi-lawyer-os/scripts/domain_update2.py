#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Update domain references on agency-ai-os server."""

import paramiko
import time
import sys
import io

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

host = "10.10.110.31"
user = "root"
password = "Poll0000"

OLD = "AgencyOS-v1.onnex.cox.playsap.us"
NEW = "AgencyOS-v1.on-nex.us"

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, username=user, password=password, timeout=15)

def run(cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err, exit_code

def banner(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")

# ─── Probe: what's actually in .env? ────────────────────────────
banner("PROBE: grep for domain patterns in .env")
out, err, ec = run("grep -i 'onnex\\|on-nex\\|playsap\\|agencyos' /opt/agency-ai-os/infra/env/.env || echo '(no matches)'")
print(out)

banner("PROBE: grep for domain patterns in docker-compose.yml")
out, err, ec = run("grep -i 'onnex\\|on-nex\\|playsap\\|agencyos' /opt/agency-ai-os/infra/docker-compose.yml || echo '(no matches)'")
print(out)

# ─── Step 1: Update .env ────────────────────────────────────────
banner("STEP 1: Update /opt/agency-ai-os/infra/env/.env")

py_script = """
old = 'AgencyOS-v1.onnex.cox.playsap.us'
new_val = 'AgencyOS-v1.on-nex.us'
with open('/opt/agency-ai-os/infra/env/.env', 'r') as f:
    content = f.read()
count = content.count(old)
content = content.replace(old, new_val)
with open('/opt/agency-ai-os/infra/env/.env', 'w') as f:
    f.write(content)
print('Replaced', count, 'occurrences in .env')
"""

out, err, ec = run(f"python3 << 'HEREDOC'\n{py_script}\nHEREDOC")
print(f"Result: {out.strip()}")
if err.strip(): print(f"STDERR: {err.strip()}")
print(f"Exit code: {ec}")

# Verify .env
out, err, ec = run("grep -E 'DOMAIN|URL|AUTH' /opt/agency-ai-os/infra/env/.env | grep -v 'PASSWORD\\|SECRET\\|KEY\\|TOKEN'")
print("\nVERIFY .env (DOMAIN/URL/AUTH lines):")
print(out if out.strip() else "(no output)")

# ─── Step 2: Update docker-compose.yml ──────────────────────────
banner("STEP 2: Update /opt/agency-ai-os/infra/docker-compose.yml")

py_script2 = """
old = 'AgencyOS-v1.onnex.cox.playsap.us'
new_val = 'AgencyOS-v1.on-nex.us'
with open('/opt/agency-ai-os/infra/docker-compose.yml', 'r') as f:
    content = f.read()
count = content.count(old)
content = content.replace(old, new_val)
with open('/opt/agency-ai-os/infra/docker-compose.yml', 'w') as f:
    f.write(content)
print('Replaced', count, 'occurrences in docker-compose.yml')
"""

out, err, ec = run(f"python3 << 'HEREDOC'\n{py_script2}\nHEREDOC")
print(f"Result: {out.strip()}")
if err.strip(): print(f"STDERR: {err.strip()}")
print(f"Exit code: {ec}")

# Verify docker-compose.yml
out, err, ec = run("grep -i 'AgencyOS\\|on-nex\\|onnex' /opt/agency-ai-os/infra/docker-compose.yml")
print("\nVERIFY docker-compose.yml (AgencyOS/on-nex/onnex lines):")
print(out if out.strip() else "(no output)")

# ─── Step 3: Reset acme.json ────────────────────────────────────
banner("STEP 3: Reset acme.json")

out, err, ec = run("echo '{}' > /opt/agency-ai-os/infra/acme/acme.json && chmod 600 /opt/agency-ai-os/infra/acme/acme.json && ls -la /opt/agency-ai-os/infra/acme/acme.json")
print(out if out.strip() else "(no output)")
if err.strip(): print(f"STDERR: {err.strip()}")
print(f"Exit code: {ec}")

# ─── Step 4: Recreate containers ────────────────────────────────
banner("STEP 4: Recreate edge-traefik and aios-web")

out, err, ec = run("cd /opt/agency-ai-os/infra && docker compose -f docker-compose.yml --env-file env/.env up -d --force-recreate edge-traefik aios-web 2>&1", timeout=120)
print(out if out.strip() else "(no output)")
if err.strip(): print(f"STDERR: {err.strip()}")
print(f"Exit code: {ec}")

# Wait 15 seconds
print("\nWaiting 15 seconds for containers to stabilize...")
time.sleep(15)

# Post-recreate checks
banner("POST-RECREATE CHECKS")

out, err, ec = run("docker inspect edge-traefik --format '{{.State.Health.Status}}'")
print(f"edge-traefik health: {out.strip()}")

out, err, ec = run("docker inspect aios-web --format '{{.State.Health.Status}}'")
print(f"aios-web health: {out.strip()}")

print("\n--- edge-traefik logs (last 15) ---")
out, err, ec = run("docker logs edge-traefik --tail 15 2>&1")
print(out if out.strip() else "(no output)")

client.close()
print("\nDone.")
