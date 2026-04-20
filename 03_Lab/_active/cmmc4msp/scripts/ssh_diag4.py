import sys, paramiko

OUT = r'D:\Code\Claude\03_Lab\_active\cmmc4msp\scripts\diag_result4.txt'
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

# Check env vars in the postgres container
run("Postgres container env vars", "sudo docker exec cmmc-postgres env | grep -i 'postgres\\|user\\|pass\\|db'")

# Check docker-compose for postgres credentials
run("docker-compose postgres config", "grep -A20 'cmmc-postgres\\|postgres:' ~/cmmc/docker-compose.yml 2>/dev/null | head -40")
run("docker-compose .env", "cat ~/cmmc/.env 2>/dev/null | grep -i 'postgres\\|db_'")

# Try connecting as root/superuser inside the container
run("psql via su postgres", "sudo docker exec cmmc-postgres su - postgres -c 'psql -c \"\\du\"' 2>&1")
run("psql via id", "sudo docker exec cmmc-postgres whoami")

client.close()
log("\nDone.")
open(OUT, 'w').write('\n'.join(lines))
