import sys, paramiko

OUT = r'D:\Code\Claude\03_Lab\_active\cmmc4msp\scripts\diag_result3.txt'
lines = []
def log(msg=""): lines.append(str(msg))

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('10.10.110.41', username='mrt', password='Poll0000', timeout=15)
log("SSH connected")

def run(label, cmd):
    log(); log('='*60); log(label); log('='*60)
    stdin, stdout, stderr = client.exec_command(cmd, timeout=15)
    out = stdout.read().decode()
    err = stderr.read().decode()
    log(out if out.strip() else "(no output)")
    if err.strip(): log("STDERR: " + err.strip())

# Check what containers are running
run("Docker containers", "sudo docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}'")

# Check the postgres container name
run("Postgres container name", "sudo docker ps --format '{{.Names}}' | grep -i post")

# Check psql via postgres user
run("Postgres roles", "sudo docker exec cmmc-postgres psql -U postgres -c '\\du'")

# Check databases
run("Databases", "sudo docker exec cmmc-postgres psql -U postgres -c '\\l'")

client.close()
log("\nDone.")
open(OUT, 'w').write('\n'.join(lines))
