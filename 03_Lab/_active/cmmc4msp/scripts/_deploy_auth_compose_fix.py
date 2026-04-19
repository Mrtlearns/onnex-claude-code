"""Deploy auth.ts + docker-compose.yml to CMMC4MSP VM and restart nextjs."""
import sys
import time
import paramiko

# Force UTF-8 output on Windows to handle docker compose unicode chars
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = "10.10.110.41"
USER = "mrt"
PASSWORD = "Poll0000"
PORT = 22

LOCAL_AUTH    = r"D:\Code\Claude\03_Lab\_active\cmmc4msp\nextjs\src\lib\auth.ts"
LOCAL_COMPOSE = r"D:\Code\Claude\03_Lab\_active\cmmc4msp\docker-compose.yml"

REMOTE_TMP_AUTH    = "/tmp/auth.ts"
REMOTE_TMP_COMPOSE = "/tmp/docker-compose.yml"

FINAL_AUTH    = "/opt/stacks/cmmc4msp/nextjs/src/lib/auth.ts"
FINAL_COMPOSE = "/opt/stacks/cmmc4msp/docker-compose.yml"


def ssh_run(client, cmd, description=""):
    print(f"\n--- {description or cmd} ---")
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    out = stdout.read().decode()
    exit_code = stdout.channel.recv_exit_status()
    print(out)
    print(f"[exit: {exit_code}]")
    return exit_code, out


def main():
    print("=== CMMC4MSP Auth-Fix Deploy ===\n")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {HOST}:{PORT} as {USER} ...")
    client.connect(HOST, port=PORT, username=USER, password=PASSWORD, timeout=15)
    print("Connected OK\n")

    # Step 1: SFTP upload
    print("--- Step 1: SFTP upload both files to /tmp/ ---")
    sftp = client.open_sftp()
    sftp.put(LOCAL_AUTH, REMOTE_TMP_AUTH)
    print(f"  auth.ts -> {REMOTE_TMP_AUTH}  OK")
    sftp.put(LOCAL_COMPOSE, REMOTE_TMP_COMPOSE)
    print(f"  docker-compose.yml -> {REMOTE_TMP_COMPOSE}  OK")
    sftp.close()

    # Step 2: cp auth.ts
    ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S cp {REMOTE_TMP_AUTH} {FINAL_AUTH} && echo 'cp auth.ts OK'",
        "Step 2: cp auth.ts to final path")

    # Step 3: cp docker-compose.yml
    ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S cp {REMOTE_TMP_COMPOSE} {FINAL_COMPOSE} && echo 'cp docker-compose.yml OK'",
        "Step 3: cp docker-compose.yml to final path")

    # Step 4: docker compose build nextjs
    ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S bash -c 'cd /opt/stacks/cmmc4msp && docker compose build nextjs 2>&1 | tail -20'",
        "Step 4: docker compose build nextjs (tail -20)")

    # Step 5: docker compose up -d nextjs
    ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S bash -c 'cd /opt/stacks/cmmc4msp && docker compose up -d nextjs 2>&1'",
        "Step 5: docker compose up -d nextjs")

    # Wait for container to start
    print("\n--- Waiting 12 seconds for container to start... ---")
    time.sleep(12)

    # Step 6: docker logs
    ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S docker logs --tail=30 cmmc-nextjs 2>&1",
        "Step 6: docker logs cmmc-nextjs (last 30 lines)")

    # Step 7: verify env var
    rc, out = ssh_run(client,
        f"echo '{PASSWORD}' | sudo -S docker exec cmmc-nextjs env 2>&1 | grep HASURA_INTERNAL",
        "Step 7: verify HASURA_INTERNAL_URL in container env")

    if "HASURA_INTERNAL" in out:
        print(f"\n[CONFIRMED] ENV VAR PRESENT: {out.strip()}")
    else:
        print("\n[WARNING] HASURA_INTERNAL_URL NOT found in container env!")

    client.close()
    print("\n=== Deploy complete ===")


if __name__ == "__main__":
    main()
