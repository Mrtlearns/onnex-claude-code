import sys, paramiko

OUT = r'D:\Code\Claude\03_Lab\_active\cmmc4msp\scripts\diag_result5.txt'
lines = []
def log(msg=""): lines.append(str(msg))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.41', username='mrt', password='Poll0000', timeout=15)
log("SSH connected")

PSQL = "sudo docker exec cmmc-postgres psql -U cmmc_app -d cmmc_main"

def run(label, sql):
    log(); log('='*60); log(label); log('='*60)
    cmd = f'{PSQL} -c "{sql}"'
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    log(out if out.strip() else "(no output)")
    if err.strip(): log("STDERR: " + err.strip())

run("Query 1 — Find meridian-defense org",
    "SELECT id, name, slug FROM orgs WHERE slug = 'meridian-defense';")

run("Query 2 — All meridian/airgap users",
    "SELECT id, email, role, org_id, is_active FROM users WHERE email ILIKE '%meridian%' OR email ILIKE '%airgap%' ORDER BY email;")

run("Query 3 — Users with org join",
    "SELECT u.email, u.role, u.org_id, u.is_active, o.slug as org_slug FROM users u LEFT JOIN orgs o ON o.id = u.org_id WHERE u.email ILIKE '%meridian%' OR u.email ILIKE '%airgap%';")

# Get meridian org ID
stdin, stdout, stderr = client.exec_command(
    f"{PSQL} -t -c \"SELECT id FROM orgs WHERE slug = 'meridian-defense';\"",
    timeout=10
)
org_id = stdout.read().decode().strip()
log(); log(f"Extracted org_id: '{org_id}'")

if org_id:
    run(f"Query 4 — Active users count for meridian-defense org ({org_id})",
        f"SELECT count(*) FROM users WHERE org_id = '{org_id}' AND is_active = true;")
else:
    log("Query 4 — SKIPPED (no org_id found)")

client.close()
log(); log("Done.")
open(OUT, 'w').write('\n'.join(lines))
