import paramiko
import sys
import io

# Redirect stdout to file
_outfile = open(r'D:\Code\Claude\03_Lab\_active\cmmc4msp\scripts\ssh_diag_out.txt', 'w')
_orig_stdout = sys.stdout
sys.stdout = _outfile

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
try:
    client.connect('10.10.110.41', username='mrt', password='Poll0000', timeout=10)
except Exception as e:
    print(f"CONNECTION FAILED: {e}")
    sys.exit(1)

def run(label, sql):
    cmd = f"sudo docker exec cmmc-postgres psql -U cmmc cmmc -c \"{sql}\""
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    print(f"\n{'='*60}")
    print(f"{label}")
    print('='*60)
    print(out if out.strip() else "(no output)")
    if err.strip():
        print("STDERR:", err.strip())

run("Query 1 — Find meridian-defense org",
    "SELECT id, name, slug FROM orgs WHERE slug = 'meridian-defense';")

run("Query 2 — All meridian/airgap users",
    "SELECT id, email, role, org_id, is_active FROM users WHERE email ILIKE '%meridian%' OR email ILIKE '%airgap%' ORDER BY email;")

run("Query 3 — Users with org join",
    "SELECT u.email, u.role, u.org_id, u.is_active, o.slug as org_slug FROM users u LEFT JOIN orgs o ON o.id = u.org_id WHERE u.email ILIKE '%meridian%' OR u.email ILIKE '%airgap%';")

# Get meridian org ID
stdin, stdout, stderr = client.exec_command(
    "sudo docker exec cmmc-postgres psql -U cmmc cmmc -t -c \"SELECT id FROM orgs WHERE slug = 'meridian-defense';\"",
    timeout=10
)
org_id = stdout.read().decode().strip()
print(f"\nExtracted org_id: '{org_id}'")

if org_id:
    run(f"Query 4 — Active users count for org {org_id}",
        f"SELECT count(*) FROM users WHERE org_id = '{org_id}' AND is_active = true;")
else:
    print("\nQuery 4 — SKIPPED (no org_id found)")

client.close()
print("\nDone.")
sys.stdout = _orig_stdout
_outfile.close()
