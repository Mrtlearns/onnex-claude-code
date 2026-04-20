"""Deploy landing page files and updated docker-compose.yml to VM."""
import paramiko
import os
import sys
import time

VM_HOST = "10.10.110.41"
VM_USER = "mrt"
VM_PASS = "Poll0000"

LOCAL_OUTPUTS = "D:/Code/Claude/03_Lab/_active/cmmc4msp/outputs"
LOCAL_COMPOSE = "D:/Code/Claude/03_Lab/_active/cmmc4msp/docker-compose.yml"

FILES_TO_UPLOAD = [
    "index.html",
    "CMMC4MSP-Marketing.html",
    "product-guide.html",
    "CMMC4MSP-Product-Guide.md",
]

LANDING_DEST = "/opt/stacks/cmmc4msp/landing"


def run(ssh: paramiko.SSHClient, cmd: str, timeout: int = 30) -> tuple:
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode()
    err = stderr.read().decode()
    rc = stdout.channel.recv_exit_status()
    return out, err, rc


def main():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {VM_HOST}...")
    ssh.connect(VM_HOST, username=VM_USER, password=VM_PASS)
    print("Connected.")

    # Fix /tmp/landing permissions so mrt can write, or just use /tmp directly with prefixed names
    print("Fixing /tmp/landing permissions...")
    out, err, rc = run(ssh, "sudo chmod 777 /tmp/landing")
    print(f"  rc={rc} err={err!r}")

    # Also ensure final dest exists
    out, err, rc = run(ssh, f"sudo mkdir -p {LANDING_DEST}")
    print(f"  mkdir {LANDING_DEST}: rc={rc}")

    # 3. SFTP upload landing files to /tmp/landing/
    print("Opening SFTP session...")
    sftp = ssh.open_sftp()

    for fname in FILES_TO_UPLOAD:
        local_path = os.path.join(LOCAL_OUTPUTS, fname).replace("\\", "/")
        remote_tmp = f"/tmp/landing/{fname}"
        if not os.path.exists(local_path):
            print(f"  SKIP (not found): {local_path}")
            continue
        size = os.path.getsize(local_path)
        print(f"  Uploading {fname} ({size:,} bytes)...")
        sftp.put(local_path, remote_tmp)
        print(f"  -> {remote_tmp} OK")

    # Upload docker-compose.yml directly to /tmp (already world-writable)
    print("Uploading docker-compose.yml...")
    size = os.path.getsize(LOCAL_COMPOSE.replace("\\", "/"))
    sftp.put(LOCAL_COMPOSE.replace("\\", "/"), "/tmp/docker-compose.yml")
    print(f"  -> /tmp/docker-compose.yml ({size:,} bytes) OK")

    sftp.close()

    # sudo cp landing files to final location
    print("Copying landing files to final location...")
    for fname in FILES_TO_UPLOAD:
        local_path = os.path.join(LOCAL_OUTPUTS, fname).replace("\\", "/")
        if not os.path.exists(local_path):
            continue
        out, err, rc = run(ssh, f"sudo cp /tmp/landing/{fname} {LANDING_DEST}/{fname}")
        if rc != 0:
            print(f"  ERROR cp {fname}: {err}")
        else:
            print(f"  Copied {fname}")

    # sudo cp docker-compose.yml
    print("Copying docker-compose.yml to stack directory...")
    out, err, rc = run(
        ssh,
        "sudo cp /tmp/docker-compose.yml /opt/stacks/cmmc4msp/docker-compose.yml"
    )
    if rc != 0:
        print(f"  ERROR: {err}")
    else:
        print("  Copied docker-compose.yml")

    # chown landing dir
    out, err, rc = run(ssh, f"sudo chown -R root:root {LANDING_DEST}")
    if rc != 0:
        print(f"  WARN chown: {err}")

    # Verify file sizes on VM
    print("\nFile sizes on VM:")
    out, err, rc = run(ssh, f"sudo ls -lh {LANDING_DEST}/")
    print(out if out else err)

    # Start landing service
    print("Starting landing service...")
    out, err, rc = run(
        ssh,
        "cd /opt/stacks/cmmc4msp && sudo docker compose up -d landing 2>&1",
        timeout=60
    )
    print(out)
    if err:
        print(f"  stderr: {err}")

    # Wait then verify HTTP 200
    print("Waiting 5s for container to start...")
    time.sleep(5)
    out, err, rc = run(
        ssh,
        'curl -s -o /dev/null -w "%{http_code}" http://localhost:8090/'
    )
    http_code = out.strip()
    print(f"HTTP status on port 8090: {http_code}")

    # Docker logs
    print("\nDocker logs (last 10):")
    out, err, rc = run(ssh, "sudo docker logs cmmc-landing --tail=10 2>&1")
    print(out if out else "(no stdout)")
    if err:
        print(err)

    ssh.close()
    print("\nDone.")
    return http_code == "200"


if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
